import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { generateDesignSystem } from './gemini.service'
import { validatePalette, enforcePaletteCompliance } from './wcag.service'
import { buildColorScaleFamily, buildNeutralScaleFamily } from '../lib/colorScale'
import { assertNoTypeScriptSyntax } from '../lib/validateComponentCode'
import { NotFoundError, BriefNotReadyError, InvalidComponentCodeError } from '../lib/errors'

export { NotFoundError, BriefNotReadyError, InvalidComponentCodeError }

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

  assertNoTypeScriptSyntax(generated.buttonComponent)

  const colors = enforcePaletteCompliance(generated.colors)
  const wcagReport = validatePalette(colors)

  const colorScales = {
    primary: buildColorScaleFamily(colors.primary),
    accent: buildColorScaleFamily(colors.secondary),
    neutral: buildNeutralScaleFamily(colors.foreground),
  }

  const tokens = await prisma.designTokens.upsert({
    where: { designSystemId },
    update: {
      colors: colors as Prisma.InputJsonValue,
      typography: generated.typography as Prisma.InputJsonValue,
      colorScales: colorScales as unknown as Prisma.InputJsonValue,
      typographyScale: generated.typographyScale as unknown as Prisma.InputJsonValue,
      componentCode: generated.buttonComponent,
      wcagValid: wcagReport.allPass,
      wcagReport: wcagReport as unknown as Prisma.InputJsonValue,
    },
    create: {
      designSystemId,
      colors: colors as Prisma.InputJsonValue,
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
