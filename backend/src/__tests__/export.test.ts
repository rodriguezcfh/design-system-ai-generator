import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import * as githubService from '../services/github.service'
import { signToken } from '../lib/jwt'

vi.mock('../lib/prisma', () => ({
  default: {
    designSystem: { findFirst: vi.fn(), update: vi.fn() },
    designTokens: { findUnique: vi.fn() },
    repository: { findUnique: vi.fn(), create: vi.fn() },
    export: { create: vi.fn(), findMany: vi.fn() },
    githubConnection: { findUnique: vi.fn() },
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

const validToken = signToken({ userId: 'user-1' })
const auth = { Authorization: `Bearer ${validToken}` }

const fakeDS = {
  id: 'ds-1', userId: 'user-1', name: 'Mi Brand', status: 'GENERATED',
  createdAt: new Date(), updatedAt: new Date(),
}
const fakeAdditionalComponents = {
  input: 'export function Input() { return <input /> }',
  alert: 'export function Alert() { return <div /> }',
  textarea: 'export function Textarea() { return <textarea /> }',
  chip: 'export function Badge() { return <span /> }',
}
const fakeTokens = {
  id: 'tok-1', designSystemId: 'ds-1', wcagValid: true,
  colors: { primary: '#1a56db', primaryForeground: '#ffffff', background: '#ffffff', foreground: '#111928' },
  typography: { fontFamily: 'Inter, sans-serif' },
  componentCode: 'export function Button() { return <button>Click</button> }',
  additionalComponents: fakeAdditionalComponents,
  wcagReport: {}, createdAt: new Date(), updatedAt: new Date(),
}
const fakeRepo = {
  id: 'repo-1', designSystemId: 'ds-1', repoFullName: 'octocat/mi-brand-design-system',
  visibility: 'PRIVATE', createdAt: new Date(),
}
const fakeExport = {
  id: 'exp-1', designSystemId: 'ds-1', type: 'INITIAL',
  branchName: null, prNumber: null, prUrl: null, prTitle: null, prBody: null,
  status: null, createdAt: new Date(),
}

describe('POST /api/design-systems/:id/export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initial export — creates repo and returns repoUrl', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokens)
    vi.mocked(prisma.repository.findUnique).mockResolvedValue(null)
    vi.mocked(githubService.getDecryptedToken).mockResolvedValue({ token: 'ghs_abc', login: 'octocat' })
    vi.mocked(githubService.createRepository).mockResolvedValue({ fullName: 'octocat/mi-brand-design-system' })
    vi.mocked(githubService.scaffoldRepository).mockResolvedValue(undefined)
    vi.mocked(prisma.repository.create).mockResolvedValue(fakeRepo)
    vi.mocked(prisma.export.create).mockResolvedValue(fakeExport)
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'EXPORTED' })

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({ repoName: 'mi-brand-design-system', visibility: 'PRIVATE' })

    expect(res.status).toBe(201)
    expect(res.body.type).toBe('initial')
    expect(res.body.repoUrl).toContain('github.com')
    expect(githubService.scaffoldRepository).toHaveBeenCalledWith(
      'ghs_abc', 'octocat/mi-brand-design-system',
      fakeTokens.colors, fakeTokens.typography, undefined, undefined,
      fakeTokens.componentCode, fakeAdditionalComponents, 'mi-brand-design-system',
    )
  })

  it('falls back to placeholder components when additionalComponents is null (design system generated before this feature)', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue({ ...fakeTokens, additionalComponents: null })
    vi.mocked(prisma.repository.findUnique).mockResolvedValue(null)
    vi.mocked(githubService.getDecryptedToken).mockResolvedValue({ token: 'ghs_abc', login: 'octocat' })
    vi.mocked(githubService.createRepository).mockResolvedValue({ fullName: 'octocat/mi-brand-design-system' })
    vi.mocked(githubService.scaffoldRepository).mockResolvedValue(undefined)
    vi.mocked(prisma.repository.create).mockResolvedValue(fakeRepo)
    vi.mocked(prisma.export.create).mockResolvedValue(fakeExport)
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'EXPORTED' })

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({})

    expect(res.status).toBe(201)
    const [, , , , , , , additionalComponentsArg] = vi.mocked(githubService.scaffoldRepository).mock.calls[0]
    expect(additionalComponentsArg.input).toContain('Input')
    expect(additionalComponentsArg.alert).toContain('Alert')
    expect(additionalComponentsArg.textarea).toContain('Textarea')
    expect(additionalComponentsArg.chip).toContain('Badge')
  })

  it('update export — creates branch + PR and returns prUrl', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokens)
    vi.mocked(prisma.repository.findUnique).mockResolvedValue(fakeRepo)
    vi.mocked(githubService.getDecryptedToken).mockResolvedValue({ token: 'ghs_abc', login: 'octocat' })
    vi.mocked(githubService.createUpdatePR).mockResolvedValue({
      prNumber: 3,
      prUrl: 'https://github.com/octocat/mi-brand-design-system/pull/3',
      branchName: 'ds-update-123',
      prTitle: 'Update design tokens',
      prBody: 'Changed primary color...',
    })
    vi.mocked(prisma.export.create).mockResolvedValue({
      ...fakeExport, type: 'UPDATE', prNumber: 3,
      prUrl: 'https://github.com/octocat/mi-brand-design-system/pull/3',
      branchName: 'ds-update-123', status: 'OPEN',
    })

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.type).toBe('update')
    expect(res.body.prNumber).toBe(3)
    expect(res.body.prUrl).toContain('pull/3')
    expect(githubService.createUpdatePR).toHaveBeenCalledWith(
      'ghs_abc', fakeRepo.repoFullName,
      fakeTokens.colors, fakeTokens.typography, undefined, undefined,
      fakeTokens.componentCode, fakeAdditionalComponents, fakeDS.name,
    )
  })

  it('returns 403 if GitHub not connected', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokens)
    vi.mocked(prisma.repository.findUnique).mockResolvedValue(null)
    vi.mocked(githubService.getDecryptedToken).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({})

    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('authUrl')
  })

  it('returns 422 if no tokens generated yet', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({})

    expect(res.status).toBe(422)
  })

  it('returns 422 if palette fails WCAG', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue({ ...fakeTokens, wcagValid: false })

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({})

    expect(res.status).toBe(422)
  })

  it('returns 409 with suggestedName on repo name conflict', async () => {
    const { RepoConflictError } = await import('../lib/errors')
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokens)
    vi.mocked(prisma.repository.findUnique).mockResolvedValue(null)
    vi.mocked(githubService.getDecryptedToken).mockResolvedValue({ token: 'ghs_abc', login: 'octocat' })
    vi.mocked(githubService.createRepository).mockRejectedValue(new RepoConflictError('mi-brand-design-system-2'))

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({ repoName: 'mi-brand-design-system' })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('suggestedName')
  })

  it('returns 404 if DS not found', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/design-systems/ds-1/export')
      .set(auth)
      .send({})

    expect(res.status).toBe(404)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app).post('/api/design-systems/ds-1/export').send({})
    expect(res.status).toBe(401)
  })
})

describe('GET /api/design-systems/:id/exports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the export history for a DS', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.export.findMany).mockResolvedValue([fakeExport])

    const res = await request(app)
      .get('/api/design-systems/ds-1/exports')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/design-systems/ds-1/exports')
    expect(res.status).toBe(401)
  })
})
