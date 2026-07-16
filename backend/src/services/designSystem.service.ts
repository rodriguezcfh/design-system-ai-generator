import prisma from '../lib/prisma'
import { buildFigmaTokensJson } from '../lib/designTokensExport'
import { NotFoundError, TokensNotReadyError } from '../lib/errors'
import type { TypographyStyle } from './gemini.service'

export { NotFoundError, TokensNotReadyError }

export async function createDesignSystem(userId: string, name: string) {
  return prisma.designSystem.create({
    data: { userId, name },
    select: { id: true, name: true, status: true, createdAt: true, updatedAt: true },
  })
}

export async function listDesignSystems(userId: string) {
  return prisma.designSystem.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, status: true, createdAt: true, updatedAt: true },
  })
}

export async function getDesignSystem(userId: string, id: string) {
  const ds = await prisma.designSystem.findFirst({
    where: { id, userId },
    select: {
      id: true, name: true, status: true, createdAt: true, updatedAt: true, tokens: true,
      // A design system can have several EMBEDDED repos but at most one STANDALONE — the
      // frontend only ever needs the STANDALONE one (e.g. for the Vercel deploy button, which
      // only makes sense for a repo that actually has a Storybook to deploy).
      repositories: { where: { mode: 'STANDALONE' }, take: 1 },
    },
  })
  if (!ds) return null

  const { repositories, ...rest } = ds
  const designSystem = { ...rest, repository: repositories?.[0] ?? null }

  const [conversation, brief] = await Promise.all([
    prisma.conversation.findUnique({
      where: { designSystemId: id },
      include: { attachments: true },
    }),
    prisma.brandBrief.findUnique({
      where: { designSystemId: id },
      select: { isComplete: true },
    }),
  ])

  return {
    designSystem,
    conversation: conversation ? { ...conversation, brief } : null,
  }
}

export async function deleteDesignSystem(userId: string, id: string): Promise<void> {
  const result = await prisma.designSystem.deleteMany({ where: { id, userId } })
  if (result.count === 0) throw new NotFoundError('Design system not found')
}

export async function getFigmaTokensExport(userId: string, id: string): Promise<string> {
  const ds = await prisma.designSystem.findFirst({ where: { id, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const tokens = await prisma.designTokens.findUnique({ where: { designSystemId: id } })
  if (!tokens) throw new TokensNotReadyError()

  return buildFigmaTokensJson(
    tokens.colors as Record<string, string>,
    tokens.typography as { fontFamily?: string; fontFamilyDisplay?: string; lineHeights?: Record<string, string> },
    tokens.typographyScale as TypographyStyle[] | null,
  )
}
