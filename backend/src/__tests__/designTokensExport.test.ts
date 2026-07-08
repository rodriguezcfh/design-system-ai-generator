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
  it('outputs W3C DTCG-shaped color tokens ($type/$value) in kebab-case', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, null))

    expect(json.color.primary).toEqual({ $type: 'color', $value: '#0077B6' })
    expect(json.color['primary-foreground']).toEqual({ $type: 'color', $value: '#FFFFFF' })
  })

  it('resolves the display/heading font from fontFamilyDisplay and body from fontFamily', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, typographyScale))

    expect(json.typography.display.$value.fontFamily).toBe('Kiona, sans-serif')
    expect(json.typography['heading-1'].$value.fontFamily).toBe('Kiona, sans-serif')
    expect(json.typography.body.$value.fontFamily).toBe('Montserrat, sans-serif')
  })

  it('encodes size in px and weight as a number', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, typographyScale))

    expect(json.typography.display.$value.fontSize).toBe('48px')
    expect(json.typography.display.$value.fontWeight).toBe(700)
  })

  it('omits the typography group entirely when there is no typographyScale (legacy design systems)', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, null))

    expect(json).not.toHaveProperty('typography')
    expect(json).toHaveProperty('color')
  })

  it('never includes component code — only color and typography groups can exist', () => {
    const json = JSON.parse(buildFigmaTokensJson(colors, typography, typographyScale))

    expect(Object.keys(json).sort()).toEqual(['color', 'typography'])
  })
})
