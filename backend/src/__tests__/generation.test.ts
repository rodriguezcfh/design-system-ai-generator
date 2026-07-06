import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import * as geminiService from '../services/gemini.service'
import { signToken } from '../lib/jwt'

vi.mock('../lib/prisma', () => ({
  default: {
    designSystem: { findFirst: vi.fn(), update: vi.fn() },
    brandBrief: { findUnique: vi.fn() },
    designTokens: { upsert: vi.fn() },
  },
}))

vi.mock('../services/gemini.service', () => ({
  extractBrief: vi.fn(),
  generateDesignSystem: vi.fn(),
}))

const validToken = signToken({ userId: 'user-1' })
const auth = { Authorization: `Bearer ${validToken}` }

const fakeDS = {
  id: 'ds-1', userId: 'user-1', name: 'Mi Brand', status: 'DRAFT',
  createdAt: new Date(), updatedAt: new Date(),
}

const fakeBrief = {
  id: 'brief-1', designSystemId: 'ds-1', tone: 'warm',
  values: ['trust', 'clarity'], references: [],
  rawSummary: null, createdAt: new Date(), updatedAt: new Date(),
}

// Colors with good WCAG contrast
const goodColors = {
  primary: '#1a56db',
  primaryForeground: '#ffffff',
  secondary: '#7e3af2',
  secondaryForeground: '#ffffff',
  background: '#ffffff',
  foreground: '#111928',
  muted: '#f3f4f6',
  mutedForeground: '#374151',
  error: '#c81e1e',
  errorForeground: '#ffffff',
}

const fakeGeneratedDS = {
  colors: goodColors,
  typography: {
    fontFamily: 'Inter, sans-serif',
    fontFamilyDisplay: 'Inter, sans-serif',
    sizes: { base: '1rem', lg: '1.125rem' },
    weights: { normal: '400', bold: '700' },
  },
  buttonComponent: 'export function Button() { return <button>Click</button> }',
}

const fakeTokensRecord = {
  id: 'tok-1', designSystemId: 'ds-1',
  colors: goodColors, typography: fakeGeneratedDS.typography,
  componentCode: fakeGeneratedDS.buttonComponent,
  wcagValid: true, wcagReport: {},
  createdAt: new Date(), updatedAt: new Date(),
}

describe('POST /api/design-systems/:id/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with tokens and passing WCAG report', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.designTokens.upsert).mockResolvedValue(fakeTokensRecord)
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'GENERATED' })

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.tokens).toHaveProperty('colors')
    expect(res.body.wcagReport.allPass).toBe(true)
  })

  it('returns 200 with wcagReport.allPass false when colors fail contrast', async () => {
    const badColors = {
      ...goodColors,
      primary: '#aaaaaa',
      primaryForeground: '#bbbbbb', // near-identical — fails AA
    }
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue({
      ...fakeGeneratedDS,
      colors: badColors,
    })
    vi.mocked(prisma.designTokens.upsert).mockResolvedValue({
      ...fakeTokensRecord, colors: badColors, wcagValid: false,
    })
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'GENERATED' })

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.wcagReport.allPass).toBe(false)
    const failedCheck = res.body.wcagReport.checks.find(
      (c: { label: string }) => c.label === 'Primary button text',
    )
    expect(failedCheck.passes).toBe(false)
  })

  it('returns 422 if no brand brief exists', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(422)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 404 if design system not found or not owned', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/design-systems/ds-other/generate')
      .set(auth)

    expect(res.status).toBe(404)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')

    expect(res.status).toBe(401)
  })
})
