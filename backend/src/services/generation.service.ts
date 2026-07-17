import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { generateDesignSystem } from './gemini.service'
import { validatePalette, enforcePaletteCompliance } from './wcag.service'
import { buildColorScaleFamily, buildNeutralScaleFamily } from '../lib/colorScale'
import { assertValidComponentCode } from '../lib/validateComponentCode'
import { NotFoundError, BriefNotReadyError, InvalidComponentCodeError, DisallowedImportError } from '../lib/errors'

export { NotFoundError, BriefNotReadyError, InvalidComponentCodeError, DisallowedImportError }

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
    preferredFontMode: brief.preferredFontMode,
    preferredHeadingFont: brief.preferredHeadingFont,
    preferredBodyFont: brief.preferredBodyFont,
  })

  assertValidComponentCode('Button', generated.buttonComponent)
  assertValidComponentCode('Input', generated.additionalComponents.input)
  assertValidComponentCode('Alert', generated.additionalComponents.alert)
  assertValidComponentCode('Textarea', generated.additionalComponents.textarea)
  assertValidComponentCode('Badge', generated.additionalComponents.chip)

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
      additionalComponents: generated.additionalComponents as unknown as Prisma.InputJsonValue,
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
      additionalComponents: generated.additionalComponents as unknown as Prisma.InputJsonValue,
      wcagValid: wcagReport.allPass,
      wcagReport: wcagReport as unknown as Prisma.InputJsonValue,
    },
  })

  await prisma.designSystem.update({
    where: { id: designSystemId },
    // A full regeneration invalidates any chat-proposed edit still awaiting confirmation.
    data: { status: 'GENERATED', pendingEditSummary: null, pendingEditPatch: Prisma.JsonNull },
  })

  return { tokens, wcagReport }
}
