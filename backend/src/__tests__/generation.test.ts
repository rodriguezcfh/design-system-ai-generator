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
  rawSummary: null,
  preferredColors: null, preferredHeadingFont: null, preferredBodyFont: null,
  isComplete: true,
  createdAt: new Date(), updatedAt: new Date(),
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

const fakeTypographyScale = [
  { name: 'Display', description: 'Héroe', sizePx: 48, sizeRem: 3, weightName: 'ExtraBold', weightValue: 800, role: 'display' as const },
  { name: 'Body', description: 'Texto', sizePx: 16, sizeRem: 1, weightName: 'Regular', weightValue: 400, role: 'body' as const },
]

const fakeAdditionalComponents = {
  input: 'export function Input() { return <input /> }',
  alert: 'export function Alert() { return <div /> }',
  textarea: 'export function Textarea() { return <textarea /> }',
  chip: 'export function Badge() { return <span /> }',
}

const fakeGeneratedDS = {
  colors: goodColors,
  typography: {
    fontFamily: 'Inter, sans-serif',
    fontFamilyDisplay: 'Inter, sans-serif',
    sizes: { base: '1rem', lg: '1.125rem' },
    weights: { normal: '400', bold: '700' },
  },
  typographyScale: fakeTypographyScale,
  buttonComponent: 'export function Button() { return <button>Click</button> }',
  additionalComponents: fakeAdditionalComponents,
}

const fakeTokensRecord = {
  id: 'tok-1', designSystemId: 'ds-1',
  colors: goodColors, typography: fakeGeneratedDS.typography,
  colorScales: null, typographyScale: fakeTypographyScale,
  componentCode: fakeGeneratedDS.buttonComponent,
  additionalComponents: fakeAdditionalComponents,
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

  it('passes brief preferences to generateDesignSystem and persists computed colorScales/typographyScale', async () => {
    const briefWithPreferences = {
      ...fakeBrief,
      preferredColors: ['#0077B6', '#00F5D4'],
      preferredFontMode: 'SEPARATE',
      preferredHeadingFont: 'Kiona',
      preferredBodyFont: 'Montserrat',
    }
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(briefWithPreferences)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.designTokens.upsert).mockResolvedValue(fakeTokensRecord)
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'GENERATED' })

    await request(app).post('/api/design-systems/ds-1/generate').set(auth)

    expect(geminiService.generateDesignSystem).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredColors: ['#0077B6', '#00F5D4'],
        preferredFontMode: 'SEPARATE',
        preferredHeadingFont: 'Kiona',
        preferredBodyFont: 'Montserrat',
      }),
    )

    const upsertArg = vi.mocked(prisma.designTokens.upsert).mock.calls[0][0]
    expect(upsertArg.create.typographyScale).toEqual(fakeTypographyScale)
    expect(upsertArg.create.colorScales).toMatchObject({
      primary: { familyName: expect.any(String), shades: expect.any(Object) },
      accent: { familyName: expect.any(String), shades: expect.any(Object) },
      neutral: { familyName: 'Neutral', shades: expect.any(Object) },
    })
  })

  it('clears any pending chat-edit confirmation on a full regeneration', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.designTokens.upsert).mockResolvedValue(fakeTokensRecord)
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'GENERATED' })

    await request(app).post('/api/design-systems/ds-1/generate').set(auth)

    const updateArg = vi.mocked(prisma.designSystem.update).mock.calls[0][0]
    expect(updateArg.data).toMatchObject({ status: 'GENERATED', pendingEditSummary: null })
  })

  it('auto-corrects a Gemini palette that fails contrast instead of returning allPass false', async () => {
    const badColors = {
      ...goodColors,
      primary: '#aaaaaa',
      primaryForeground: '#bbbbbb', // near-identical — fails AA; should get auto-fixed to black
    }
    const fixedColors = { ...badColors, primaryForeground: '#000000' }
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue({
      ...fakeGeneratedDS,
      colors: badColors,
    })
    vi.mocked(prisma.designTokens.upsert).mockResolvedValue({
      ...fakeTokensRecord, colors: fixedColors, wcagValid: true,
    })
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'GENERATED' })

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(200)
    expect(res.body.wcagReport.allPass).toBe(true)
    const primaryCheck = res.body.wcagReport.checks.find(
      (c: { label: string }) => c.label === 'Primary button text',
    )
    expect(primaryCheck.passes).toBe(true)
    const upsertArg = vi.mocked(prisma.designTokens.upsert).mock.calls[0][0]
    expect(upsertArg.create.colors).toMatchObject({ primaryForeground: '#000000' })
  })

  it('returns 422 if Gemini generates TypeScript syntax in the button component', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue({
      ...fakeGeneratedDS,
      buttonComponent: `
        interface ButtonProps { variant?: string }
        const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => <button ref={ref} {...props} />)
      `,
    })

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/TypeScript/)
    expect(prisma.designTokens.upsert).not.toHaveBeenCalled()
  })

  it('persists additionalComponents (Input, Alert, Textarea, Badge) alongside the Button', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.designTokens.upsert).mockResolvedValue(fakeTokensRecord)
    vi.mocked(prisma.designSystem.update).mockResolvedValue({ ...fakeDS, status: 'GENERATED' })

    await request(app).post('/api/design-systems/ds-1/generate').set(auth)

    const upsertArg = vi.mocked(prisma.designTokens.upsert).mock.calls[0][0]
    expect(upsertArg.create.additionalComponents).toEqual(fakeAdditionalComponents)
    expect(upsertArg.update.additionalComponents).toEqual(fakeAdditionalComponents)
  })

  it('returns 422 naming Input when only that component has TypeScript syntax', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue({
      ...fakeGeneratedDS,
      additionalComponents: {
        ...fakeAdditionalComponents,
        input: `interface InputProps {}\nconst Input = (props) => <input {...props} />`,
      },
    })

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/^Input:/)
    expect(prisma.designTokens.upsert).not.toHaveBeenCalled()
  })

  it('returns 422 if Gemini generates a button that imports a package not in the exported package.json', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.brandBrief.findUnique).mockResolvedValue(fakeBrief)
    vi.mocked(geminiService.generateDesignSystem).mockResolvedValue({
      ...fakeGeneratedDS,
      buttonComponent: `
        import { cva } from 'class-variance-authority';
        import { twMerge } from 'tailwind-merge';
        const Button = (props) => <button {...props} />
      `,
    })

    const res = await request(app)
      .post('/api/design-systems/ds-1/generate')
      .set(auth)

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/class-variance-authority/)
    expect(prisma.designTokens.upsert).not.toHaveBeenCalled()
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
