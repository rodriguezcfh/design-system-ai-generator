import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '../lib/prisma'
import { applyTokensPatch, PatchExportContractError } from '../services/editTokens.service'

vi.mock('../lib/prisma', () => ({
  default: {
    designTokens: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}))

const goodColors = {
  primary: '#1a56db', primaryForeground: '#ffffff',
  secondary: '#7e3af2', secondaryForeground: '#ffffff',
  background: '#ffffff', foreground: '#111928',
  success: '#0e9f6e', successForeground: '#ffffff',
  warning: '#c27803', warningForeground: '#ffffff',
  error: '#e02424', errorForeground: '#ffffff',
  border: '#e5e7eb', card: '#ffffff', cardForeground: '#111928',
  muted: '#f3f4f6', mutedForeground: '#374151',
}
const validComponent = (name: string) => `export function ${name}(props) { return <div {...props} /> }`

const fakeTokensRow = {
  id: 'tok-1', designSystemId: 'ds-1',
  colors: goodColors,
  typography: { fontFamily: 'Inter, sans-serif', fontFamilyDisplay: 'Inter, sans-serif' },
  colorScales: { primary: { familyName: 'Blue', shades: {} }, accent: { familyName: 'Purple', shades: {} }, neutral: { familyName: 'Gray', shades: {} } },
  typographyScale: [],
  componentCode: validComponent('Button'),
  additionalComponents: {
    input: validComponent('Input'), alert: validComponent('Alert'),
    textarea: validComponent('Textarea'), chip: validComponent('Badge'),
  },
  wcagValid: true, wcagReport: { allPass: true, checks: [] },
  createdAt: new Date(), updatedAt: new Date(),
}

const emptyPatch = { colors: null, typography: null, buttonComponent: null, additionalComponents: null }

describe('applyTokensPatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.designTokens.findUniqueOrThrow).mockResolvedValue(fakeTokensRow)
    vi.mocked(prisma.designTokens.update).mockImplementation(async ({ data }) => ({ ...fakeTokensRow, ...data }) as typeof fakeTokensRow)
  })

  it('patching one additionalComponents key leaves the other 3 byte-identical (isolation guarantee)', async () => {
    const newAlert = validComponent('Alert') + '\n// updated'
    await applyTokensPatch('ds-1', { ...emptyPatch, additionalComponents: { alert: newAlert } })

    const updateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    const persistedAdditional = updateArg.data.additionalComponents as Record<string, string>
    expect(persistedAdditional.alert).toBe(newAlert)
    expect(persistedAdditional.input).toBe(fakeTokensRow.additionalComponents.input)
    expect(persistedAdditional.textarea).toBe(fakeTokensRow.additionalComponents.textarea)
    expect(persistedAdditional.chip).toBe(fakeTokensRow.additionalComponents.chip)
  })

  it('a component-only patch does not touch colors, typography, or componentCode', async () => {
    await applyTokensPatch('ds-1', { ...emptyPatch, additionalComponents: { chip: validComponent('Badge') + '\n// x' } })

    const updateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    expect(updateArg.data).not.toHaveProperty('colors')
    expect(updateArg.data).not.toHaveProperty('typography')
    expect(updateArg.data).not.toHaveProperty('componentCode')
    expect(updateArg.data).not.toHaveProperty('colorScales')
  })

  it('a colors patch touching primary recomputes colorScales and revalidates WCAG', async () => {
    await applyTokensPatch('ds-1', { ...emptyPatch, colors: { primary: '#123456' } })

    const updateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    expect(updateArg.data).toHaveProperty('colorScales')
    expect(updateArg.data).toHaveProperty('wcagValid')
    expect(updateArg.data).toHaveProperty('wcagReport')
    const persistedColors = updateArg.data.colors as Record<string, string>
    expect(persistedColors.primary).toBe('#123456')
    // untouched colors survive the merge
    expect(persistedColors.secondary).toBe(goodColors.secondary)
  })

  it('a colors patch NOT touching primary/secondary/foreground revalidates WCAG but skips colorScales recompute', async () => {
    await applyTokensPatch('ds-1', { ...emptyPatch, colors: { error: '#123456' } })

    const updateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    expect(updateArg.data).not.toHaveProperty('colorScales')
    expect(updateArg.data).toHaveProperty('wcagValid')
    expect(updateArg.data).toHaveProperty('wcagReport')
  })

  it('throws PatchExportContractError (not a raw TypeError) when a patched component breaks its named export', async () => {
    await expect(applyTokensPatch('ds-1', {
      ...emptyPatch,
      additionalComponents: { input: 'const somethingElse = () => null' },
    })).rejects.toThrow(PatchExportContractError)

    expect(prisma.designTokens.update).not.toHaveBeenCalled()
  })

  it('normalizes an export-default patched component instead of rejecting it outright', async () => {
    await applyTokensPatch('ds-1', {
      ...emptyPatch,
      buttonComponent: `function Button(props) { return <button {...props} /> }\nexport default Button`,
    })

    const updateArg = vi.mocked(prisma.designTokens.update).mock.calls[0][0]
    expect(updateArg.data.componentCode).not.toMatch(/export\s+default/)
    expect(updateArg.data.componentCode).toContain('export { Button }')
  })

  it('re-reads DesignTokens fresh instead of trusting a stale row (defends against concurrent edits)', async () => {
    await applyTokensPatch('ds-1', { ...emptyPatch, additionalComponents: { chip: validComponent('Badge') } })
    expect(prisma.designTokens.findUniqueOrThrow).toHaveBeenCalledWith({ where: { designSystemId: 'ds-1' } })
  })

  it('an all-null patch is a no-op — no DB write', async () => {
    const result = await applyTokensPatch('ds-1', emptyPatch)
    expect(prisma.designTokens.update).not.toHaveBeenCalled()
    expect(result).toEqual(fakeTokensRow)
  })
})
