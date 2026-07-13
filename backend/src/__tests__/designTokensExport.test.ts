import { describe, it, expect } from 'vitest'
import { buildFigmaTokensJson } from '../lib/designTokensExport'

const colors = {
  primary: '#0077B6',
  primaryForeground: '#FFFFFF',
  secondary: '#00F5D4',
}

const typography = {
  fontFamily: 'Montserrat, sans-serif',
  fontFamilyDisplay: 'Kiona, sans-serif',
  lineHeights: { normal: '1.5' },
}

const typographyScale = [
  { name: 'Display', description: 'Héroe', sizePx: 48, sizeRem: 3, weightName: 'Bold', weightValue: 700, role: 'display' as const },
  { name: 'Heading 1', description: 'Títulos', sizePx: 36, sizeRem: 2.25, weightName: 'Bold', weightValue: 700, role: 'heading' as const },
  { name: 'Body', description: 'Texto', sizePx: 16, sizeRem: 1, weightName: 'Regular', weightValue: 400, role: 'body' as const },
]

describe('buildFigmaTokensJson', () => {
  it('nests every token set under a top-level "global" set, as Tokens Studio for Figma requires', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, null))

    expect(json).toHaveProperty('global')
    expect(json.global).toHaveProperty('color')
    expect(json).not.toHaveProperty('color')
  })

  it('outputs $value before $type for color tokens, in kebab-case', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, null))

    expect(json.global.color.primary).toEqual({ $value: '#0077B6', $type: 'color' })
    expect(json.global.color['primary-foreground']).toEqual({ $value: '#FFFFFF', $type: 'color' })
  })

  it('resolves the display/heading font from fontFamilyDisplay and body from fontFamily', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, typographyScale))

    expect(json.global.typography.display.$value.fontFamily).toBe('Kiona, sans-serif')
    expect(json.global.typography['heading-1'].$value.fontFamily).toBe('Kiona, sans-serif')
    expect(json.global.typography.body.$value.fontFamily).toBe('Montserrat, sans-serif')
  })

  it('encodes size in px and weight as a named string (Tokens Studio convention), not a number', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, typographyScale))

    expect(json.global.typography.display.$value.fontSize).toBe('48px')
    expect(json.global.typography.display.$value.fontWeight).toBe('Bold')
    expect(json.global.typography.body.$value.fontWeight).toBe('Regular')
  })

  it('omits the typography group entirely when there is no typographyScale (legacy design systems)', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, null))

    expect(json.global).not.toHaveProperty('typography')
    expect(json.global).toHaveProperty('color')
  })

  it('never includes component code — only color and typography groups can exist under global', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, typographyScale))

    expect(Object.keys(json)).toEqual(['global'])
    expect(Object.keys(json.global).sort()).toEqual(['color', 'typography'])
  })
})
