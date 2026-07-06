import prisma from '../lib/prisma'
import { generateDesignSystem } from './gemini.service'
import { validatePalette } from './wcag.service'
import { NotFoundError, BriefNotReadyError } from '../lib/errors'

export { NotFoundError, BriefNotReadyError }

export async function generateForDesignSystem(userId: string, designSystemId: string) {
  const ds = await prisma.designSystem.findFirst({ where: { id: designSystemId, userId } })
  if (!ds) throw new NotFoundError('Design system not found')

  const brief = await prisma.brandBrief.findUnique({ where: { designSystemId } })
  if (!brief) throw new BriefNotReadyError()

  const generated = await generateDesignSystem({
    tone: brief.tone,
    values: brief.values as string[],
    references: brief.references as string[],
  })

  const wcagReport = validatePalette(generated.colors)

  const tokens = await prisma.designTokens.upsert({
    where: { designSystemId },
    update: {
      colors: generated.colors,
      typography: generated.typography,
      componentCode: generated.buttonComponent,
      wcagValid: wcagReport.allPass,
      wcagReport: wcagReport as object,
    },
    create: {
      designSystemId,
      colors: generated.colors,
      typography: generated.typography,
      componentCode: generated.buttonComponent,
      wcagValid: wcagReport.allPass,
      wcagReport: wcagReport as object,
    },
  })

  await prisma.designSystem.update({
    where: { id: designSystemId },
    data: { status: 'GENERATED' },
  })

  return { tokens, wcagReport }
}
