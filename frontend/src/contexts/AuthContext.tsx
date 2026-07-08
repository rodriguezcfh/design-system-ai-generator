import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api, setToken, clearToken, getToken, markNewSignup, type User } from '../api/client'

type AuthState = { token: string; user: User } | null

type AuthContextValue = {
  auth: AuthState
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadInitialAuth(): AuthState {
  const token = getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { token, user: { id: payload.userId, email: '', createdAt: '' } }
  } catch {
    clearToken()
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadInitialAuth)

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.auth.login(email, password)
    setToken(token)
    setAuth({ token, user })
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.auth.signup(email, password)
    setToken(token)
    setAuth({ token, user })
    markNewSignup()
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setAuth(null)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, login, signup, logout, isAuthenticated: auth !== null }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
