import prisma from '../lib/prisma'

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
    select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, tokens: true },
  })
  if (!ds) return null

  const conversation = await prisma.conversation.findUnique({
    where: { designSystemId: id },
    include: { attachments: true },
  })

  return { designSystem: ds, conversation }
}
