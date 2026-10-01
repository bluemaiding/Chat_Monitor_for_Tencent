import React from 'react'
import { AppPage, PRIMARY_NAV_ITEMS } from './navigation'

interface NavIconProps {
  page: AppPage
}

interface PrimaryNavigationProps {
  activePage: AppPage
  onPageChange: (page: AppPage) => void
}

function NavIcon({ page }: NavIconProps): React.ReactElement {
  switch (page) {
    case 'archive':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 5.5h14v14H5z" />
          <path d="M8 8.5h8" />
          <path d="M8 12h8" />
          <path d="M8 15.5h5" />
        </svg>
      )
    case 'report':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 4.5h7l3 3v12H7z" />
          <path d="M14 4.5v3h3" />
          <path d="M9.5 13.5h5" />
          <path d="M9.5 16.5h4" />
        </svg>
      )
    case 'qq':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14c0 0 1.5 2 4 2s4-2 4-2" />
          <circle cx="9.5" cy="10" r="1" />
          <circle cx="14.5" cy="10" r="1" />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4.5v2" />
          <path d="M12 17.5v2" />
          <path d="M4.5 12h2" />
          <path d="M17.5 12h2" />
          <path d="m6.8 6.8 1.4 1.4" />
          <path d="m15.8 15.8 1.4 1.4" />
          <path d="m17.2 6.8-1.4 1.4" />
          <path d="m8.2 15.8-1.4 1.4" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

export function PrimaryNavigation({
  activePage,
  onPageChange
}: PrimaryNavigationProps): React.ReactElement {
  return (
    <nav className="primary-navigation" aria-label="一级导航">
      {PRIMARY_NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`primary-nav-item ${activePage === item.id ? 'active' : ''}`}
          onClick={() => onPageChange(item.id)}
          title={item.label}
        >
          <span className="primary-nav-mark" aria-hidden>
            <NavIcon page={item.id} />
          </span>
          <span className="primary-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
