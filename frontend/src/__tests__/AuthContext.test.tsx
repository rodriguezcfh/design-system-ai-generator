import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

vi.mock('../api/client', () => ({
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getStoredUser: vi.fn(() => null),
  setStoredUser: vi.fn(),
  clearStoredUser: vi.fn(),
  markNewSignup: vi.fn(),
  api: {
    auth: {
      login: vi.fn(),
      signup: vi.fn(),
    },
  },
}))

import { api, setToken, clearToken, getToken, getStoredUser, setStoredUser, clearStoredUser, markNewSignup } from '../api/client'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

const fakeUser = { id: '1', email: 'test@test.com', createdAt: '2024-01-01T00:00:00Z' }
const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.test'

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts unauthenticated when no token in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.auth).toBeNull()
  })

  it('rehydrates the stored user (with email) on reload instead of a blank email from the JWT', () => {
    vi.mocked(getToken).mockReturnValueOnce(fakeToken)
    vi.mocked(getStoredUser).mockReturnValueOnce(fakeUser)

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.auth?.user).toEqual(fakeUser)
    expect(result.current.auth?.user.email).toBe('test@test.com')
  })

  it('login sets auth state and token', async () => {
    vi.mocked(api.auth.login).mockResolvedValue({ token: fakeToken, user: fakeUser })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('test@test.com', 'password')
    })

    expect(api.auth.login).toHaveBeenCalledWith('test@test.com', 'password')
    expect(setToken).toHaveBeenCalledWith(fakeToken)
    expect(setStoredUser).toHaveBeenCalledWith(fakeUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.auth?.user).toEqual(fakeUser)
  })

  it('signup sets auth state and token', async () => {
    vi.mocked(api.auth.signup).mockResolvedValue({ token: fakeToken, user: fakeUser })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signup('new@test.com', 'password123')
    })

    expect(api.auth.signup).toHaveBeenCalledWith('new@test.com', 'password123')
    expect(setToken).toHaveBeenCalledWith(fakeToken)
    expect(markNewSignup).toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout clears auth state and token', async () => {
    vi.mocked(api.auth.login).mockResolvedValue({ token: fakeToken, user: fakeUser })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('test@test.com', 'password')
    })
    expect(result.current.isAuthenticated).toBe(true)

    act(() => { result.current.logout() })

    expect(clearToken).toHaveBeenCalled()
    expect(clearStoredUser).toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.auth).toBeNull()
  })

  it('login propagates API errors', async () => {
    vi.mocked(api.auth.login).mockRejectedValue(new Error('Invalid credentials'))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await expect(
      act(async () => { await result.current.login('x@x.com', 'wrong') })
    ).rejects.toThrow('Invalid credentials')

    expect(result.current.isAuthenticated).toBe(false)
  })
})
