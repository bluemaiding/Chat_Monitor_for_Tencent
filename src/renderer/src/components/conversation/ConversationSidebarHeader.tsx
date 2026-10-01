import React from 'react'
import { IconButton } from '../ui'
import { ConversationSearch } from './ConversationSearch'
import type { ArchiveFilter } from './ConversationSidebar'

interface ConversationSidebarHeaderProps {
  totalCount: number
  searchValue: string
  onSearchChange: (value: string) => void
  refreshing: boolean
  onRefresh: () => void
  archiveFilter?: ArchiveFilter
  onArchiveFilterChange?: (filter: ArchiveFilter) => void
  watchedCount?: number
}

const FILTERS: { key: ArchiveFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'group', label: '只看群' },
  { key: 'watched', label: '只看监听' }
]

export function ConversationSidebarHeader({
  totalCount,
  searchValue,
  onSearchChange,
  refreshing,
  onRefresh,
  archiveFilter = 'all',
  onArchiveFilterChange,
  watchedCount = 0
}: ConversationSidebarHeaderProps): React.ReactElement {
  return (
    <div className="conversation-sidebar-header">
      <div className="conversation-sidebar-title-row">
        <h2>聊天档案</h2>
        <div className="conversation-sidebar-meta">
          <span>{totalCount} 个会话</span>
          <IconButton
            variant="ghost"
            className={`conversation-refresh-button ${refreshing ? 'is-refreshing' : ''}`}
            label={refreshing ? '正在刷新会话列表' : '刷新会话列表'}
            title={refreshing ? '正在刷新…' : '刷新会话列表'}
            disabled={refreshing}
            onClick={onRefresh}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M16.1 6.2A7 7 0 1 0 17 12h-2a5 5 0 1 1-.7-3.4L12 11h6V5l-1.9 1.2Z" />
            </svg>
          </IconButton>
        </div>
      </div>
      <ConversationSearch value={searchValue} onChange={onSearchChange} />
      {onArchiveFilterChange && (
        <div className="conversation-filter-row" role="group" aria-label="会话筛选">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`conversation-filter-chip ${archiveFilter === f.key ? 'is-active' : ''}`}
              onClick={() => onArchiveFilterChange(f.key)}
            >
              {f.label}
              {f.key === 'watched' && watchedCount > 0 ? ` (${watchedCount})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
