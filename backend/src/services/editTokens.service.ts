import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { assertValidComponentCode } from '../lib/validateComponentCode'
import { normalizeComponentExport, hasNamedExport } from '../lib/buildPackage'
import { enforcePaletteCompliance, validatePalette } from './wcag.service'
import { buildColorScaleFamily, buildNeutralScaleFamily } from '../lib/colorScale'
import { PatchExportContractError } from '../lib/errors'
import type { TokensPatch } from './gemini.service'

export { PatchExportContractError }

const ADDITIONAL_COMPONENT_NAMES: Record<string, string> = {
  input: 'Input',
  alert: 'Alert',
  textarea: 'Textarea',
  chip: 'Badge',
}

const SCALE_SOURCE_KEYS = ['primary', 'secondary', 'foreground']

function assertPatchedComponentValid(name: string, code: string): string {
  assertValidComponentCode(name, code)
  const normalized = normalizeComponentExport(name, code)
  if (!hasNamedExport(name, normalized)) throw new PatchExportContractError(name)
  return normalized
}

// Applies a (possibly partial) chat-driven edit to an already-generated design system. Re-reads
// DesignTokens fresh — the Gemini call that produced this patch can take a while, so a row read
// before that call is never trusted — merges patch fields into the EXISTING JSON blobs in
// application code (Prisma replaces Json columns wholesale, it never merges), and only
// recomputes colorScales/WCAG when colors actually changed. Any field left null in the patch is
// left completely untouched in the database — this is the enforcement mechanism for "never
// regenerate/overwrite what wasn't asked for."
export async function applyTokensPatch(designSystemId: string, patch: TokensPatch) {
  const current = await prisma.designTokens.findUniqueOrThrow({ where: { designSystemId } })

  if (!patch.buttonComponent && !patch.additionalComponents && !patch.typography && !patch.colors) {
    return current
  }

  const normalizedButtonComponent = patch.buttonComponent
    ? assertPatchedComponentValid('Button', patch.buttonComponent)
    : null

  let mergedAdditionalComponents: Record<string, string> | null = null
  if (patch.additionalComponents) {
    const existingAdditionalComponents = (current.additionalComponents ?? {}) as Record<string, string>
    const normalizedPatch: Record<string, string> = {}
    for (const [key, code] of Object.entries(patch.additionalComponents)) {
      if (!code) continue
      normalizedPatch[key] = assertPatchedComponentValid(ADDITIONAL_COMPONENT_NAMES[key] ?? key, code)
    }
    mergedAdditionalComponents = { ...existingAdditionalComponents, ...normalizedPatch }
  }

  let mergedColors: Record<string, string> | null = null
  let wcagValid: boolean | null = null
  let wcagReportValue: unknown = null
  let colorScales: unknown = null
  if (patch.colors) {
    const existingColors = current.colors as Record<string, string>
    mergedColors = enforcePaletteCompliance({ ...existingColors, ...patch.colors })

    const wcagReport = validatePalette(mergedColors)
    wcagValid = wcagReport.allPass
    wcagReportValue = wcagReport

    const scalesAffected = SCALE_SOURCE_KEYS.some((key) => patch.colors && key in patch.colors)
    if (scalesAffected) {
      colorScales = {
        primary: buildColorScaleFamily(mergedColors.primary),
        accent: buildColorScaleFamily(mergedColors.secondary),
        neutral: buildNeutralScaleFamily(mergedColors.foreground),
      }
    }
  }

  return prisma.designTokens.update({
    where: { designSystemId },
    data: {
      ...(normalizedButtonComponent ? { componentCode: normalizedButtonComponent } : {}),
      ...(mergedAdditionalComponents
        ? { additionalComponents: mergedAdditionalComponents as unknown as Prisma.InputJsonValue }
        : {}),
      ...(patch.typography ? { typography: patch.typography as Prisma.InputJsonValue } : {}),
      ...(mergedColors
        ? {
          colors: mergedColors as Prisma.InputJsonValue,
          wcagValid: wcagValid as boolean,
          wcagReport: wcagReportValue as unknown as Prisma.InputJsonValue,
          ...(colorScales ? { colorScales: colorScales as unknown as Prisma.InputJsonValue } : {}),
        }
        : {}),
    },
  })
}
