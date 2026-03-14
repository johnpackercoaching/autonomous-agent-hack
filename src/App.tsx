import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './LoginPage'
import { ErrorBoundary, AgentsPage, ChatPage, TeamsPage, ScoreboardPage } from './components'

// ── All customizable text in one place ──
const APP_NAME = 'Agent Hackathon'
const HEADER_TITLE = 'Agent Hackathon'
const FOOTER_TEXT = 'Autonomous Agent Hackathon'
const SETTINGS_LABEL = 'Settings'
const SIGN_OUT_LABEL = 'Sign Out'

const navItems = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: 'home' },
  { id: 'agents', path: '/agents', label: 'Agents', icon: 'zap' },
  { id: 'teams', path: '/teams', label: 'Teams', icon: 'users' },
  { id: 'scoreboard', path: '/scoreboard', label: 'Scoreboard', icon: 'trophy' },
  { id: 'chat', path: '/chat', label: 'Chat', icon: 'mail' },
]

function NavIcon({ icon }: { icon: string }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true as const }
  switch (icon) {
    case 'home': return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'folder': return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    case 'mail': return <svg {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
    case 'calendar': return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    case 'chart': return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    case 'zap': return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    case 'users': return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'trophy': return <svg {...props}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    default: return null
  }
}

function Sidebar() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <span className={`hamburger ${mobileOpen ? 'open' : ''}`} />
      </button>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">{APP_NAME}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <NavIcon icon={item.icon} />
              <span className="sidebar-item-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom" />
      </aside>

      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
    </>
  )
}

function AvatarDropdown({ user, onSignOut }: { user: { email: string | null; displayName: string | null; photoURL: string | null }; onSignOut: () => void }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <div className="avatar-dropdown">
      <button
        className="avatar-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Open user menu"
        aria-haspopup="menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="7" r="4"/>
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="avatar-overlay" onClick={() => setIsOpen(false)} />
          <div className="avatar-menu">
            <div className="avatar-menu-header">
              <span className="avatar-menu-name">{user.displayName || 'User'}</span>
              <span className="avatar-menu-email">{user.email}</span>
            </div>
            <div className="avatar-menu-divider" />
            <Link to="/settings" className="avatar-menu-item" onClick={() => setIsOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              {SETTINGS_LABEL}
            </Link>
            <div className="avatar-menu-divider" />
            <button className="avatar-menu-item" onClick={onSignOut}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {SIGN_OUT_LABEL}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PageLayout({ children, user, onSignOut }: { children: React.ReactNode; user?: { email: string | null; displayName: string | null; photoURL: string | null }; onSignOut?: () => void }) {
  return (
    <div className="page with-sidebar view-container">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />

      <div className="main-content">
        <header className="header">
          <div className="header-inner">
            <p className="header-label">{HEADER_TITLE}</p>
          </div>
          <div className="header-actions">
            {onSignOut && user && (
              <AvatarDropdown user={user} onSignOut={onSignOut} />
            )}
          </div>
        </header>

        <main id="main-content" className="content">
          {children}
        </main>

        <footer className="footer">
          <p>{FOOTER_TEXT}</p>
        </footer>
      </div>
    </div>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-content">
      <p>{title}</p>
    </div>
  )
}

function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  const userInfo = { email: user.email, displayName: user.displayName, photoURL: user.photoURL }

  return (
    <Routes>
      <Route path="/" element={<PageLayout user={userInfo} onSignOut={signOut}><PlaceholderPage title="Dashboard" /></PageLayout>} />
      <Route path="/agents" element={<PageLayout user={userInfo} onSignOut={signOut}><AgentsPage /></PageLayout>} />
      <Route path="/teams" element={<PageLayout user={userInfo} onSignOut={signOut}><TeamsPage /></PageLayout>} />
      <Route path="/scoreboard" element={<PageLayout user={userInfo} onSignOut={signOut}><ScoreboardPage /></PageLayout>} />
      <Route path="/chat" element={<PageLayout user={userInfo} onSignOut={signOut}><ChatPage /></PageLayout>} />
      <Route path="*" element={<PageLayout user={userInfo} onSignOut={signOut}><PlaceholderPage title="Dashboard" /></PageLayout>} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
