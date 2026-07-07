import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import * as geminiService from '../services/gemini.service'
import { signToken } from '../lib/jwt'

vi.mock('../lib/prisma', () => ({
  default: {
    designSystem: { findFirst: vi.fn() },
    conversation: { upsert: vi.fn(), update: vi.fn() },
    brandBrief: { upsert: vi.fn() },
    attachment: { create: vi.fn() },
  },
}))

vi.mock('../services/gemini.service', () => ({
  extractBrief: vi.fn(),
}))

const validToken = signToken({ userId: 'user-1' })
const auth = { Authorization: `Bearer ${validToken}` }

const fakeDS = {
  id: 'ds-1', userId: 'user-1', name: 'Mi Brand', status: 'DRAFT',
  createdAt: new Date(), updatedAt: new Date(),
}
const fakeConversation = {
  id: 'conv-1', designSystemId: 'ds-1', messages: [],
  createdAt: new Date(), updatedAt: new Date(),
}
const fakeBrief = {
  id: 'brief-1', designSystemId: 'ds-1', tone: 'warm',
  values: ['trust'], references: [], rawSummary: null,
  preferredColors: null, preferredHeadingFont: null, preferredBodyFont: null,
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
        preferredColors: null, preferredHeadingFont: null, preferredBodyFont: null,
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
        preferredHeadingFont: 'Kiona',
        preferredBodyFont: 'Montserrat',
        isComplete: false,
      },
    })
    vi.mocked(prisma.brandBrief.upsert).mockResolvedValue({
      ...fakeBrief,
      preferredColors: ['#0077B6', '#00F5D4'],
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
      preferredHeadingFont: 'Kiona',
      preferredBodyFont: 'Montserrat',
    })
    expect(upsertArg.update).toMatchObject({
      preferredColors: ['#0077B6', '#00F5D4'],
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
        preferredColors: null, preferredHeadingFont: null, preferredBodyFont: null,
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
