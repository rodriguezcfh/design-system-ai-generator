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

  it('exchanges code and redirects to frontend on success', async () => {
    vi.mocked(githubService.exchangeCodeForToken).mockResolvedValue({
      accessToken: 'ghs_token123',
      login: 'octocat',
    })
    vi.mocked(githubService.saveGithubConnection).mockResolvedValue(undefined)

    const res = await request(app)
      .get('/api/auth/github/callback')
      .set(auth)
      .query({ code: 'valid-code' })

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('github/connected')
    expect(githubService.exchangeCodeForToken).toHaveBeenCalledWith('valid-code')
  })

  it('returns 400 if code is missing', async () => {
    const res = await request(app).get('/api/auth/github/callback').set(auth)
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 401 if no JWT', async () => {
    const res = await request(app).get('/api/auth/github/callback').query({ code: 'xyz' })
    expect(res.status).toBe(401)
  })

  it('returns 500 if GitHub exchange fails', async () => {
    vi.mocked(githubService.exchangeCodeForToken).mockRejectedValue(new Error('bad_verification_code'))

    const res = await request(app)
      .get('/api/auth/github/callback')
      .set(auth)
      .query({ code: 'invalid-code' })

    expect(res.status).toBe(500)
  })
})
