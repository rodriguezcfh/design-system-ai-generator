import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { generateDesignSystem } from './gemini.service'
import { validatePalette } from './wcag.service'
import { buildColorScaleFamily, buildNeutralScaleFamily } from '../lib/colorScale'
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
    preferredColors: brief.preferredColors as string[] | null,
    preferredHeadingFont: brief.preferredHeadingFont,
    preferredBodyFont: brief.preferredBodyFont,
  })

  const wcagReport = validatePalette(generated.colors)

  const colorScales = {
    primary: buildColorScaleFamily(generated.colors.primary),
    accent: buildColorScaleFamily(generated.colors.secondary),
    neutral: buildNeutralScaleFamily(generated.colors.foreground),
  }

  const tokens = await prisma.designTokens.upsert({
    where: { designSystemId },
    update: {
      colors: generated.colors as Prisma.InputJsonValue,
      typography: generated.typography as Prisma.InputJsonValue,
      colorScales: colorScales as unknown as Prisma.InputJsonValue,
      typographyScale: generated.typographyScale as unknown as Prisma.InputJsonValue,
      componentCode: generated.buttonComponent,
      wcagValid: wcagReport.allPass,
      wcagReport: wcagReport as unknown as Prisma.InputJsonValue,
    },
    create: {
      designSystemId,
      colors: generated.colors as Prisma.InputJsonValue,
      typography: generated.typography as Prisma.InputJsonValue,
      colorScales: colorScales as unknown as Prisma.InputJsonValue,
      typographyScale: generated.typographyScale as unknown as Prisma.InputJsonValue,
      componentCode: generated.buttonComponent,
      wcagValid: wcagReport.allPass,
      wcagReport: wcagReport as unknown as Prisma.InputJsonValue,
    },
  })

  await prisma.designSystem.update({
    where: { id: designSystemId },
    data: { status: 'GENERATED' },
  })

  return { tokens, wcagReport }
}
