import { useEffect, useState, useCallback } from 'react'
import { Button, Input } from '../../components/ui'

interface QQGroup {
  groupId: number
  groupName: string
  memberCount: number
}

interface QQMessage {
  messageId: number
  sender: {
    userId: number
    nickname: string
  }
  message: string
  time: number
}

interface SnowLumaStatus {
  installed: boolean
  installPath: string
  running: boolean
  pid: number | null
  apiBase: string
  owned?: boolean
  lastError?: string
}

interface QQWatchedGroup {
  groupId: number
  groupName: string
  addedAt: number
}

interface QQWatchedMember {
  userId: number
  nickname: string
  addedAt: number
}

interface ReportSection {
  key: string
  label: string
  instruction: string
}

const REPORT_SECTIONS: ReportSection[] = [
  { key: 'topics', label: '话题热点', instruction: '主要话题与热点：大家在聊什么，按热度从高到低列出' },
  { key: 'keyPoints', label: '关键结论', instruction: '关键信息与结论：有什么值得记住的事实、观点、决定' },
  { key: 'todos', label: '待办行动', instruction: '待办/行动项：谁要做什么、有没有截止时间（没有就写"无"）' },
  { key: 'risks', label: '风险预警', instruction: '风险与预警：争议、负面情绪、需要留意的事情（没有就写"无"）' },
  { key: 'timeline', label: '时间线', instruction: '时间线：按时间顺序梳理事件脉络，每条标注大致时间' },
  { key: 'members', label: '成员动态', instruction: '成员动态：谁最活跃、谁提出了重要观点或发起了话题' },
  { key: 'mood', label: '整体氛围', instruction: '整体氛围：用一两句话概括聊天气氛' }
]

const DEFAULT_SECTION_KEYS = ['topics', 'keyPoints', 'todos', 'mood']

const REPORT_TEMPLATES = [
  { key: 'brief', label: '简报', directive: '风格：简报。每个板块 2-4 条精炼要点，尽量短，不引用原话。' },
  { key: 'detailed', label: '详细', directive: '风格：详细。每个板块充分展开，可适当引用关键原话佐证。' },
  { key: 'daily', label: '日报式', directive: '风格：日报。先给一个总标题和一句话摘要，再分板块小结，条理清晰，适合直接转发。' }
] as const

