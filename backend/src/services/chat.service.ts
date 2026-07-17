import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { extractBrief, interpretDesignSystemEdit, type AdditionalComponents, type TokensPatch } from './gemini.service'
import { applyTokensPatch } from './editTokens.service'
import { TokensNotReadyError } from '../lib/errors'

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export { TokensNotReadyError }
export { PatchExportContractError } from './editTokens.service'
export { InvalidComponentCodeError, DisallowedImportError } from '../lib/errors'

type ChatMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }

export async function sendMessage(userId: string, designSystemId: string, content: string) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const conversation = await prisma.conversation.upsert({
    where: { designSystemId },
    update: {},
    create: { designSystemId, messages: [] },
  })

  const history = conversation.messages as ChatMessage[]
  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: 'user', content, timestamp: new Date().toISOString() },
  ]

  if (ds.status === 'DRAFT') {
    return sendBriefMessage(designSystemId, updatedHistory)
  }

  return sendEditMessage(ds, designSystemId, updatedHistory)
}

async function sendBriefMessage(designSystemId: string, updatedHistory: ChatMessage[]) {
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
      preferredFontMode: brief.preferredFontMode,
      preferredHeadingFont: brief.preferredHeadingFont,
      preferredBodyFont: brief.preferredBodyFont,
      isComplete: brief.isComplete,
    },
    create: {
      designSystemId,
      tone: brief.tone,
      values: brief.values,
      references: brief.references,
      preferredColors,
      preferredFontMode: brief.preferredFontMode,
      preferredHeadingFont: brief.preferredHeadingFont,
      preferredBodyFont: brief.preferredBodyFont,
      isComplete: brief.isComplete,
    },
  })

  return { message: assistantMessage, brief: updatedBrief }
}

type EditableDesignSystem = {
  id: string
  status: string
  pendingEditSummary: string | null
  pendingEditPatch: Prisma.JsonValue
}

// Chat-driven edits to a design system that's already been generated (status != DRAFT). See
// editTokens.service.ts / gemini.service.ts's interpretDesignSystemEdit for the surgical-edit +
// confirmation-flow design (patch is always persisted before being treated as pending, and a
// confirmed edit always applies that stored patch — never a freshly re-generated one).
async function sendEditMessage(
  ds: EditableDesignSystem,
  designSystemId: string,
  updatedHistory: ChatMessage[],
) {
  const tokens = await prisma.designTokens.findUnique({ where: { designSystemId } })
  if (!tokens) throw new TokensNotReadyError()

  const currentTokensContext = {
    colors: tokens.colors as Record<string, string>,
    typography: tokens.typography as Record<string, unknown>,
    buttonComponent: tokens.componentCode ?? '',
    additionalComponents: (tokens.additionalComponents ?? {
      input: '', alert: '', textarea: '', chip: '',
    }) as AdditionalComponents,
  }

  const pendingEdit = ds.pendingEditSummary ? { summary: ds.pendingEditSummary } : null

  const interpretation = await interpretDesignSystemEdit(
    updatedHistory.map((m) => ({ role: m.role, content: m.content })),
    currentTokensContext,
    pendingEdit,
  )

  const finalHistory: ChatMessage[] = [
    ...updatedHistory,
    { role: 'assistant', content: interpretation.assistantMessage, timestamp: new Date().toISOString() },
  ]
  await prisma.conversation.update({ where: { designSystemId }, data: { messages: finalHistory } })

  if (interpretation.confirmsPendingEdit && ds.pendingEditPatch) {
    const updatedTokens = await applyTokensPatch(designSystemId, ds.pendingEditPatch as unknown as TokensPatch)
    await prisma.designSystem.update({
      where: { id: designSystemId },
      data: { pendingEditSummary: null, pendingEditPatch: Prisma.JsonNull },
    })
    return {
      message: interpretation.assistantMessage,
      tokens: updatedTokens,
      wcagReport: updatedTokens.wcagReport,
    }
  }

  // Not a confirmation of the previous proposal — any stale pending edit is superseded/discarded.
  if (ds.pendingEditPatch) {
    await prisma.designSystem.update({
      where: { id: designSystemId },
      data: { pendingEditSummary: null, pendingEditPatch: Prisma.JsonNull },
    })
  }

  const patch = interpretation.patch
  // Forced in code, not trusted from the model: any patch touching shared colors/typography is
  // a global change and always requires confirmation, regardless of what needsConfirmation said.
  const needsConfirmation = interpretation.needsConfirmation || !!(patch && (patch.colors || patch.typography))

  if (needsConfirmation) {
    if (patch) {
      await prisma.designSystem.update({
        where: { id: designSystemId },
        data: {
          pendingEditSummary: interpretation.confirmationSummary ?? 'Cambio propuesto pendiente de confirmación',
          pendingEditPatch: patch as unknown as Prisma.InputJsonValue,
        },
      })
    }
    return { message: interpretation.assistantMessage, needsConfirmation: true }
  }

  if (patch && (patch.buttonComponent || patch.additionalComponents)) {
    const updatedTokens = await applyTokensPatch(designSystemId, patch)
    return {
      message: interpretation.assistantMessage,
      tokens: updatedTokens,
      wcagReport: updatedTokens.wcagReport,
    }
  }

  return { message: interpretation.assistantMessage }
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
