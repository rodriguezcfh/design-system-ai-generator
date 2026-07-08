const TOKEN_KEY = 'dsai_token'
const ONBOARDING_FLAG_KEY = 'dsai_show_onboarding'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

export function markNewSignup() { localStorage.setItem(ONBOARDING_FLAG_KEY, 'true') }
export function consumeOnboardingFlag(): boolean {
  const shouldShow = localStorage.getItem(ONBOARDING_FLAG_KEY) === 'true'
  if (shouldShow) localStorage.removeItem(ONBOARDING_FLAG_KEY)
  return shouldShow
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({ error: 'Unknown error' }))
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'Request failed', res.status, data)
  return data as T
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = { id: string; email: string; createdAt: string }

export type DSStatus = 'DRAFT' | 'GENERATED' | 'APPROVED' | 'EXPORTED'

export type DesignSystem = {
  id: string; name: string; status: DSStatus; createdAt: string; updatedAt: string
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string; timestamp?: string }

export type ColorTokens = Record<string, string>

export type WcagCheck = {
  label: string; foreground: string; background: string; ratio: number; passes: boolean
}

export type WcagReport = { allPass: boolean; checks: WcagCheck[] }

export type Shade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'

export type ColorScaleFamily = { familyName: string; shades: Record<Shade, string> }

export type ColorScales = { primary: ColorScaleFamily; accent: ColorScaleFamily; neutral: ColorScaleFamily }

export type TypographyStyle = {
  name: string
  description: string
  sizePx: number
  sizeRem: number
  weightName: string
  weightValue: number
  role: 'display' | 'heading' | 'body'
}

export type DesignTokens = {
  id: string
  colors: ColorTokens
  typography: {
    fontFamily?: string
    fontFamilyDisplay?: string
    sizes?: Record<string, string>
    weights?: Record<string, string>
    lineHeights?: Record<string, string>
  }
  colorScales?: ColorScales | null
  typographyScale?: TypographyStyle[] | null
  componentCode: string | null
  wcagValid: boolean
  wcagReport: WcagReport | null
}

export type Export = {
  id: string
  type: 'INITIAL' | 'UPDATE'
  branchName: string | null
  prNumber: number | null
  prUrl: string | null
  repoUrl: string | null
  prTitle: string | null
  prBody: string | null
  status: 'OPEN' | 'MERGED' | 'CLOSED' | null
  createdAt: string
}

export type Repository = { repoFullName: string }

export type DSDetail = {
  designSystem: DesignSystem & { tokens?: DesignTokens | null; repository?: Repository | null }
  conversation: { id: string; messages: ChatMessage[]; brief?: { isComplete: boolean } } | null
}

// ─── API surface ─────────────────────────────────────────────────────────────

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      apiFetch<{ token: string; user: User }>('/auth/signup', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    githubStatus: () => apiFetch<{ connected: boolean; username?: string }>('/auth/github/status'),
  },

  designSystems: {
    list: () => apiFetch<DesignSystem[]>('/design-systems'),
    create: (name: string) =>
      apiFetch<DesignSystem>('/design-systems', {
        method: 'POST', body: JSON.stringify({ name }),
      }),
    get: (id: string) => apiFetch<DSDetail>(`/design-systems/${id}`),
    delete: (id: string) => apiFetch<void>(`/design-systems/${id}`, { method: 'DELETE' }),
    generate: (id: string) =>
      apiFetch<{ tokens: DesignTokens; wcagReport: WcagReport }>(`/design-systems/${id}/generate`, {
        method: 'POST',
      }),
    export: (id: string, repoName?: string, visibility?: 'public' | 'private') =>
      apiFetch<{
        type: 'initial' | 'update'
        repoUrl?: string; repoFullName?: string
        prUrl?: string; prNumber?: number; branchName?: string
        exportId: string
      }>(`/design-systems/${id}/export`, {
        method: 'POST', body: JSON.stringify({
          repoName,
          visibility: visibility?.toUpperCase() ?? 'PRIVATE',
        }),
      }),
    exports: (id: string) => apiFetch<Export[]>(`/design-systems/${id}/exports`),
    figmaTokens: async (id: string): Promise<Blob> => {
      const token = getToken()
      const res = await fetch(`/api/design-systems/${id}/tokens/figma`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Download failed' }))
        throw new ApiError(data.error ?? 'Download failed', res.status, data)
      }
      return res.blob()
    },
  },

  chat: {
    message: (designSystemId: string, content: string) =>
      apiFetch<{ message: string; brief: unknown }>('/chat/message', {
        method: 'POST', body: JSON.stringify({ designSystemId, content }),
      }),
    attachment: async (designSystemId: string, file: File): Promise<{ id: string; filename: string }> => {
      const token = getToken()
      const form = new FormData()
      form.append('designSystemId', designSystemId)
      form.append('file', file)
      const res = await fetch('/api/chat/attachment', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new ApiError(data.error ?? 'Upload failed', res.status, data)
      return data as { id: string; filename: string }
    },
  },
}
