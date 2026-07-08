import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

function UserMenu() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    setIsOpen(false)
    logout()
    navigate('/login')
  }

  if (!auth) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 rounded-full pl-1 pr-1.5 py-1 hover:bg-white/10 transition-colors"
      >
        <span className="text-white text-xs font-sans hidden sm:block truncate max-w-[180px]">
          {auth.user.email}
        </span>
        <span className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-zinc-200 shadow-lg py-1.5 z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-zinc-100 sm:hidden">
            <p className="text-xs font-sans text-ink-muted truncate">{auth.user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm font-sans text-ink hover:bg-surface-raised transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { auth } = useAuth()

  return (
    <div className="h-screen overflow-hidden bg-surface-raised flex flex-col">
      <header className="h-12 bg-ink shrink-0 flex items-center px-4 gap-4 border-b border-zinc-800">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-mono text-sm font-medium text-white tracking-tight">
            super<span className="text-accent-soft">ds</span>ai
          </span>
        </Link>

        <div className="flex-1" />

        {auth && <UserMenu />}
      </header>

      <main className="flex-1 min-h-0 flex flex-col">{children}</main>
    </div>
  )
}
