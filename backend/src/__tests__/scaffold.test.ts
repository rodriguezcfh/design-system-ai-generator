import { describe, it, expect } from 'vitest'
import {
  buildPostcssConfig, buildVercelConfig,
  buildColorScalesJson, buildTypographyScaleJson, buildFoundationsStory,
  buildInputStories, buildAlertStories, buildTextareaStories, buildBadgeStories,
  buildTailwindConfig, buildTailwindPreset, computeTailwindThemeExtend,
  buildPackageJson, buildIndexEntry, buildReadme,
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

describe('computeTailwindThemeExtend', () => {
  it('keeps flat semantic tokens that have no color scale, kebab-cased', () => {
    const theme = computeTailwindThemeExtend(fakeColors, fakeColorScales, fakeTypography)
    expect(theme.colors['secondary']).toBe('#7e3af2')
    expect(theme.colors['foreground']).toBe('#111928')
    expect(theme.colors['primary-foreground']).toBe('#ffffff')
  })

  it('nests scaled families (primary/accent/neutral) as DEFAULT + 50-900 shades', () => {
    const theme = computeTailwindThemeExtend(fakeColors, fakeColorScales, fakeTypography)
    expect(theme.colors['primary']).toMatchObject({
      DEFAULT: '#1a56db', '50': '#eff6ff', '900': '#1e3a8a',
    })
    expect(theme.colors['accent']).toMatchObject({ '500': '#8b5cf6' })
    expect(theme.colors['accent']).not.toHaveProperty('DEFAULT')
    expect(theme.colors['neutral']).toMatchObject({ '500': '#6b7280' })
  })

  it('falls back to Inter when typography has no fontFamily', () => {
    const theme = computeTailwindThemeExtend(fakeColors, null, {})
    expect(theme.fontFamily.sans).toEqual(['Inter', 'sans-serif'])
  })

  it('splits a comma-separated fontFamily into a trimmed array', () => {
    const theme = computeTailwindThemeExtend(fakeColors, null, { fontFamily: 'Poppins, sans-serif' })
    expect(theme.fontFamily.sans).toEqual(['Poppins', 'sans-serif'])
  })
})

describe('buildTailwindPreset', () => {
  it('has no content key — a fixed content glob would break the consuming project\'s own scan', () => {
    const preset = buildTailwindPreset(fakeColors, fakeColorScales, fakeTypography)
    expect(preset).not.toContain('content:')
  })

  it('embeds the computed theme.extend as literal JSON, resolvable via require()', () => {
    const preset = buildTailwindPreset(fakeColors, fakeColorScales, fakeTypography)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = new Function('module', 'exports', preset + '\nreturn module.exports')({ exports: {} }, {})
    expect(mod.theme.extend.colors.primary.DEFAULT).toBe('#1a56db')
    expect(mod.theme.extend.colors.primary['700']).toBe('#1d4ed8')
    expect(mod.theme.extend.colors.secondary).toBe('#7e3af2')
    expect(mod.theme.extend.fontFamily.sans).toEqual(['Inter', 'sans-serif'])
  })
})

describe('buildPackageJson', () => {
  it('sets main and exports so the repo resolves as an importable package', () => {
    const pkg = JSON.parse(buildPackageJson('mi-brand-design-system'))

    expect(pkg.main).toBe('./dist/index.js')
    expect(pkg.module).toBe('./dist/index.esm.js')
    expect(pkg.exports['.']).toEqual({
      import: './dist/index.esm.js',
      require: './dist/index.js',
      default: './dist/index.js',
    })
    expect(pkg.exports['./tailwind-preset']).toBe('./tailwind-preset.js')
    expect(pkg.exports['./styles.css']).toBe('./dist/index.css')
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
  })

  it('documents the precompiled dist bundle and the styles.css import, not raw uncompiled JSX', () => {
    const readme = buildReadme('mi-brand-design-system')

    expect(readme).toContain('precompilados')
    expect(readme).toContain("import 'mi-brand-design-system/styles.css'")
  })

  it('frames dist+CSS as the main path and the tailwind preset as secondary/optional', () => {
    const readme = buildReadme('mi-brand-design-system')

    const mainIdx = readme.indexOf('Camino principal')
    const advancedIdx = readme.indexOf('Camino avanzado')
    expect(mainIdx).toBeGreaterThan(-1)
    expect(advancedIdx).toBeGreaterThan(mainIdx)
  })

  it('warns that dist/ is regenerated on every export and must not be hand-edited', () => {
    const readme = buildReadme('mi-brand-design-system')
    expect(readme.toLowerCase()).toContain('no lo edites a mano')
  })
})

describe('README ↔ package.json exports stay in sync', () => {
  // Regression test for the prueba.3 incident: the README's example import paths drifted from
  // the package.json `exports` map that was actually generated (README said "./dist/index.css",
  // exports only declared "./styles.css") after a manual repo patch. Repo name intentionally
  // contains a literal "." (like the real "prueba.3") to make sure escaping is correct.
  it('every example import/require path in the README resolves to a real exports key', () => {
    const repoName = 'prueba.3'
    const pkg = JSON.parse(buildPackageJson(repoName))
    const readme = buildReadme(repoName)

    const escapedRepoName = repoName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pathPattern = new RegExp(`['"]${escapedRepoName}(/[^'"]*)?['"]`, 'g')

    const referencedKeys = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = pathPattern.exec(readme)) !== null) {
      referencedKeys.add(match[1] ? `.${match[1]}` : '.')
    }

    expect(referencedKeys.size).toBeGreaterThan(0)
    for (const key of referencedKeys) {
      expect(Object.keys(pkg.exports)).toContain(key)
    }
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
