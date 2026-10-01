export type AppPage = 'archive' | 'report' | 'qq' | 'settings' | 'exit-monitor' | 'agent-hub' | 'api' | 'search' | 'export'

export interface NavigationItem {
  id: AppPage
  label: string
}

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { id: 'archive', label: '档案' },
  { id: 'report', label: '日报' },
  { id: 'qq', label: 'QQ' },
  { id: 'settings', label: '设置' }
]
