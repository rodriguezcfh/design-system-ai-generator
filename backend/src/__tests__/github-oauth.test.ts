import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import * as githubService from '../services/github.service'
import { signToken } from '../lib/jwt'

// Prevent PrismaClient initialization — other routes load it at module level
vi.mock('../lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    githubConnection: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock('../services/github.service', () => ({
  exchangeCodeForToken: vi.fn(),
  saveGithubConnection: vi.fn(),
  getDecryptedToken: vi.fn(),
  getConnectionStatus: vi.fn(),
  createRepository: vi.fn(),
  scaffoldRepository: vi.fn(),
  createUpdatePR: vi.fn(),
}))

describe('GET /api/auth/github', () => {
  it('redirects to GitHub OAuth authorize URL', async () => {
    const res = await request(app).get('/api/auth/github')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('github.com/login/oauth/authorize')
    expect(res.headers.location).toContain('scope=repo')
  })
})

const validToken = signToken({ userId: 'user-1' })
const auth = { Authorization: `Bearer ${validToken}` }

describe('GET /api/auth/github/callback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exchanges code and redirects to frontend on success, using state (not header) for auth', async () => {
    vi.mocked(githubService.exchangeCodeForToken).mockResolvedValue({
      accessToken: 'ghs_token123',
      login: 'octocat',
    })
    vi.mocked(githubService.saveGithubConnection).mockResolvedValue(undefined)

    // No Authorization header set — this simulates GitHub's real browser redirect.
    const res = await request(app)
      .get('/api/auth/github/callback')
      .query({ code: 'valid-code', state: validToken })

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('github/connected')
    expect(githubService.exchangeCodeForToken).toHaveBeenCalledWith('valid-code')
    expect(githubService.saveGithubConnection).toHaveBeenCalledWith('user-1', 'ghs_token123', 'octocat')
  })

  it('returns 400 if code is missing', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback')
      .query({ state: validToken })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 401 if state is missing or not a valid JWT', async () => {
    const res = await request(app).get('/api/auth/github/callback').query({ code: 'xyz' })
    expect(res.status).toBe(401)
  })

  it('returns 500 if GitHub exchange fails', async () => {
    vi.mocked(githubService.exchangeCodeForToken).mockRejectedValue(new Error('bad_verification_code'))

    const res = await request(app)
      .get('/api/auth/github/callback')
      .query({ code: 'invalid-code', state: validToken })

    expect(res.status).toBe(500)
  })
})

describe('GET /api/auth/github/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns connected: true with username when the user has a github connection', async () => {
    vi.mocked(githubService.getConnectionStatus).mockResolvedValue({ connected: true, username: 'octocat' })

    const res = await request(app).get('/api/auth/github/status').set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ connected: true, username: 'octocat' })
  })

  it('returns connected: false when the user has no github connection', async () => {
    vi.mocked(githubService.getConnectionStatus).mockResolvedValue({ connected: false })

    const res = await request(app).get('/api/auth/github/status').set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ connected: false })
  })

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/github/status')
    expect(res.status).toBe(401)
  })
})
