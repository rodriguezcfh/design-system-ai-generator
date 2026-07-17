import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import * as geminiService from '../services/gemini.service'
import { signToken } from '../lib/jwt'

vi.mock('../lib/prisma', () => ({
  default: {
    designSystem: { findFirst: vi.fn(), update: vi.fn() },
    conversation: { upsert: vi.fn(), update: vi.fn() },
    brandBrief: { upsert: vi.fn() },
    attachment: { create: vi.fn() },
    designTokens: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('../services/gemini.service', () => ({
  extractBrief: vi.fn(),
  interpretDesignSystemEdit: vi.fn(),
}))

const validToken = signToken({ userId: 'user-1' })
const auth = { Authorization: `Bearer ${validToken}` }

const fakeDS = {
  id: 'ds-1', userId: 'user-1', name: 'Mi Brand', status: 'DRAFT',
  pendingEditSummary: null, pendingEditPatch: null,
  createdAt: new Date(), updatedAt: new Date(),
}
const fakeConversation = {
  id: 'conv-1', designSystemId: 'ds-1', messages: [],
  createdAt: new Date(), updatedAt: new Date(),
}
const fakeBrief = {
  id: 'brief-1', designSystemId: 'ds-1', tone: 'warm',
  values: ['trust'], references: [], rawSummary: null,
  preferredColors: null, preferredFontMode: 'UNSET',
  preferredHeadingFont: null, preferredBodyFont: null,
  isComplete: false,
  createdAt: new Date(), updatedAt: new Date(),
}

describe('POST /api/chat/message', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with assistant message and brief', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(geminiService.extractBrief).mockResolvedValue({
      assistantMessage: '¿Qué paleta de colores te imaginás?',
      brief: {
        tone: 'warm', values: ['trust'], references: [],
        preferredColors: null, preferredFontMode: 'UNSET',
        preferredHeadingFont: null, preferredBodyFont: null,
        isComplete: false,
      },
    })
    vi.mocked(prisma.brandBrief.upsert).mockResolvedValue(fakeBrief)

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Quiero algo cálido para una fintech' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('¿Qué paleta de colores te imaginás?')
    expect(res.body.brief).toMatchObject({ tone: 'warm' })
    expect(geminiService.interpretDesignSystemEdit).not.toHaveBeenCalled()
  })

  it('persists explicit preferred colors and fonts extracted from the chat message', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(geminiService.extractBrief).mockResolvedValue({
      assistantMessage: '¡Genial, uso esos colores y fuentes!',
      brief: {
        tone: 'moderno', values: [], references: [],
        preferredColors: ['#0077B6', '#00F5D4'],
        preferredFontMode: 'SEPARATE',
        preferredHeadingFont: 'Kiona',
        preferredBodyFont: 'Montserrat',
        isComplete: false,
      },
    })
    vi.mocked(prisma.brandBrief.upsert).mockResolvedValue({
      ...fakeBrief,
      preferredColors: ['#0077B6', '#00F5D4'],
      preferredFontMode: 'SEPARATE',
      preferredHeadingFont: 'Kiona',
      preferredBodyFont: 'Montserrat',
    })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({
        designSystemId: 'ds-1',
        content: 'Quiero estos colores #0077B6 y #00F5D4, fuentes Kiona para títulos y Montserrat para textos',
      })

    expect(res.status).toBe(200)
    const upsertArg = vi.mocked(prisma.brandBrief.upsert).mock.calls[0][0]
    expect(upsertArg.create).toMatchObject({
      preferredColors: ['#0077B6', '#00F5D4'],
      preferredFontMode: 'SEPARATE',
      preferredHeadingFont: 'Kiona',
      preferredBodyFont: 'Montserrat',
    })
    expect(upsertArg.update).toMatchObject({
      preferredColors: ['#0077B6', '#00F5D4'],
      preferredFontMode: 'SEPARATE',
      preferredHeadingFont: 'Kiona',
      preferredBodyFont: 'Montserrat',
    })
  })

  it('persists isComplete so the brief status survives a page reload', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(geminiService.extractBrief).mockResolvedValue({
      assistantMessage: '¡Genial, ya tengo todo lo que necesito!',
      brief: {
        tone: 'moderno', values: ['confianza'], references: [],
        preferredColors: null, preferredFontMode: 'UNSET',
        preferredHeadingFont: null, preferredBodyFont: null,
        isComplete: true,
      },
    })
    vi.mocked(prisma.brandBrief.upsert).mockResolvedValue({ ...fakeBrief, isComplete: true })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Dale, esos son todos los detalles' })

    expect(res.status).toBe(200)
    expect(res.body.brief.isComplete).toBe(true)
    const upsertArg = vi.mocked(prisma.brandBrief.upsert).mock.calls[0][0]
    expect(upsertArg.create).toMatchObject({ isComplete: true })
    expect(upsertArg.update).toMatchObject({ isComplete: true })
  })

  it('returns 400 if content is missing', async () => {
    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1' })
    expect(res.status).toBe(400)
  })

  it('returns 400 if designSystemId is missing', async () => {
    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ content: 'Hola' })
    expect(res.status).toBe(400)
  })

  it('returns 404 if design system does not belong to user', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-other', content: 'Hola' })
    expect(res.status).toBe(404)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/chat/message')
      .send({ designSystemId: 'ds-1', content: 'Hola' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/chat/message — edit mode (design system already generated)', () => {
  beforeEach(() => vi.clearAllMocks())

  const goodColors = {
    primary: '#1a56db', primaryForeground: '#ffffff',
    secondary: '#7e3af2', secondaryForeground: '#ffffff',
    background: '#ffffff', foreground: '#111928',
    success: '#0e9f6e', successForeground: '#ffffff',
    warning: '#c27803', warningForeground: '#ffffff',
    error: '#e02424', errorForeground: '#ffffff',
    border: '#e5e7eb', card: '#ffffff', cardForeground: '#111928',
    muted: '#f3f4f6', mutedForeground: '#374151',
  }
  const validComponent = (name: string) =>
    `export function ${name}(props) { return <div {...props} /> }`

  const fakeGeneratedDS = {
    id: 'ds-1', userId: 'user-1', name: 'Mi Brand', status: 'GENERATED',
    pendingEditSummary: null, pendingEditPatch: null,
    createdAt: new Date(), updatedAt: new Date(),
  }
  const fakeTokensRow = {
    id: 'tok-1', designSystemId: 'ds-1',
    colors: goodColors,
    typography: { fontFamily: 'Inter, sans-serif', fontFamilyDisplay: 'Inter, sans-serif' },
    colorScales: null, typographyScale: [],
    componentCode: validComponent('Button'),
    additionalComponents: {
      input: validComponent('Input'), alert: validComponent('Alert'),
      textarea: validComponent('Textarea'), chip: validComponent('Badge'),
    },
    wcagValid: true, wcagReport: { allPass: true, checks: [] },
    createdAt: new Date(), updatedAt: new Date(),
  }

  it('never calls interpretDesignSystemEdit while the design system is still DRAFT', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(geminiService.extractBrief).mockResolvedValue({
      assistantMessage: 'ok', brief: {
        tone: null, values: [], references: [], preferredColors: null,
        preferredFontMode: 'UNSET', preferredHeadingFont: null, preferredBodyFont: null,
        isComplete: false,
      },
    })
    vi.mocked(prisma.brandBrief.upsert).mockResolvedValue(fakeBrief)

    await request(app).post('/api/chat/message').set(auth).send({ designSystemId: 'ds-1', content: 'hola' })

    expect(geminiService.interpretDesignSystemEdit).not.toHaveBeenCalled()
  })

  it('applies a surgical single-component edit directly, without confirmation', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designTokens.findUniqueOrThrow).mockResolvedValue(fakeTokensRow)
    vi.mocked(geminiService.interpretDesignSystemEdit).mockResolvedValue({
      assistantMessage: 'Listo, redondeé más los bordes del badge.',
      needsConfirmation: false,
      confirmationSummary: null,
      confirmsPendingEdit: false,
      patch: {
        colors: null, typography: null, buttonComponent: null,
        additionalComponents: { chip: validComponent('Badge') + '\n// rounder' },
      },
    })
    vi.mocked(prisma.designTokens.update).mockResolvedValue({
      ...fakeTokensRow,
      additionalComponents: { ...fakeTokensRow.additionalComponents, chip: validComponent('Badge') + '\n// rounder' },
    })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Redondeá más los bordes del badge' })

    expect(res.status).toBe(200)
    expect(res.body.needsConfirmation).toBeFalsy()
    expect(res.body.tokens).toBeTruthy()

    // isolation: only additionalComponents was passed to the persistence update, colors/typography untouched
    const updateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    expect(updateArg.data).toHaveProperty('additionalComponents')
    expect(updateArg.data).not.toHaveProperty('colors')
    expect(updateArg.data).not.toHaveProperty('typography')
    expect(updateArg.data).not.toHaveProperty('componentCode')
  })

  it('a color change requires confirmation and does not touch DesignTokens yet', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designSystem.update).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(geminiService.interpretDesignSystemEdit).mockResolvedValue({
      assistantMessage: '¿Confirmás que cambie el primary a #123456? Esto afecta todos los botones y las escalas.',
      needsConfirmation: true,
      confirmationSummary: 'Cambiar colors.primary a #123456 (afecta botones y escalas derivadas)',
      confirmsPendingEdit: false,
      patch: {
        colors: { primary: '#123456' }, typography: null, buttonComponent: null, additionalComponents: null,
      },
    })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Cambiá el primary a #123456' })

    expect(res.status).toBe(200)
    expect(res.body.needsConfirmation).toBe(true)
    expect(prisma.designTokens.update).not.toHaveBeenCalled()
    expect(prisma.designTokens.findUniqueOrThrow).not.toHaveBeenCalled()

    const dsUpdateArg = vi.mocked(prisma.designSystem.update).mock.calls[0][0]
    expect(dsUpdateArg.data.pendingEditPatch).toMatchObject({ colors: { primary: '#123456' } })
    expect(dsUpdateArg.data.pendingEditSummary).toContain('#123456')
  })

  it('forces confirmation for a colors patch even if the model set needsConfirmation to false', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designSystem.update).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(geminiService.interpretDesignSystemEdit).mockResolvedValue({
      assistantMessage: 'Cambié el borde del input.',
      needsConfirmation: false, // model got it wrong — border is a shared color token
      confirmationSummary: null,
      confirmsPendingEdit: false,
      patch: {
        colors: { border: '#000000' }, typography: null, buttonComponent: null, additionalComponents: null,
      },
    })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Cambiá el borde del input' })

    expect(res.status).toBe(200)
    expect(res.body.needsConfirmation).toBe(true)
    expect(prisma.designTokens.update).not.toHaveBeenCalled()
  })

  it('confirming a pending edit applies the STORED patch, not a freshly re-generated one (drift regression)', async () => {
    const storedPatch = {
      colors: { primary: '#111111' }, typography: null, buttonComponent: null, additionalComponents: null,
    }
    const dsWithPendingEdit = {
      ...fakeGeneratedDS,
      pendingEditSummary: 'Cambiar colors.primary a #111111',
      pendingEditPatch: storedPatch,
    }
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(dsWithPendingEdit)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designTokens.findUniqueOrThrow).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designSystem.update).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.designTokens.update).mockResolvedValue({ ...fakeTokensRow, colors: { ...goodColors, primary: '#111111' } })

    // The model, re-run on the confirming turn, proposes a DIFFERENT color — must be ignored.
    vi.mocked(geminiService.interpretDesignSystemEdit).mockResolvedValue({
      assistantMessage: 'Listo, lo cambié.',
      needsConfirmation: false,
      confirmationSummary: null,
      confirmsPendingEdit: true,
      patch: {
        colors: { primary: '#999999' }, typography: null, buttonComponent: null, additionalComponents: null,
      },
    })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Sí, dale, confirmado' })

    expect(res.status).toBe(200)
    const tokensUpdateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    expect(tokensUpdateArg.data.colors).toMatchObject({ primary: '#111111' })
    expect(tokensUpdateArg.data.colors).not.toMatchObject({ primary: '#999999' })

    // pending edit is cleared after applying
    const dsUpdateArg = vi.mocked(prisma.designSystem.update).mock.calls[0][0]
    expect(dsUpdateArg.data.pendingEditSummary).toBeNull()
  })

  it('returns 422 (not a raw error) when a patched component breaks TypeScript-syntax validation', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeGeneratedDS)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.conversation.update).mockResolvedValue(fakeConversation)
    vi.mocked(prisma.designTokens.findUnique).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designTokens.findUniqueOrThrow).mockResolvedValue(fakeTokensRow)
    vi.mocked(geminiService.interpretDesignSystemEdit).mockResolvedValue({
      assistantMessage: 'Listo.',
      needsConfirmation: false,
      confirmationSummary: null,
      confirmsPendingEdit: false,
      patch: {
        colors: null, typography: null,
        buttonComponent: 'interface ButtonProps {}\nexport function Button(props: ButtonProps) { return <button /> }',
        additionalComponents: null,
      },
    })

    const res = await request(app)
      .post('/api/chat/message')
      .set(auth)
      .send({ designSystemId: 'ds-1', content: 'Cambiá el botón' })

    expect(res.status).toBe(422)
    expect(prisma.designTokens.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/chat/attachment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with attachment id for valid PDF', async () => {
    vi.mocked(prisma.designSystem.findFirst).mockResolvedValue(fakeDS)
    vi.mocked(prisma.attachment.create).mockResolvedValue({
      id: 'att-1', conversationId: 'conv-1',
      filename: 'brand.pdf', mimeType: 'application/pdf',
      storagePath: 'uploads/brand.pdf', createdAt: new Date(),
    })
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(fakeConversation)

    const res = await request(app)
      .post('/api/chat/attachment')
      .set(auth)
      .field('designSystemId', 'ds-1')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'brand.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('filename')
  })

  it('returns 400 for unsupported file type', async () => {
    const res = await request(app)
      .post('/api/chat/attachment')
      .set(auth)
      .field('designSystemId', 'ds-1')
      .attach('file', Buffer.from('bad content'), { filename: 'doc.txt', contentType: 'text/plain' })

    expect(res.status).toBe(400)
  })

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/chat/attachment')
      .field('designSystemId', 'ds-1')
      .attach('file', Buffer.from('%PDF'), { filename: 'f.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(401)
  })
})