export function QQWorkspace(): React.ReactElement {
  const [apiBase, setApiBase] = useState('http://127.0.0.1:3000')
  const [apiToken, setApiToken] = useState('')
  const [connected, setConnected] = useState(false)
  const [loginInfo, setLoginInfo] = useState<any>(null)
  const [groups, setGroups] = useState<QQGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [selectedGroupName, setSelectedGroupName] = useState<string>('')
  const [messages, setMessages] = useState<QQMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [snowStatus, setSnowStatus] = useState<SnowLumaStatus | null>(null)
  const [snowBusy, setSnowBusy] = useState(false)
  const [installPathInput, setInstallPathInput] = useState('')
  const [snowLogs, setSnowLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<string>('')
  const [aiError, setAiError] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fetchCount, setFetchCount] = useState(500)
  const [fetchingRange, setFetchingRange] = useState(false)
  const [rangeNote, setRangeNote] = useState('')
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTION_KEYS)
  const [template, setTemplate] = useState<string>('brief')
  const [copied, setCopied] = useState(false)
  const [watchedGroups, setWatchedGroups] = useState<QQWatchedGroup[]>([])
  const [watchedMembers, setWatchedMembers] = useState<QQWatchedMember[]>([])
  const [groupFilter, setGroupFilter] = useState('')
  const [watchTab, setWatchTab] = useState<'groups' | 'members'>('groups')

  const refreshWatch = useCallback(async () => {
    try {
      if (typeof window.api?.qqGetWatchState !== 'function') return
      const s = await window.api.qqGetWatchState()
      setWatchedGroups(s.watchedGroups || [])
      setWatchedMembers(s.watchedMembers || [])
    } catch (err) {
      console.error('Failed to get QQ watch state:', err)
    }
  }, [])

  useEffect(() => {
    void refreshWatch()
  }, [refreshWatch])

  const watchedGroupIds = new Set(watchedGroups.map((g) => g.groupId))
  const watchedMemberIds = new Set(watchedMembers.map((m) => m.userId))

  const toggleWatchGroup = async (groupId: number, groupName: string): Promise<void> => {
    if (typeof window.api?.qqAddWatchedGroup !== 'function') return
    const s = watchedGroupIds.has(groupId)
      ? await window.api.qqRemoveWatchedGroup(groupId)
      : await window.api.qqAddWatchedGroup(groupId, groupName)
    setWatchedGroups(s.watchedGroups || [])
    setWatchedMembers(s.watchedMembers || [])
  }

  const toggleWatchMember = async (userId: number, nickname: string): Promise<void> => {
    if (typeof window.api?.qqAddWatchedMember !== 'function') return
    const s = watchedMemberIds.has(userId)
      ? await window.api.qqRemoveWatchedMember(userId)
      : await window.api.qqAddWatchedMember(userId, nickname)
    setWatchedGroups(s.watchedGroups || [])
    setWatchedMembers(s.watchedMembers || [])
  }

  const toggleSection = (key: string): void => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const refreshLogs = useCallback(async () => {
    try {
      if (typeof window.api?.snowlumaGetLogs !== 'function') return
      const r = await window.api.snowlumaGetLogs()
      setSnowLogs(r.logs || [])
    } catch (err) {
      console.error('Failed to get SnowLuma logs:', err)
    }
  }, [])

  const refreshSnowStatus = useCallback(async () => {
    try {
      if (typeof window.api?.snowlumaGetStatus !== 'function') return
      const s = await window.api.snowlumaGetStatus()
      setSnowStatus(s)
      setInstallPathInput(s.installPath)
    } catch (err) {
      console.error('Failed to get SnowLuma status:', err)
    }
  }, [])

  useEffect(() => {
    void refreshSnowStatus()
    if (typeof window.api?.getQQApiBase === 'function') {
      void window.api
        .getQQApiBase()
        .then((result) => {
          if (result.apiBase) setApiBase(result.apiBase)
        })
        .catch((err) => console.error('Failed to get QQ API base:', err))
    }
    if (typeof window.api?.getQQApiToken === 'function') {
      void window.api
        .getQQApiToken()
        .then((result) => {
          if (result.token) setApiToken(result.token)
        })
        .catch((err) => console.error('Failed to get QQ API token:', err))
    }
    const t = setInterval(() => {
      void refreshSnowStatus()
      if (showLogs) void refreshLogs()
    }, 5000)
    return () => clearInterval(t)
  }, [refreshSnowStatus, refreshLogs, showLogs])

  const handleStartSnow = async (): Promise<void> => {
    setSnowBusy(true)
    try {
      if (installPathInput && installPathInput !== snowStatus?.installPath) {
        await window.api.snowlumaSetInstallPath(installPathInput)
      }
      const s = await window.api.snowlumaStart()
      setSnowStatus(s)
    } finally {
      setSnowBusy(false)
      void refreshSnowStatus()
    }
  }

  const handleStopSnow = async (): Promise<void> => {
    setSnowBusy(true)
    try {
      const s = await window.api.snowlumaStop()
      setSnowStatus(s)
    } finally {
      setSnowBusy(false)
      void refreshSnowStatus()
    }
  }

  const handleOpenInstallDir = async (): Promise<void> => {
    await window.api.snowlumaOpenInstallDir()
  }

  const testConnection = async (): Promise<void> => {
    setLoading(true)
    try {
      await window.api.setQQApiBase(apiBase)
      if (typeof window.api.setQQApiToken === 'function') {
        await window.api.setQQApiToken(apiToken)
      }
      const result = await window.api.testQQConnection()
      setConnected(result.success)
      if (result.success) {
        const login = await window.api.getQQLoginInfo()
        setLoginInfo(login)
        const groupList = await window.api.getQQGroupList()
        setGroups(groupList || [])
      }
    } catch (error) {
      console.error('Connection failed:', error)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (groupId: number, groupName: string): Promise<void> => {
    setSelectedGroup(groupId)
    setSelectedGroupName(groupName)
    setAiResult('')
    setAiError('')
    setLoading(true)
    try {
      const msgs = await window.api.getQQGroupMessages(groupId, 50)
      setMessages(msgs || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRange = async (mode: 'range' | 'all'): Promise<void> => {
    if (selectedGroup === null) return
    setFetchingRange(true)
    setAiResult('')
    setAiError('')
    setRangeNote('')
    try {
      let startTime: number | undefined
      let endTime: number | undefined
      if (mode === 'range') {
        if (!startDate && !endDate) {
          setRangeNote('请先选择开始或结束日期')
          setFetchingRange(false)
          return
        }
        if (startDate) startTime = Math.floor(new Date(startDate + 'T00:00:00').getTime() / 1000)
        if (endDate) endTime = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000)
      }
      const msgs = await window.api.getQQGroupMessagesRange(selectedGroup, {
        startTime,
        endTime,
        maxCount: 5000
      })
      const arr = msgs || []
      setMessages(arr)
      const oldest = arr[0] ? new Date(arr[0].time * 1000).toLocaleDateString('zh-CN') : ''
      const newest = arr.length ? new Date(arr[arr.length - 1].time * 1000).toLocaleDateString('zh-CN') : ''
      setRangeNote(`已拉取 ${arr.length} 条（本地缓存范围 ${oldest} ~ ${newest}）`)
    } catch (error) {
      console.error('Failed to load range:', error)
      setRangeNote('拉取失败')
    } finally {
      setFetchingRange(false)
    }
  }

  // 拉取最近 N 条（点"拉取条数"即触发）
  const fetchRecent = async (n: number): Promise<void> => {
    if (selectedGroup === null) return
    setFetchCount(n)
    setFetchingRange(true)
    setAiResult('')
    setAiError('')
    setRangeNote('')
    try {
      const msgs = await window.api.getQQGroupMessagesRange(selectedGroup, { maxCount: n })
      const arr = msgs || []
      setMessages(arr)
      setRangeNote(`已拉取最近 ${arr.length} 条`)
    } catch (error) {
      console.error('Failed to fetch recent:', error)
      setRangeNote('拉取失败')
    } finally {
      setFetchingRange(false)
    }
  }

  // 快捷日期预设：days=1 今天，3 近三天，7 近一周
  const loadQuick = async (days: number): Promise<void> => {
    if (selectedGroup === null) return
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    const fmt = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setStartDate(fmt(start))
    setEndDate(fmt(now))
    setFetchingRange(true)
    setAiResult('')
    setAiError('')
    setRangeNote('')
    try {
      const msgs = await window.api.getQQGroupMessagesRange(selectedGroup, {
        startTime: Math.floor(start.getTime() / 1000),
        endTime: Math.floor(now.getTime() / 1000),
        maxCount: 5000
      })
      const arr = msgs || []
      setMessages(arr)
      setRangeNote(
        arr.length === 0
          ? `近 ${days} 天内无消息（那几天没聊，或 QQ 本地缓存里没有）`
          : `已拉取 ${arr.length} 条（近 ${days} 天全部）`
      )
    } catch (error) {
      console.error('Failed to load quick range:', error)
      setRangeNote('拉取失败')
    } finally {
      setFetchingRange(false)
    }
  }

  const handleAnalyzeGroup = async (): Promise<void> => {
    if (messages.length === 0) return
    const chosen = REPORT_SECTIONS.filter((s) => sections.includes(s.key))
    if (chosen.length === 0) {
      setAiError('请至少勾选一个分析板块')
      return
    }
    setAiAnalyzing(true)
    setAiError('')
    setAiResult('')
    setCopied(false)
    try {
      const AI_CAP = 1000
      const used = messages.length > AI_CAP ? messages.slice(-AI_CAP) : messages
      const truncated = messages.length - used.length
      const transcript = used
        .map((m) => {
          const t = new Date(m.time * 1000).toLocaleString('zh-CN', { hour12: false })
          return `[${t}] ${m.sender.nickname || '匿名'}: ${m.message}`
        })
        .join('\n')
      const tpl = REPORT_TEMPLATES.find((t) => t.key === template) || REPORT_TEMPLATES[0]
      const sectionLines = chosen
        .map((s, i) => `${i + 1}. ${s.label}：${s.instruction}`)
        .join('\n')
      const prompt =
        `以下是 QQ 群「${selectedGroupName}」的聊天记录（按时间从早到晚，共 ${used.length} 条` +
        (truncated > 0 ? `，已截取最近 ${AI_CAP} 条，更早的 ${truncated} 条略去` : '') +
        `）：\n\n` +
        transcript +
        `\n\n请用中文分析这段聊天记录，只输出以下板块（每个板块用 "## 板块名" 作为小标题）：\n` +
        sectionLines +
        `\n\n${tpl.directive}\n直接输出正文，不要复述本提示词。`
      const res = await window.api.aiChat([{ role: 'user', content: prompt }])
      if (res.success && res.data) {
        setAiResult(res.data)
      } else {
        setAiError(res.error || 'AI 分析失败，请检查设置里的 AI 模型是否已配置')
      }
    } catch (err: any) {
      setAiError(err?.message ?? String(err))
    } finally {
      setAiAnalyzing(false)
    }
  }

  return (
    <div className="flex h-full bg-background text-foreground">
      {/* 左侧 */}
      <div className="w-96 border-r border-border bg-surface p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">QQ / SnowLuma</h2>

        <div className="mb-4 p-3 bg-surface-muted rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">SnowLuma 进程</span>
            {snowStatus?.running ? (
              <span className="text-xs px-2 py-0.5 bg-green-500/15 text-green-500 rounded">
                运行中 {snowStatus.pid ? `PID ${snowStatus.pid}` : ''}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                未启动
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-2 break-all">
            安装路径：{snowStatus?.installPath ?? '...'}
            {!snowStatus?.installed && (
              <span className="text-red-500 ml-1">(未检测到)</span>
            )}
          </div>

          <div className="mb-2">
            <Input
              value={installPathInput}
              onChange={(e) => setInstallPathInput(e.target.value)}
              placeholder="SnowLuma 安装目录"
              className="text-xs"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {!snowStatus?.running ? (
              <Button
                size="sm"
                onClick={handleStartSnow}
                disabled={snowBusy || !snowStatus?.installed}
              >
                {snowBusy ? '启动中...' : '启动 SnowLuma'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStopSnow}
                disabled={snowBusy}
              >
                {snowBusy ? '停止中...' : '停止'}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleOpenInstallDir}>
              打开目录
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (typeof window.api?.snowlumaOpenWebUi === 'function') {
                  await window.api.snowlumaOpenWebUi()
                }
              }}
            >
              打开 WebUI
            </Button>
            <Button size="sm" variant="outline" onClick={refreshSnowStatus}>
              刷新
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowLogs(!showLogs)
                void refreshLogs()
              }}
            >
              {showLogs ? '隐藏日志' : '查看日志'}
            </Button>
          </div>

          {snowStatus?.lastError && (
            <div className="mt-2 text-xs text-red-500 break-all">
              错误：{snowStatus.lastError}
            </div>
          )}

          {showLogs && (
            <div className="mt-2 max-h-48 overflow-y-auto bg-background border border-border rounded p-2">
              {snowLogs.length === 0 ? (
                <div className="text-xs text-muted-foreground">（暂无日志输出）</div>
              ) : (
                snowLogs.map((line, i) => (
                  <div
                    key={i}
                    className="text-[10px] leading-tight whitespace-pre-wrap break-all text-foreground"
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">OneBot API 地址</label>
          <div className="flex gap-2">
            <Input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://127.0.0.1:3000"
              className="flex-1"
            />
            <Button onClick={testConnection} disabled={loading}>
              {loading ? '连接中...' : '连接'}
            </Button>
          </div>
          <label className="block text-sm font-medium mb-2 mt-3">
            访问令牌 Token（可选）
          </label>
          <Input
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="SnowLuma 端点若设置了 token 则填写，否则留空"
            type="password"
          />
          <div className="mt-2 text-sm">
            {connected ? (
              <span className="text-green-500">✓ 已连接</span>
            ) : (
              <span className="text-red-500">✗ 未连接</span>
            )}
          </div>
        </div>

        {loginInfo && (
          <div className="mb-4 p-3 bg-surface-muted rounded-lg border border-border">
            <div className="text-sm font-medium">当前账号</div>
            <div className="text-xs text-muted-foreground">
              {loginInfo.nickname} ({loginInfo.userId})
            </div>
          </div>
        )}

        {/* 监听群 / 关注成员 切换 */}
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setWatchTab('groups')}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              watchTab === 'groups'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            监听群 ({watchedGroups.length})
          </button>
          <button
            onClick={() => setWatchTab('members')}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              watchTab === 'members'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            关注成员 ({watchedMembers.length})
          </button>
        </div>

        {watchTab === 'members' && (
          <div className="mb-4 p-3 bg-surface-muted rounded-lg border border-border">
            {watchedMembers.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                还没有关注成员。在右侧消息里点某人旁边的 ☆ 即可关注，其消息会高亮。
              </div>
            ) : (
              <div className="space-y-1">
                {watchedMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span className="truncate">
                      {m.nickname || '匿名'}{' '}
                      <span className="text-xs text-muted-foreground">({m.userId})</span>
                    </span>
                    <button
                      onClick={() => void toggleWatchMember(m.userId, m.nickname)}
                      className="text-xs text-red-500 hover:underline shrink-0 ml-2"
                    >
                      取关
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {watchTab === 'groups' && groups.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium shrink-0">群聊 ({groups.length})</h3>
              <Input
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                placeholder="筛选群号 / 群名"
                className="text-xs h-7"
              />
            </div>
            <div className="space-y-1">
              {(() => {
                const kw = groupFilter.trim().toLowerCase()
                const match = (g: QQGroup): boolean =>
                  !kw ||
                  g.groupName.toLowerCase().includes(kw) ||
                  String(g.groupId).includes(kw)
                const sorted = groups
                  .filter(match)
                  .sort((a, b) => {
                    const aw = watchedGroupIds.has(a.groupId) ? 1 : 0
                    const bw = watchedGroupIds.has(b.groupId) ? 1 : 0
                    if (aw !== bw) return bw - aw // 监听的排最上
                    return a.groupName.localeCompare(b.groupName, 'zh')
                  })
                if (sorted.length === 0) {
                  return (
                    <div className="text-xs text-muted-foreground py-2">无匹配群聊</div>
                  )
                }
                return sorted.map((group) => {
                  const watched = watchedGroupIds.has(group.groupId)
                  return (
                    <div
                      key={group.groupId}
                      className={`flex items-center gap-1 rounded-lg border ${
                        selectedGroup === group.groupId
                          ? 'bg-accent text-accent-foreground border-primary'
                          : 'border-transparent hover:bg-muted'
                      }`}
                    >
                      <button
                        onClick={() => loadMessages(group.groupId, group.groupName)}
                        className="flex-1 text-left p-2 text-sm min-w-0"
                      >
                        <div className="font-medium truncate">
                          {watched && <span className="text-amber-500">★ </span>}
                          {group.groupName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {group.groupId} · {group.memberCount} 人
                        </div>
                      </button>
                      <button
                        title={watched ? '取消监听' : '监听该群'}
                        onClick={() => void toggleWatchGroup(group.groupId, group.groupName)}
                        className={`px-2 text-lg leading-none shrink-0 ${
                          watched ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'
                        }`}
                      >
                        {watched ? '★' : '☆'}
                      </button>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 右侧 */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!selectedGroup ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <div>请选择一个群聊查看消息</div>
            <div className="text-xs text-muted-foreground max-w-md text-center">
              提示：先在左侧启动 SnowLuma，再点连接拉取群列表。SnowLuma 首次启动会弹出 WebUI，按提示扫码登录 QQ 即可。
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-lg truncate">{selectedGroupName}</h3>
              <Button
                size="sm"
                onClick={handleAnalyzeGroup}
                disabled={aiAnalyzing || messages.length === 0}
              >
                {aiAnalyzing ? 'AI 分析中...' : `AI 分析（${messages.length} 条）`}
              </Button>
            </div>

            {/* 历史拉取控制条 */}
            <div className="p-3 bg-surface-muted rounded-lg border border-border">
              <div className="text-xs text-muted-foreground mb-2">
                拉取群历史（读 QQ 客户端本地缓存）
              </div>
              {/* 快捷日期预设 */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xs text-muted-foreground">快捷：</span>
                {[
                  { label: '今天', days: 1 },
                  { label: '近三天', days: 3 },
                  { label: '近一周', days: 7 }
                ].map((p) => (
                  <button
                    key={p.days}
                    onClick={() => void loadQuick(p.days)}
                    disabled={fetchingRange}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* 拉取最近 N 条 */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xs text-muted-foreground">拉取最近：</span>
                {[200, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    onClick={() => void fetchRecent(n)}
                    disabled={fetchingRange}
                    className={`text-xs px-2.5 py-1 rounded-full border disabled:opacity-50 ${
                      fetchCount === n
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {n === 5000 ? '全部' : `${n} 条`}
                  </button>
                ))}
              </div>
              {/* 自定义日期范围 */}
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground mb-1">开始日期</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground mb-1">结束日期</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => void loadRange('range')}
                  disabled={fetchingRange}
                >
                  {fetchingRange ? '拉取中...' : '拉取该时间段'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadRange('all')}
                  disabled={fetchingRange}
                >
                  拉取全部缓存
                </Button>
              </div>
              {rangeNote && (
                <div className="text-xs text-muted-foreground mt-2">{rangeNote}</div>
              )}
            </div>

            {/* 分析选项：板块 + 模板 */}
            <div className="p-3 bg-surface-muted rounded-lg border border-border">
              <div className="text-xs text-muted-foreground mb-2">
                分析板块（勾选要 AI 输出的部分）
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {REPORT_SECTIONS.map((s) => {
                  const on = sections.includes(s.key)
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSection(s.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        on
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {on ? '✓ ' : ''}
                      {s.label}
                    </button>
                  )
                })}
              </div>
              <div className="text-xs text-muted-foreground mb-2">风格模板</div>
              <div className="flex flex-wrap gap-2">
                {REPORT_TEMPLATES.map((t) => {
                  const on = template === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTemplate(t.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        on
                          ? 'bg-accent text-accent-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {loading && (
              <div className="text-sm text-muted-foreground">加载最近消息…</div>
            )}
            {aiError && (
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-sm text-red-500">
                {aiError}
              </div>
            )}
            {aiResult && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-primary">AI 分析结果</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(aiResult)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copied ? '已复制' : '复制'}
                  </Button>
                </div>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {aiResult}
                </div>
              </div>
            )}

            {!loading && messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm">
                还没有消息。点上面「拉取全部缓存」或选择日期范围后拉取。
              </div>
            ) : (
              (() => {
                const total = messages.length
                const shown = messages.slice(-300).reverse()
                return (
                  <>
                    <div className="text-xs text-muted-foreground">
                      显示最近 {shown.length} 条
                      {total > shown.length ? `（共 ${total} 条，AI 分析使用全部）` : ''}
                    </div>
                    {shown.map((msg) => {
                      const isWatched = watchedMemberIds.has(msg.sender.userId)
                      return (
                        <div
                          key={msg.messageId}
                          className={`p-3 rounded-lg border ${
                            isWatched
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-surface-muted border-border'
                          }`}
                        >
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {isWatched && <span className="text-amber-500">★ </span>}
                              {msg.sender.nickname}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.time * 1000).toLocaleString('zh-CN', { hour12: false })}
                            </span>
                            <button
                              title={isWatched ? '取消关注' : '关注该成员'}
                              onClick={() =>
                                void toggleWatchMember(msg.sender.userId, msg.sender.nickname)
                              }
                              className={`ml-auto text-sm leading-none shrink-0 ${
                                isWatched
                                  ? 'text-amber-500'
                                  : 'text-muted-foreground hover:text-amber-500'
                              }`}
                            >
                              {isWatched ? '★' : '☆'}
                            </button>
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()
            )}
          </div>
        )}
      </div>
    </div>
  )
}
