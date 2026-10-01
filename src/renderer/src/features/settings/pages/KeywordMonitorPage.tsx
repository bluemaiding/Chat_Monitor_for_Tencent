import { useEffect, useState } from 'react'
import { Button, Input, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui'
import type { KeywordMonitorState } from '../../../../../shared/keyword-monitor'

export function KeywordMonitorPage({
  onNotice
}: {
  onNotice: (message: string) => void
}): React.ReactElement {
  const [state, setState] = useState<KeywordMonitorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [newWxid, setNewWxid] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [showAddKeywordDialog, setShowAddKeywordDialog] = useState(false)
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'keywords' | 'members' | 'events'>('keywords')

  const loadState = async () => {
    try {
      const data = await window.api.getKeywordMonitorState()
      setState(data)
    } catch (error) {
      console.error('Failed to load keyword monitor state:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      const newState = await window.api.setKeywordMonitorEnabled(enabled)
      setState(newState)
      onNotice(enabled ? '关键词监控已启用' : '关键词监控已禁用')
    } catch (error) {
      onNotice('操作失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      onNotice('请输入关键词')
      return
    }

    try {
      const newState = await window.api.addKeyword(newKeyword.trim(), false, false)
      setState(newState)
      setNewKeyword('')
      setShowAddKeywordDialog(false)
      onNotice('关键词添加成功')
    } catch (error) {
      onNotice('添加失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleRemoveKeyword = async (id: string) => {
    try {
      const newState = await window.api.removeKeyword(id)
      setState(newState)
      onNotice('关键词已删除')
    } catch (error) {
      onNotice('删除失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleAddMember = async () => {
    if (!newWxid.trim()) {
      onNotice('请输入微信号ID')
      return
    }

    try {
      const newState = await window.api.addMember(
        newWxid.trim(),
        newNickname.trim() || undefined,
        undefined,
        undefined
      )
      setState(newState)
      setNewWxid('')
      setNewNickname('')
      setShowAddMemberDialog(false)
      onNotice('成员添加成功')
    } catch (error) {
      onNotice('添加失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleRemoveMember = async (id: string) => {
    try {
      const newState = await window.api.removeMember(id)
      setState(newState)
      onNotice('成员已删除')
    } catch (error) {
      onNotice('删除失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleClearEvents = async () => {
    try {
      const newState = await window.api.clearKeywordMonitorEvents()
      setState(newState)
      onNotice('事件已清空')
    } catch (error) {
      onNotice('清空失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleMarkRead = async () => {
    try {
      const newState = await window.api.markKeywordMonitorEventsRead()
      setState(newState)
      onNotice('已标记为已读')
    } catch (error) {
      onNotice('操作失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="settings-page">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">加载失败</p>
        </div>
      </div>
    )
  }

  const unreadCount = state.events.filter(e => !e.read).length

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <div>
          <h1>关键词监控</h1>
          <p>关注特定词汇和成员的消息动态</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {state.enabled ? '已启用' : '已禁用'}
          </span>
          <Switch
            checked={state.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>
      </header>

      <div className="settings-page-scroll">
        <div className="settings-page-content">
          {/* Tab 导航 */}
          <div className="flex gap-2 mb-4 border-b">
            <button
              className={`px-4 py-2 ${activeTab === 'keywords' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-600'}`}
              onClick={() => setActiveTab('keywords')}
            >
              关注词 ({state.keywords.length})
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'members' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-600'}`}
              onClick={() => setActiveTab('members')}
            >
              关注成员 ({state.members.length})
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'events' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-600'}`}
              onClick={() => setActiveTab('events')}
            >
              监控事件 ({state.events.length}{unreadCount > 0 ? `, ${unreadCount} 未读` : ''})
            </button>
          </div>

          {/* 关注词标签页 */}
          {activeTab === 'keywords' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">关注词列表</h2>
                <Dialog open={showAddKeywordDialog} onOpenChange={setShowAddKeywordDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">添加关注词</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加关注词</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">关键词</label>
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="输入要监控的关键词"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowAddKeywordDialog(false)}>
                          取消
                        </Button>
                        <Button onClick={handleAddKeyword}>确定</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {state.keywords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无关注词，点击右上角添加
                </div>
              ) : (
                <div className="space-y-2">
                  {state.keywords.map((kw) => (
                    <div key={kw.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{kw.keyword}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          命中 {kw.hitCount} 次 · 添加于 {new Date(kw.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveKeyword(kw.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 关注成员标签页 */}
          {activeTab === 'members' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">关注成员列表</h2>
                <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">添加成员</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加关注成员</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">微信ID (wxid)</label>
                        <Input
                          value={newWxid}
                          onChange={(e) => setNewWxid(e.target.value)}
                          placeholder="例如: wxid_xxxxxxxxxxxx"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">昵称（可选）</label>
                        <Input
                          value={newNickname}
                          onChange={(e) => setNewNickname(e.target.value)}
                          placeholder="用于显示的名称"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                          取消
                        </Button>
                        <Button onClick={handleAddMember}>确定</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {state.members.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无关注成员，点击右上角添加
                </div>
              ) : (
                <div className="space-y-2">
                  {state.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{member.nickname || member.wxid}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          wxid: {member.wxid} · {member.messageCount} 条消息
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 监控事件标签页 */}
          {activeTab === 'events' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">监控事件</h2>
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={handleMarkRead}>
                      全部标为已读
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleClearEvents}>
                    清空事件
                  </Button>
                </div>
              </div>

              {state.events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无监控事件
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {state.events.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded border ${
                        event.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              event.type === 'keyword' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {event.type === 'keyword' ? '关键词' : '关注成员'}
                            </span>
                            <span className="font-medium text-sm">{event.triggerValue}</span>
                          </div>
                          <div className="text-sm text-gray-700 mt-1">{event.content}</div>
                          <div className="text-xs text-gray-500 mt-2">
                            {event.roomName && `群聊: ${event.roomName} · `}
                            发送者: {event.senderNickname || event.senderWxid} · 
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
