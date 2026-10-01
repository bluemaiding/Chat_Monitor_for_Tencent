import { Contact, Message } from '../../shared/types'

// 支持多种 QQ OneBot 实现
const DEFAULT_API_BASE = 'http://127.0.0.1:3000' // NapCat 默认端口
// SnowLuma 默认端口为 5099，用户可在设置中配置

export interface QQGroupInfo {
  groupId: number
  groupName: string
  memberCount: number
}

export interface QQGroupMember {
  userId: number
  nickname: string
  card: string // group card
}

export interface QQMessage {
  messageId: number
  userId: number
  groupId: number
  message: string
  rawMessage: string
  sender: {
    userId: number
    nickname: string
  }
  time: number
}

class QQService {
  private apiBase: string = DEFAULT_API_BASE
  private apiToken?: string

  setApiToken(token?: string) {
    this.apiToken = token && token.trim() ? token.trim() : undefined
  }

  getApiToken(): string | undefined {
    return this.apiToken
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiToken) {
      h['Authorization'] = `Bearer ${this.apiToken}`
    }
    return h
  }

  setApiBase(url: string) {
    this.apiBase = url
  }

  getApiBase(): string {
    return this.apiBase
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiBase}/get_login_info`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(8000)
      })
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }
      const data = await response.json()
      if (data.status !== 'ok') {
        return { success: false, error: data.message || 'API error' }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async getLoginInfo(): Promise<{ userId: number; nickname: string } | null> {
    try {
      const response = await fetch(`${this.apiBase}/get_login_info`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(8000)
      })
      const data = await response.json()
      if (data.status === 'ok') {
        return {
          userId: data.data.user_id,
          nickname: data.data.nickname
        }
      }
      return null
    } catch (error) {
      console.error('[QQService] getLoginInfo error:', error)
      return null
    }
  }

  async getGroupList(): Promise<QQGroupInfo[]> {
    try {
      const response = await fetch(`${this.apiBase}/get_group_list`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(8000)
      })
      const data = await response.json()
      if (data.status === 'ok' && Array.isArray(data.data)) {
        return data.data.map((group: any) => ({
          groupId: group.group_id,
          groupName: group.group_name,
          memberCount: group.member_count
        }))
      }
      return []
    } catch (error) {
      console.error('[QQService] getGroupList error:', error)
      return []
    }
  }

  async getGroupMembers(groupId: number): Promise<QQGroupMember[]> {
    try {
      const response = await fetch(`${this.apiBase}/get_group_member_list`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ group_id: groupId }),
        signal: AbortSignal.timeout(8000)
      })
      const data = await response.json()
      if (data.status === 'ok' && Array.isArray(data.data)) {
        return data.data.map((member: any) => ({
          userId: member.user_id,
          nickname: member.nickname,
          card: member.card || ''
        }))
      }
      return []
    } catch (error) {
      console.error('[QQService] getGroupMembers error:', error)
      return []
    }
  }

  private mapOneMessage(msg: any, groupId: number): QQMessage {
    return {
      messageId: msg.message_id,
      userId: msg.user_id,
      groupId: msg.group_id || groupId,
      message: this.extractMessageText(msg.message),
      rawMessage: msg.raw_message || '',
      sender: {
        userId: msg.sender?.user_id || msg.user_id,
        nickname: msg.sender?.nickname || ''
      },
      time: msg.time
    }
  }

  private async fetchHistoryPage(
    groupId: number,
    body: Record<string, unknown>
  ): Promise<any[]> {
    const response = await fetch(`${this.apiBase}/get_group_msg_history`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ group_id: groupId, ...body }),
      signal: AbortSignal.timeout(15000)
    })
    const data = await response.json()
    // SnowLuma 返回 data.messages（复数），NapCat 返回 data.message（单数）
    const list = data.data?.messages ?? data.data?.message
    return Array.isArray(list) ? list : []
  }

  async getGroupMessages(
    groupId: number,
    count: number = 20
  ): Promise<QQMessage[]> {
    try {
      const list = await this.fetchHistoryPage(groupId, { count })
      return list.map((msg) => this.mapOneMessage(msg, groupId))
    } catch (error) {
      console.error('[QQService] getGroupMessages error:', error)
      return []
    }
  }

  /**
   * 按日期范围 / 全量拉取群历史。SnowLuma 每页上限 200，靠最早一条的
   * message_id 作锚点向前翻页，直到触达起始时间、缓存到头或达到 maxCount。
   * startTime / endTime 为秒级时间戳（Unix seconds），可选。
   */
  async getGroupMessagesRange(
    groupId: number,
    opts: { startTime?: number; endTime?: number; maxCount?: number } = {}
  ): Promise<QQMessage[]> {
    const maxCount = opts.maxCount && opts.maxCount > 0 ? opts.maxCount : 2000
    const collected = new Map<number, QQMessage>()
    let anchorId: number | undefined
    try {
      for (let page = 0; page < 40; page++) {
        const body: Record<string, unknown> = { count: 200 }
        if (anchorId !== undefined) body.message_id = anchorId
        const list = await this.fetchHistoryPage(groupId, body)
        if (list.length === 0) break
        let reachedStart = false
        for (const msg of list) {
          const t = msg.time as number
          if (opts.endTime && t > opts.endTime) continue
          if (opts.startTime && t < opts.startTime) {
            reachedStart = true
            continue
          }
          const mapped = this.mapOneMessage(msg, groupId)
          collected.set(mapped.messageId, mapped)
        }
        // 本页最早一条（数组按时间升序）作为下一页锚点
        const pageOldestId = list[0]?.message_id as number | undefined
        if (pageOldestId === undefined || pageOldestId === anchorId) break
        anchorId = pageOldestId
        if (list.length < 200) break // 已到缓存头部
        if (reachedStart) break // 已翻到起始时间之前
        if (collected.size >= maxCount) break
      }
    } catch (error) {
      console.error('[QQService] getGroupMessagesRange error:', error)
    }
    // 超上限时保留"最新"的 maxCount 条（先按时间降序取前 N，再升序返回）
    return [...collected.values()]
      .sort((a, b) => b.time - a.time)
      .slice(0, maxCount)
      .sort((a, b) => a.time - b.time)
  }

  private extractMessageText(message: any[]): string {
    if (!Array.isArray(message)) return ''
    return message
      .map((seg) => {
        if (seg.type === 'text') {
          return seg.data?.text || ''
        } else if (seg.type === 'face') {
          return `[表情${seg.data?.id || ''}]`
        } else if (seg.type === 'image') {
          return '[图片]'
        } else if (seg.type === 'record') {
          return '[语音]'
        } else if (seg.type === 'video') {
          return '[视频]'
        } else if (seg.type === 'at') {
          return `@${seg.data?.qq || ''}`
        } else if (seg.type === 'reply') {
          return '[回复]'
        }
        return ''
      })
      .join('')
  }

  // Convert QQ messages to the shared Message type for compatibility
  toSharedMessages(qqMessages: QQMessage[], selfUserId: number): Message[] {
    return qqMessages.map((msg) => ({
      id: `qq-${msg.messageId}`,
      from: msg.sender.userId === selfUserId ? 'self' : 'other',
      type: '文本',
      datetime: new Date(msg.time * 1000).toLocaleString('zh-CN', { hour12: false }),
      content: msg.message,
      isSender: msg.sender.userId === selfUserId,
      name: msg.sender.nickname,
      senderId: String(msg.sender.userId),
      contentData: { type: 'text', content: msg.message },
      createTime: msg.time,
      sessionId: String(msg.groupId)
    }))
  }

  // Convert QQ groups to the shared Contact type for compatibility
  toSharedContacts(groups: QQGroupInfo[]): Contact[] {
    return groups.map((group) => ({
      m_nsUsrName: String(group.groupId),
      m_nsNickName: group.groupName,
      md5: '',
      type: 'group',
      isOfficialAccount: false,
      avatar: '',
      wechatNickname: '',
      remark: '',
      alias: '',
      wechatId: '',
      wxid: String(group.groupId),
      legacyIdentifier: '',
      isFolded: false,
      isMuted: false
    }))
  }
}

export const qqService = new QQService()
