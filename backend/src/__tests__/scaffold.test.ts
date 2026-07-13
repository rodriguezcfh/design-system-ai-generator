import { describe, it, expect } from 'vitest'
import {
  buildPostcssConfig, buildVercelConfig,
  buildColorScalesJson, buildTypographyScaleJson, buildFoundationsStory,
} from '../lib/scaffold'
import { detectTypeScriptSyntax } from '../lib/validateComponentCode'

describe('buildPostcssConfig', () => {
  it('wires up the tailwindcss and autoprefixer plugins so Tailwind directives get processed', () => {
    const config = buildPostcssConfig()

    expect(config).toContain('tailwindcss')
    expect(config).toContain('autoprefixer')
    expect(config).toContain('module.exports')
  })
})

describe('buildVercelConfig', () => {
  it('sets the Storybook build command and static output directory so any Vercel import works without manual config', () => {
    const config = JSON.parse(buildVercelConfig())

    expect(config.buildCommand).toBe('npm run build-storybook')
    expect(config.outputDirectory).toBe('storybook-static')
  })
})

describe('buildColorScalesJson', () => {
  it('serializes the color scales as-is', () => {
    const scales = { primary: { familyName: 'Indigo', shades: { '500': '#6366f1' } } }
    expect(JSON.parse(buildColorScalesJson(scales))).toEqual(scales)
  })

  it('falls back to an empty object for legacy design systems with no scales', () => {
    expect(JSON.parse(buildColorScalesJson(null))).toEqual({})
  })
})

describe('buildTypographyScaleJson', () => {
  it('serializes the typography scale as-is', () => {
    const scale = [{ name: 'Display', sizePx: 48 }]
    expect(JSON.parse(buildTypographyScaleJson(scale))).toEqual(scale)
  })

  it('falls back to an empty array for legacy design systems with no scale', () => {
    expect(JSON.parse(buildTypographyScaleJson(null))).toEqual([])
  })
})

describe('buildFoundationsStory', () => {
  it('is plain JS + JSX — no TypeScript syntax that would break the .jsx Storybook parser', () => {
    expect(detectTypeScriptSyntax(buildFoundationsStory())).toEqual([])
  })

  it('imports all four token JSON files it needs to render', () => {
    const story = buildFoundationsStory()
    expect(story).toContain("from '../tokens/colors.json'")
    expect(story).toContain("from '../tokens/typography.json'")
    expect(story).toContain("from '../tokens/colorScales.json'")
    expect(story).toContain("from '../tokens/typographyScale.json'")
  })

  it('registers a CSF default export with a title and an Overview story', () => {
    const story = buildFoundationsStory()
    expect(story).toContain("title: 'Foundations/Colors & Typography'")
    expect(story).toContain('export const Overview')
  })

  it('covers the same sections as the app PreviewPanel: semantic, neutral, surface, scales, typography table', () => {
    const story = buildFoundationsStory()
    expect(story).toContain('Colores semánticos')
    expect(story).toContain('Neutros')
    expect(story).toContain('Superficies')
    expect(story).toContain('Escalas de color')
    expect(story).toContain('Escala tipográfica')
  })
})
