import { app } from 'electron'
import fs from 'fs-extra'
import path from 'path'
import {
  DEFAULT_KEYWORD_MONITOR_STATE,
  generateId,
  matchesKeyword,
  type KeywordMonitorEvent,
  type KeywordMonitorKeyword,
  type KeywordMonitorMember,
  type KeywordMonitorState
} from '../../shared/keyword-monitor'

const KEYWORD_MONITOR_FILE = path.join(app.getPath('userData'), 'keyword-monitor.json')

class KeywordMonitorService {
  private state: KeywordMonitorState = { ...DEFAULT_KEYWORD_MONITOR_STATE }
  private initialized = false

  /**
   * 初始化服务，从文件加载状态
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      const exists = await fs.pathExists(KEYWORD_MONITOR_FILE)
      if (exists) {
        const data = await fs.readJson(KEYWORD_MONITOR_FILE)
        this.state = {
          ...DEFAULT_KEYWORD_MONITOR_STATE,
          ...data,
          keywords: data.keywords || [],
          members: data.members || [],
          watchedRooms: data.watchedRooms || [],
          events: data.events || []
        }
      }
    } catch (error) {
      console.error('[KeywordMonitor] Failed to load state:', error)
    }
    
    this.initialized = true
  }

  /**
   * 保存状态到文件
   */
  private async save(): Promise<void> {
    try {
      await fs.writeJson(KEYWORD_MONITOR_FILE, this.state, { spaces: 2 })
    } catch (error) {
      console.error('[KeywordMonitor] Failed to save state:', error)
    }
  }

  /**
   * 获取当前状态
   */
  getState(): KeywordMonitorState {
    return { ...this.state }
  }

  /**
   * 启用/禁用监控
   */
  async setEnabled(enabled: boolean): Promise<KeywordMonitorState> {
    this.state.enabled = enabled
    await this.save()
    return this.getState()
  }

  /**
   * 添加关注词
   */
  async addKeyword(keyword: string, useRegex?: boolean, caseSensitive?: boolean): Promise<KeywordMonitorState> {
    // 检查是否已存在
    const exists = this.state.keywords.some(k => k.keyword === keyword)
    if (exists) {
      throw new Error('该关键词已存在')
    }

    const newKeyword: KeywordMonitorKeyword = {
      id: generateId(),
      keyword,
      useRegex: useRegex || false,
      caseSensitive: caseSensitive || false,
      createdAt: Date.now(),
      hitCount: 0
    }

    this.state.keywords.push(newKeyword)
    await this.save()
    return this.getState()
  }

  /**
   * 删除关注词
   */
  async removeKeyword(id: string): Promise<KeywordMonitorState> {
    this.state.keywords = this.state.keywords.filter(k => k.id !== id)
    await this.save()
    return this.getState()
  }

  /**
   * 添加关注成员
   */
  async addMember(wxid: string, nickname?: string, remark?: string, avatar?: string): Promise<KeywordMonitorState> {
    // 检查是否已存在
    const exists = this.state.members.some(m => m.wxid === wxid)
    if (exists) {
      throw new Error('该成员已在关注列表中')
    }

    const newMember: KeywordMonitorMember = {
      id: generateId(),
      wxid,
      nickname,
      remark,
      avatar,
      createdAt: Date.now(),
      messageCount: 0
    }

    this.state.members.push(newMember)
    await this.save()
    return this.getState()
  }

  /**
   * 删除关注成员
   */
  async removeMember(id: string): Promise<KeywordMonitorState> {
    this.state.members = this.state.members.filter(m => m.id !== id)
    await this.save()
    return this.getState()
  }

  /**
   * 添加监听会话（置顶用）
   */
  async addWatchedRoom(roomKey: string, name?: string): Promise<KeywordMonitorState> {
    if (!roomKey) return this.getState()
    const exists = this.state.watchedRooms.some((r) => r.roomKey === roomKey)
    if (!exists) {
      this.state.watchedRooms.push({
        id: generateId(),
        roomKey,
        name,
        createdAt: Date.now()
      })
      await this.save()
    }
    return this.getState()
  }

  /**
   * 移除监听会话
   */
  async removeWatchedRoom(roomKey: string): Promise<KeywordMonitorState> {
    this.state.watchedRooms = this.state.watchedRooms.filter((r) => r.roomKey !== roomKey)
    await this.save()
    return this.getState()
  }

  /**
   * 处理新消息，检测是否匹配关注词或来自关注成员
   */
  async processMessage(
    roomId: string | undefined,
    roomName: string | undefined,
    senderWxid: string,
    senderNickname: string | undefined,
    content: string
  ): Promise<void> {
    if (!this.state.enabled) return

    const timestamp = Date.now()
    const newEvents: KeywordMonitorEvent[] = []

    // 检查是否匹配关注词
    for (const keyword of this.state.keywords) {
      if (matchesKeyword(content, keyword)) {
        keyword.hitCount++
        
        const event: KeywordMonitorEvent = {
          id: generateId(),
          type: 'keyword',
          triggerId: keyword.id,
          triggerValue: keyword.keyword,
          roomId,
          roomName,
          senderWxid,
          senderNickname,
          content,
          timestamp,
          read: false
        }
        
        newEvents.push(event)
      }
    }

    // 检查是否来自关注成员
    const matchedMember = this.state.members.find(m => m.wxid === senderWxid)
    if (matchedMember) {
      matchedMember.messageCount++
      
      const event: KeywordMonitorEvent = {
        id: generateId(),
        type: 'member',
        triggerId: matchedMember.id,
        triggerValue: matchedMember.nickname || senderNickname || senderWxid,
        roomId,
        roomName,
        senderWxid,
        senderNickname,
        content,
        timestamp,
        read: false
      }
      
      newEvents.push(event)
    }

    // 添加新事件
    if (newEvents.length > 0) {
      this.state.events.unshift(...newEvents)
      
      // 限制事件数量
      if (this.state.events.length > this.state.maxEvents) {
        this.state.events = this.state.events.slice(0, this.state.maxEvents)
      }
      
      this.state.lastCheckAt = timestamp
      await this.save()
    }
  }

  /**
   * 标记事件为已读
   */
  async markEventsRead(eventIds?: string[]): Promise<KeywordMonitorState> {
    if (eventIds && eventIds.length > 0) {
      for (const event of this.state.events) {
        if (eventIds.includes(event.id)) {
          event.read = true
        }
      }
    } else {
      // 标记所有事件为已读
      for (const event of this.state.events) {
        event.read = true
      }
    }
    
    await this.save()
    return this.getState()
  }

  /**
   * 清除所有事件
   */
  async clearEvents(): Promise<KeywordMonitorState> {
    this.state.events = []
    await this.save()
    return this.getState()
  }

  /**
   * 更新最大事件数
   */
  async setMaxEvents(maxEvents: number): Promise<KeywordMonitorState> {
    this.state.maxEvents = Math.max(10, Math.min(5000, maxEvents))
    
    // 裁剪事件列表
    if (this.state.events.length > this.state.maxEvents) {
      this.state.events = this.state.events.slice(0, this.state.maxEvents)
    }
    
    await this.save()
    return this.getState()
  }
}

export const keywordMonitorService = new KeywordMonitorService()
