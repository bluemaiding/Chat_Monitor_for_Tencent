import { spawn, execFile, ChildProcess } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export interface SnowLumaStatus {
  installed: boolean
  installPath: string
  running: boolean
  pid: number | null
  apiBase: string
  owned: boolean
  lastError?: string
}

const DEFAULT_INSTALL_PATH = 'C:\\Users\\bluem\\Downloads\\SnowLuma'
const DEFAULT_API_BASE = 'http://127.0.0.1:5099'
const WEBUI_PORT = 5099

class SnowLumaService {
  private child: ChildProcess | null = null
  private installPath: string = DEFAULT_INSTALL_PATH
  private lastError: string | undefined
  private logs: string[] = []

  setInstallPath(p: string): void {
    this.installPath = p
  }

  getInstallPath(): string {
    return this.installPath
  }

  isInstalled(): boolean {
    return (
      existsSync(join(this.installPath, 'index.mjs')) &&
      existsSync(join(this.installPath, 'node.exe'))
    )
  }

  private childAlive(): boolean {
    return this.child !== null && !this.child.killed && this.child.exitCode === null
  }

  // 探测 WebUI 端口是否有实例在监听（用于识别"脱离应用后仍在运行"的实例）
  private probeWebUi(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = fetch(`${DEFAULT_API_BASE}/`, { signal: AbortSignal.timeout(1500) })
        .then((r) => resolve(r.status > 0))
        .catch(() => resolve(false))
      void req
    })
  }

  // 找到监听 WEBUI_PORT 的进程 PID（外部实例）
  private findListeningPid(): Promise<number | null> {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') return resolve(null)
      execFile('netstat', ['-ano'], { windowsHide: true }, (err, out) => {
        if (err) return resolve(null)
        for (const line of out.split(/\r?\n/)) {
          if (line.includes('LISTENING') && line.includes(`:${WEBUI_PORT} `)) {
            const parts = line.trim().split(/\s+/)
            const pid = Number(parts[parts.length - 1])
            if (pid > 0) return resolve(pid)
          }
        }
        resolve(null)
      })
    })
  }

  async getStatus(): Promise<SnowLumaStatus> {
    const owned = this.childAlive()
    let running = owned
    let pid: number | null = this.child?.pid ?? null
    if (!owned) {
      const ext = await this.findListeningPid()
      if (ext) {
        running = true
        pid = ext
      }
    }
    return {
      installed: this.isInstalled(),
      installPath: this.installPath,
      running,
      pid,
      apiBase: DEFAULT_API_BASE,
      owned,
      lastError: this.lastError
    }
  }

  async start(): Promise<SnowLumaStatus> {
    if (this.childAlive()) return this.getStatus()
    if (!this.isInstalled()) {
      this.lastError = `SnowLuma 未安装或路径错误: ${this.installPath}`
      return this.getStatus()
    }
    // 已有外部实例在跑（比如上次脱离应用的），直接复用，避免端口冲突
    if (await this.probeWebUi()) {
      this.lastError = undefined
      return this.getStatus()
    }
    try {
      const nodeExe = join(this.installPath, 'node.exe')
      const entry = join(this.installPath, 'index.mjs')
      this.lastError = undefined
      // detached: true + stdio: 'ignore' —— 让 SnowLuma 完全脱离本应用存活，
      // 且不接管其输出（否则应用退出后管道断裂会让 SnowLuma 反复 EPIPE 卡死）。
      // 日志改为读取 SnowLuma 自己写的日志文件。
      this.child = spawn(nodeExe, [entry], {
        cwd: this.installPath,
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
      })
      this.child.on('error', (err) => {
        this.lastError = err.message
      })
      this.child.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          this.lastError = `SnowLuma 退出，code=${code} signal=${signal ?? ''}`
        }
        this.child = null
      })
      // 允许父进程退出后子进程独立存活
      this.child.unref()
      // 等待进程启动
      await new Promise((r) => setTimeout(r, 3000))
      return this.getStatus()
    } catch (err: any) {
      this.lastError = err?.message ?? String(err)
      return this.getStatus()
    }
  }

  async stop(): Promise<SnowLumaStatus> {
    const status = await this.getStatus()
    const targetPid = this.childAlive() ? this.child?.pid : status.pid
    if (!targetPid) return status
    try {
      if (process.platform === 'win32') {
        // 用 taskkill 按 PID 结束（含子进程树）
        await new Promise<void>((resolve) => {
          execFile(
            'taskkill',
            ['/pid', String(targetPid), '/T', '/F'],
            { windowsHide: true },
            () => resolve()
          )
        })
      } else {
        process.kill(targetPid, 'SIGTERM')
      }
      this.child = null
      await new Promise((r) => setTimeout(r, 1000))
    } catch (err: any) {
      this.lastError = err?.message ?? String(err)
    }
    return this.getStatus()
  }

  // 读取 SnowLuma 自己写的日志文件（最新一份），取末尾若干行
  getLogs(): string[] {
    try {
      const logDir = join(this.installPath, 'logs')
      if (!existsSync(logDir)) return this.logs.slice(-100)
      const files = readdirSync(logDir)
        .filter((f) => f.startsWith('snowluma-') && f.endsWith('.log'))
        .sort()
      if (files.length === 0) return this.logs.slice(-100)
      const latest = join(logDir, files[files.length - 1])
      const content = readFileSync(latest, 'utf8')
      const lines = content.split(/\r?\n/).filter((l) => l.trim())
      return lines.slice(-120)
    } catch (err: any) {
      this.lastError = err?.message ?? String(err)
      return this.logs.slice(-100)
    }
  }

  openInstallDir(): void {
    if (existsSync(this.installPath)) {
      spawn('explorer.exe', [this.installPath], { windowsHide: true, detached: true })
    }
  }

  getWebUiUrl(): string {
    return DEFAULT_API_BASE
  }
}

export const snowLumaService = new SnowLumaService()
