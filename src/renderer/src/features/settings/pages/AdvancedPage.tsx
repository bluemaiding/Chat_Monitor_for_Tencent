import { useEffect, useState } from 'react'
import { Button, Input, Switch } from '../../../components/ui'

export function AdvancedPage({
  onNotice
}: {
  onNotice: (message: string) => void
}): React.ReactElement {
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [qqApiBase, setQqApiBase] = useState('http://127.0.0.1:3000')
  const [qqConnectionStatus, setQqConnectionStatus] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    let active = true
    void window.api.getSettings().then((result) => {
      if (active) {
        setDebugEnabled(result.settings.debugEnabled)
        setQqApiBase(result.settings.qqApiBase || 'http://127.0.0.1:3000')
      }
    })
    return () => {
      active = false
    }
  }, [])

  const changeDebugEnabled = async (checked: boolean): Promise<void> => {
    const result = await window.api.setSettings({ debugEnabled: checked })
    setDebugEnabled(result.settings.debugEnabled)
    onNotice(checked ? '已开启调试日志' : '已关闭调试日志')
  }

  const handleUpdateQQApi = async (): Promise<void> => {
    try {
      const result = await window.api.setQQApiBase(qqApiBase)
      if (result.success) {
        onNotice('QQ API 地址已更新')
        // 测试连接
        const connResult = await window.api.testQQConnection()
        setQqConnectionStatus(connResult)
        if (connResult.success) {
          onNotice('QQ 连接成功')
        } else {
          onNotice('QQ 连接失败: ' + (connResult.error || '未知错误'))
        }
      }
    } catch (error) {
      onNotice('更新失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleTestQQConnection = async (): Promise<void> => {
    const result = await window.api.testQQConnection()
    setQqConnectionStatus(result)
    if (result.success) {
      onNotice('QQ 连接成功')
    } else {
      onNotice('QQ 连接失败: ' + (result.error || '未知错误'))
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <div>
          <h1>高级</h1>
          <p>用于开发人员排查本地数据库和检索问题</p>
        </div>
      </header>
      <div className="settings-page-scroll">
        <div className="settings-page-content">
          {/* QQ API 配置 */}
          <h2 className="settings-section-heading">QQ OneBot 配置</h2>
          <section className="settings-card">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  API 地址
                  <small className="block text-gray-500 font-normal">
                    NapCat 默认: http://127.0.0.1:3000<br />
                    SnowLuma 默认: http://127.0.0.1:5099
                  </small>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={qqApiBase}
                    onChange={(e) => setQqApiBase(e.target.value)}
                    placeholder="http://127.0.0.1:3000"
                  />
                  <Button onClick={handleUpdateQQApi}>更新</Button>
                  <Button variant="outline" onClick={handleTestQQConnection}>测试连接</Button>
                </div>
              </div>
              {qqConnectionStatus && (
                <div className={`text-sm ${qqConnectionStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                  {qqConnectionStatus.success ? '✓ 连接成功' : `✗ 连接失败: ${qqConnectionStatus.error}`}
                </div>
              )}
            </div>
          </section>

          <h2 className="settings-section-heading">诊断</h2>
          <section className="settings-card settings-debug-card">
            <label>
              <span>
                <b>显示诊断日志</b>
                <small>开启后，检索页显示诊断日志入口并记录匹配统计，不记录聊天正文。</small>
              </span>
              <Switch
                checked={debugEnabled}
                onCheckedChange={(checked) => void changeDebugEnabled(checked)}
                aria-label="显示诊断日志"
              />
            </label>
            <div className="settings-debug-actions">
              <Button variant="outline" size="sm" onClick={() => void window.api.revealAppLog()}>
                打开诊断日志
              </Button>
              <small>关闭调试日志后，仍会保留错误和崩溃日志。</small>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
