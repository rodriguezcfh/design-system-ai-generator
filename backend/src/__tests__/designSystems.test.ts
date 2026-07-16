import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'

vi.mock('../lib/prisma', () => ({
  default: {
    designSystem: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    conversation: { findUnique: vi.fn() },
    brandBrief: { findUnique: vi.fn() },
    designTokens: { findUnique: vi.fn() },
  },
}))

const validToken = signToken({ userId: 'user-1' })
const auth = { Authorization: `Bearer ${validToken}` }

const fakeDS = {
  id: 'ds-1', userId: 'user-1', name: 'Mi Brand', status: 'DRAFT',
  createdAt: new Date(), updatedAt: new Date(),
}

describe('POST /api/design-systems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a design system and returns 201', async () => {
    vi.mocked(prisma.designSystem.create).mockResolvedValue(fakeDS)

    const res = await request(app)
      .post('/api/design-systems')
      .set(auth)
      .send({ name: 'Mi Brand' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 'ds-1', name: 'Mi Brand', status: 'DRAFT' })
  })

  it('returns 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/design-systems')
      .set(auth)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/design-systems')
      .send({ name: 'Mi Brand' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/design-systems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the list of design systems ordered by most recent', async () => {
    vi.mocked(prisma.designSystem.findMany).mockResolvedValue([fakeDS])

    const res = await request(app)
      .get('/api/design-systems')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ id: 'ds-1' })
  })

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/design-systems')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/design-systems/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the design system with its conversation', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: 'conv-1', designSystemId: 'ds-1', messages: [],
      createdAt: new Date(), updatedAt: new Date(),
      attachments: [],
    })
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue({ isComplete: false })

    const res = await request(app)
      .get('/api/design-systems/ds-1')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.designSystem).toMatchObject({ id: 'ds-1' })
    expect(res.body).toHaveProperty('conversation')
  })

  it('nests the persisted brief completeness under conversation.brief so it survives a reload', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: 'conv-1', designSystemId: 'ds-1', messages: [],
      createdAt: new Date(), updatedAt: new Date(),
      attachments: [],
    })
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue({ isComplete: true })

    const res = await request(app)
      .get('/api/design-systems/ds-1')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.conversation.brief).toEqual({ isComplete: true })
  })

  it('returns 404 if not found or not owned', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/design-systems/ds-other')
      .set(auth)

    expect(res.status).toBe(404)
  })

  it('includes previously generated tokens so the frontend does not need to regenerate', async () => {
    const fakeTokens = {
      id: 'tok-1', designSystemId: 'ds-1',
      colors: { primary: '#1a56db' }, typography: { fontFamily: 'Inter' },
      colorScales: null, typographyScale: [],
      componentCode: '<Button />', wcagValid: true, wcagReport: { allPass: true, checks: [] },
      createdAt: new Date(), updatedAt: new Date(),
    }
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue({ ...fakeDS, status: 'GENERATED', tokens: fakeTokens })
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: 'conv-1', designSystemId: 'ds-1', messages: [],
      createdAt: new Date(), updatedAt: new Date(),
      attachments: [],
    })
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue({ isComplete: true })

    const res = await request(app)
      .get('/api/design-systems/ds-1')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.designSystem.tokens).toMatchObject({ colors: { primary: '#1a56db' } })
    expect(prisma.designSystem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ tokens: true }) }),
    )
  })

  it('includes the exported repo full name so the frontend can build a Vercel deploy link and survive a reload', async () => {
    const fakeRepository = {
      id: 'repo-1', designSystemId: 'ds-1', repoFullName: 'octocat/mi-brand-design-system',
      mode: 'STANDALONE', targetPath: null, visibility: 'PRIVATE', createdAt: new Date(),
    }
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue({ ...fakeDS, status: 'EXPORTED', repositories: [fakeRepository] })
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/design-systems/ds-1')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.designSystem.repository).toMatchObject({
      repoFullName: 'octocat/mi-brand-design-system',
    })
    expect(prisma.designSystem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ repositories: expect.anything() }) }),
    )
  })

  it('resolves to a null repository when the design system has no STANDALONE repo at all', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue({ ...fakeDS, status: 'GENERATED', repositories: [] })
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/design-systems/ds-1')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.designSystem.repository).toBeNull()
  })
})

describe('GET /api/design-systems/:id/tokens/figma', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a downloadable DTCG JSON with the design tokens', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue({
      id: 'tok-1', designSystemId: 'ds-1',
      colors: { primary: '#0077B6' },
      typography: { fontFamily: 'Inter, sans-serif' },
      typographyScale: [],
      componentCode: '<Button />', wcagValid: true, wcagReport: {},
      colorScales: null, createdAt: new Date(), updatedAt: new Date(),
    })

    const res = await request(app)
      .get('/api/design-systems/ds-1/tokens/figma')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain('design-tokens.json')
    const json = JSON.parse(res.text)
    expect(json.global.color.primary).toEqual({ $value: '#0077B6', $type: 'color' })
  })

  it('returns 422 if tokens are not generated yet', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/design-systems/ds-1/tokens/figma')
      .set(auth)

    expect(res.status).toBe(422)
  })

  it('returns 404 if the design system does not belong to the user', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/design-systems/ds-1/tokens/figma')
      .set(auth)

    expect(res.status).toBe(404)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/design-systems/ds-1/tokens/figma')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/design-systems/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the design system and returns 204', async () => {
    vi.mocked(prisma.designSystem.deleteMany).mockResolvedValue({ count: 1 })

    const res = await request(app)
      .delete('/api/design-systems/ds-1')
      .set(auth)

    expect(res.status).toBe(204)
    expect(prisma.designSystem.deleteMany).toHaveBeenCalledWith({ where: { id: 'ds-1', userId: 'user-1' } })
  })

  it('returns 404 if not found or not owned', async () => {
    vi.mocked(prisma.designSystem.deleteMany).mockResolvedValue({ count: 0 })

    const res = await request(app)
      .delete('/api/design-systems/ds-other')
      .set(auth)

    expect(res.status).toBe(404)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app).delete('/api/design-systems/ds-1')
    expect(res.status).toBe(401)
  })
})
