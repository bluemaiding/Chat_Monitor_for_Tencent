import { app } from 'electron'
import fs from 'fs-extra'
import path from 'path'

export interface QQWatchedGroup {
  groupId: number
  groupName: string
  addedAt: number
}

export interface QQWatchedMember {
  userId: number
  nickname: string
  addedAt: number
}

export interface QQWatchState {
  watchedGroups: QQWatchedGroup[]
  watchedMembers: QQWatchedMember[]
}

const WATCH_FILE = path.join(app.getPath('userData'), 'qq-watch.json')

const EMPTY_STATE: QQWatchState = { watchedGroups: [], watchedMembers: [] }

class QQWatchService {
  private state: QQWatchState = { ...EMPTY_STATE }
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    try {
      if (await fs.pathExists(WATCH_FILE)) {
        const data = await fs.readJson(WATCH_FILE)
        this.state = {
          watchedGroups: Array.isArray(data.watchedGroups) ? data.watchedGroups : [],
          watchedMembers: Array.isArray(data.watchedMembers) ? data.watchedMembers : []
        }
      }
    } catch (error) {
      console.error('[QQWatch] Failed to load state:', error)
    }
    this.initialized = true
  }

  private async save(): Promise<void> {
    try {
      await fs.writeJson(WATCH_FILE, this.state, { spaces: 2 })
    } catch (error) {
      console.error('[QQWatch] Failed to save state:', error)
    }
  }

  getState(): QQWatchState {
    return {
      watchedGroups: [...this.state.watchedGroups],
      watchedMembers: [...this.state.watchedMembers]
    }
  }

  async addWatchedGroup(groupId: number, groupName: string): Promise<QQWatchState> {
    if (!this.state.watchedGroups.some((g) => g.groupId === groupId)) {
      this.state.watchedGroups.push({ groupId, groupName, addedAt: Date.now() })
      await this.save()
    }
    return this.getState()
  }

  async removeWatchedGroup(groupId: number): Promise<QQWatchState> {
    this.state.watchedGroups = this.state.watchedGroups.filter((g) => g.groupId !== groupId)
    await this.save()
    return this.getState()
  }

  async addWatchedMember(userId: number, nickname: string): Promise<QQWatchState> {
    if (!this.state.watchedMembers.some((m) => m.userId === userId)) {
      this.state.watchedMembers.push({ userId, nickname, addedAt: Date.now() })
      await this.save()
    }
    return this.getState()
  }

  async removeWatchedMember(userId: number): Promise<QQWatchState> {
    this.state.watchedMembers = this.state.watchedMembers.filter((m) => m.userId !== userId)
    await this.save()
    return this.getState()
  }
}

export const qqWatchService = new QQWatchService()
