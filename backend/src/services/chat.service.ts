import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { extractBrief } from './gemini.service'

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }

export async function sendMessage(userId: string, designSystemId: string, content: string) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const conversation = await prisma.conversation.upsert({
    where: { designSystemId },
    update: {},
    create: { designSystemId, messages: [] },
  })

  const history = (conversation.messages as ChatMessage[])
  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: 'user', content, timestamp: new Date().toISOString() },
  ]

  const { assistantMessage, brief } = await extractBrief(
    updatedHistory.map((m) => ({ role: m.role, content: m.content })),
  )
  const preferredColors = brief.preferredColors ?? Prisma.JsonNull

  const finalHistory: ChatMessage[] = [
    ...updatedHistory,
    { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() },
  ]

  await prisma.conversation.update({
    where: { designSystemId },
    data: { messages: finalHistory },
  })

  const updatedBrief = await prisma.brandBrief.upsert({
    where: { designSystemId },
    update: {
      tone: brief.tone,
      values: brief.values,
      references: brief.references,
      preferredColors,
      preferredHeadingFont: brief.preferredHeadingFont,
      preferredBodyFont: brief.preferredBodyFont,
    },
    create: {
      designSystemId,
      tone: brief.tone,
      values: brief.values,
      references: brief.references,
      preferredColors,
      preferredHeadingFont: brief.preferredHeadingFont,
      preferredBodyFont: brief.preferredBodyFont,
    },
  })

  return { message: assistantMessage, brief: updatedBrief }
}

export async function saveAttachment(
  userId: string,
  designSystemId: string,
  file: Express.Multer.File,
) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const conversation = await prisma.conversation.upsert({
    where: { designSystemId },
    update: {},
    create: { designSystemId, messages: [] },
  })

  // storagePath is a placeholder — replace with cloud storage URL in production
  const attachment = await prisma.attachment.create({
    data: {
      conversationId: conversation.id,
      filename: file.originalname,
      mimeType: file.mimetype,
      storagePath: `uploads/${Date.now()}-${file.originalname}`,
    },
  })

  return attachment
}
