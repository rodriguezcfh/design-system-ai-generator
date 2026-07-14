import { describe, it, expect } from 'vitest'
import {
  buildPostcssConfig, buildVercelConfig,
  buildColorScalesJson, buildTypographyScaleJson, buildFoundationsStory,
  buildInputStories, buildAlertStories, buildTextareaStories, buildBadgeStories,
  buildTailwindConfig, buildTailwindPreset, buildPackageJson, buildIndexEntry, buildReadme,
} from '../lib/scaffold'
import { detectTypeScriptSyntax, detectDisallowedImports } from '../lib/validateComponentCode'

const fakeColors = {
  primary: '#1a56db', primaryForeground: '#ffffff',
  secondary: '#7e3af2', secondaryForeground: '#ffffff',
  background: '#ffffff', foreground: '#111928',
}
const fakeColorScales = {
  primary: { familyName: 'Blue', shades: {
    '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa',
    '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a',
  } },
  accent: { familyName: 'Purple', shades: {
    '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '300': '#c4b5fd', '400': '#a78bfa',
    '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#4c1d95',
  } },
  neutral: { familyName: 'Gray', shades: {
    '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af',
    '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827',
  } },
}
const fakeTypography = { fontFamily: 'Inter, sans-serif' }

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

describe('buildTailwindConfig', () => {
  it('delegates colors/typography to the shared preset instead of repeating them', () => {
    const config = buildTailwindConfig(fakeColors, fakeColorScales)

    expect(config).toContain("presets: [require('./tailwind-preset.js')]")
    expect(config).not.toContain('primaryForeground')
  })

  it('keeps its own content globs for the local Storybook build', () => {
    const config = buildTailwindConfig(fakeColors, fakeColorScales)

    expect(config).toContain("content: ['./src/**/*.{js,jsx,ts,tsx}', './.storybook/**/*.{js,jsx}']")
  })
})

describe('buildTailwindPreset', () => {
  it('has no content key — a fixed content glob would break the consuming project\'s own scan', () => {
    const preset = buildTailwindPreset(fakeColors, fakeColorScales, fakeTypography)
    expect(preset).not.toContain('content:')
  })

  it('keeps flat semantic tokens that have no color scale (secondary, foreground, etc.)', () => {
    const preset = buildTailwindPreset(fakeColors, fakeColorScales, fakeTypography)
    expect(preset).toContain("'secondary': colors['secondary']")
    expect(preset).toContain("'foreground': colors['foreground']")
  })

  it('nests scaled families (primary/accent/neutral) as DEFAULT + 50-900 shades', () => {
    const preset = buildTailwindPreset(fakeColors, fakeColorScales, fakeTypography)
    expect(preset).toContain("'primary': {")
    expect(preset).toContain("DEFAULT: colors['primary']")
    expect(preset).toContain("'50': colorScales['primary'].shades['50']")
    expect(preset).toContain("'900': colorScales['primary'].shades['900']")
    expect(preset).toContain("'accent': {")
    expect(preset).toContain("'neutral': {")
  })

  it('does not duplicate a scaled key as a flat entry', () => {
    const preset = buildTailwindPreset(fakeColors, fakeColorScales, fakeTypography)
    expect(preset).not.toContain("'primary': colors['primary'],")
  })

  it('falls back to Inter when typography has no fontFamily', () => {
    const preset = buildTailwindPreset(fakeColors, null, {})
    expect(preset).toContain("['Inter', 'sans-serif']")
  })
})

describe('buildPackageJson', () => {
  it('sets main and exports so the repo resolves as an importable package', () => {
    const pkg = JSON.parse(buildPackageJson('mi-brand-design-system'))

    expect(pkg.main).toBe('src/index.js')
    expect(pkg.exports['.']).toBe('./src/index.js')
    expect(pkg.exports['./tailwind-preset']).toBe('./tailwind-preset.js')
  })
})

describe('buildIndexEntry', () => {
  it('re-exports all 5 components as named exports', () => {
    const entry = buildIndexEntry()

    for (const name of ['Button', 'Input', 'Textarea', 'Alert', 'Badge']) {
      expect(entry).toContain(`export { ${name} } from './components/${name}'`)
    }
  })
})

describe('buildReadme', () => {
  it('documents local Storybook, git install, tailwind preset extension, and per-component imports', () => {
    const readme = buildReadme('mi-brand-design-system')

    expect(readme).toContain('npm install')
    expect(readme).toContain('npm run storybook')
    expect(readme).toContain('npm install github:<owner>/mi-brand-design-system')
    expect(readme).toContain("presets: [require('mi-brand-design-system/tailwind-preset')]")
    expect(readme).toContain("import { Button, Input, Textarea, Alert, Badge } from 'mi-brand-design-system'")
    expect(readme.toLowerCase()).toContain('sin compilar')
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

describe.each([
  ['buildInputStories', buildInputStories, 'Input', ['Default', 'WithValue', 'Disabled', 'Error']],
  ['buildAlertStories', buildAlertStories, 'Alert', ['Success', 'Warning', 'Error']],
  ['buildTextareaStories', buildTextareaStories, 'Textarea', ['Default', 'WithValue', 'Disabled', 'Error']],
  ['buildBadgeStories', buildBadgeStories, 'Badge', ['Default', 'Primary', 'Success', 'Warning', 'Error']],
] as const)('%s', (_label, builder, componentName, expectedStories) => {
  it('is plain JS + JSX — no TypeScript syntax, no disallowed imports', () => {
    const story = builder()
    expect(detectTypeScriptSyntax(story)).toEqual([])
    expect(detectDisallowedImports(story)).toEqual([])
  })

  it(`imports ${componentName} from its sibling component file`, () => {
    expect(builder()).toContain(`from './${componentName}'`)
  })

  it('registers a CSF default export with a title and component reference', () => {
    const story = builder()
    expect(story).toContain(`title: 'Components/${componentName}'`)
    expect(story).toContain(`component: ${componentName}`)
  })

  it('exports the expected named stories', () => {
    const story = builder()
    for (const name of expectedStories) {
      expect(story).toContain(`export const ${name}`)
    }
  })
})
