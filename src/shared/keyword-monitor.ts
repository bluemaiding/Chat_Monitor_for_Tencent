/**
 * 关键词监控功能 - 关注词和关注成员管理
 */

export interface KeywordMonitorKeyword {
  id: string
  keyword: string
  /** 是否启用正则表达式匹配 */
  useRegex?: boolean
  /** 是否区分大小写 */
  caseSensitive?: boolean
  /** 添加时间 */
  createdAt: number
  /** 命中次数 */
  hitCount: number
}

export interface KeywordMonitorMember {
  id: string
  wxid: string
  nickname?: string
  remark?: string
  avatar?: string
  /** 添加时间 */
  createdAt: number
  /** 消息计数 */
  messageCount: number
}

export interface KeywordMonitorEvent {
  id: string
  type: 'keyword' | 'member'
  /** 触发ID（keyword ID 或 member wxid） */
  triggerId: string
  /** 触发的关键词或成员昵称 */
  triggerValue: string
  /** 消息来源群聊 */
  roomId?: string
  roomName?: string
  /** 消息发送者 */
  senderWxid: string
  senderNickname?: string
  /** 消息内容 */
  content: string
  /** 消息时间 */
  timestamp: number
  /** 已读状态 */
  read: boolean
}

export interface KeywordMonitorRoom {
  id: string
  /** 群标识：md5 或 m_nsUsrName(@chatroom) */
  roomKey: string
  name?: string
  createdAt: number
}

export interface KeywordMonitorState {
  enabled: boolean
  keywords: KeywordMonitorKeyword[]
  members: KeywordMonitorMember[]
  /** 监听的微信会话（置顶用） */
  watchedRooms: KeywordMonitorRoom[]
  events: KeywordMonitorEvent[]
  /** 最大保留事件数 */
  maxEvents: number
  /** 最后检查时间 */
  lastCheckAt?: number
}

export const DEFAULT_KEYWORD_MONITOR_STATE: KeywordMonitorState = {
  enabled: false,
  keywords: [],
  members: [],
  watchedRooms: [],
  events: [],
  maxEvents: 500
}

/**
 * 验证关键词是否有效
 */
export function validateKeyword(keyword: string): { valid: boolean; error?: string } {
  if (!keyword || keyword.trim().length === 0) {
    return { valid: false, error: '关键词不能为空' }
  }
  if (keyword.length > 100) {
    return { valid: false, error: '关键词长度不能超过100个字符' }
  }
  return { valid: true }
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 检查文本是否匹配关键词
 */
export function matchesKeyword(
  text: string,
  keyword: KeywordMonitorKeyword
): boolean {
  if (!text) return false

  const searchTarget = keyword.caseSensitive ? text : text.toLowerCase()
  const searchKeyword = keyword.caseSensitive ? keyword.keyword : keyword.keyword.toLowerCase()

  if (keyword.useRegex) {
    try {
      const regex = new RegExp(searchKeyword, keyword.caseSensitive ? '' : 'i')
      return regex.test(text)
    } catch {
      // 正则表达式无效，回退到普通匹配
      return searchTarget.includes(searchKeyword)
    }
  }

  return searchTarget.includes(searchKeyword)
}
