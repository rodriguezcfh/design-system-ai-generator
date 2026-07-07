import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

export function Layout({ children }: { children: ReactNode }) {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="h-screen overflow-hidden bg-surface-raised flex flex-col">
      <header className="h-12 bg-ink shrink-0 flex items-center px-4 gap-4 border-b border-zinc-800">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-mono text-sm font-medium text-white tracking-tight">
            super<span className="text-accent-soft">ds</span>ai
          </span>
        </Link>

        <div className="flex-1" />

        {auth && (
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-xs font-sans hidden sm:block truncate max-w-[180px]">
              {auth.user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-zinc-400 hover:text-white text-xs font-sans transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 flex flex-col">{children}</main>
    </div>
  )
}
