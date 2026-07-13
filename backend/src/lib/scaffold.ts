export function buildColorsJson(colors: Record<string, string>): string {
  return JSON.stringify(colors, null, 2)
}

export function buildTypographyJson(typography: Record<string, unknown>): string {
  return JSON.stringify(typography, null, 2)
}

export function buildColorScalesJson(colorScales: Record<string, unknown> | null): string {
  return JSON.stringify(colorScales ?? {}, null, 2)
}

export function buildTypographyScaleJson(typographyScale: unknown[] | null): string {
  return JSON.stringify(typographyScale ?? [], null, 2)
}

export function buildTailwindConfig(colors: Record<string, string>): string {
  const colorEntries = Object.entries(colors)
    .map(([key]) => {
      const tailwindKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `        '${tailwindKey}': colors['${key}'],`
    })
    .join('\n')

  return `const colors = require('./src/tokens/colors.json')
const typography = require('./src/tokens/typography.json')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './.storybook/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
${colorEntries}
      },
      fontFamily: {
        sans: typography.fontFamily
          ? typography.fontFamily.split(',').map(f => f.trim())
          : ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
`
}

export function buildPostcssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
}

export function buildVercelConfig(): string {
  return JSON.stringify(
    {
      buildCommand: 'npm run build-storybook',
      outputDirectory: 'storybook-static',
    },
    null,
    2,
  ) + '\n'
}

export function buildPackageJson(repoName: string): string {
  return JSON.stringify(
    {
      name: repoName,
      private: true,
      version: '0.0.1',
      scripts: {
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build',
      },
      dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0' },
      devDependencies: {
        '@storybook/addon-essentials': '^8.0.0',
        '@storybook/react-vite': '^8.0.0',
        autoprefixer: '^10.4.0',
        postcss: '^8.4.0',
        storybook: '^8.0.0',
        tailwindcss: '^3.4.0',
        vite: '^5.0.0',
      },
    },
    null,
    2,
  )
}

export function buildStorybookMain(): string {
  return `/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
}
export default config
`
}

export function buildStorybookPreview(): string {
  return `import '../src/index.css'

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
}
export default preview
`
}

export function buildIndexCss(): string {
  return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
}

export function buildButtonStories(): string {
  return `import { Button } from './Button'

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
}

export const Primary = { args: { children: 'Click me', variant: 'primary', size: 'md' } }
export const Secondary = { args: { children: 'Click me', variant: 'secondary', size: 'md' } }
export const Ghost = { args: { children: 'Click me', variant: 'ghost', size: 'md' } }
export const Small = { args: { children: 'Click me', variant: 'primary', size: 'sm' } }
export const Large = { args: { children: 'Click me', variant: 'primary', size: 'lg' } }
export const Disabled = { args: { children: 'Click me', disabled: true } }
`
}

// Static template — reads the token JSON files at build time so it never goes stale relative
// to whatever design system exported it. Mirrors the section structure of
// frontend/src/components/PreviewPanel.tsx (semantic / neutral / surface / scales / typography
// table), simplified for a plain Storybook page instead of the app's interactive preview.
export function buildFoundationsStory(): string {
  return `import colors from '../tokens/colors.json'
import typography from '../tokens/typography.json'
import colorScales from '../tokens/colorScales.json'
import typographyScale from '../tokens/typographyScale.json'

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']

const SEMANTIC_SPECS = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Accent / Secondary' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error / Destructive' },
]

const NEUTRAL_SPECS = [
  { key: 'foreground', label: 'Foreground' },
  { key: 'secondaryForeground', label: 'Secondary text / FG' },
  { key: 'mutedForeground', label: 'Muted FG' },
  { key: 'border', label: 'Border' },
  { key: 'muted', label: 'Muted Background' },
]

const SURFACE_SPECS = [
  { key: 'background', label: 'Background' },
  { key: 'card', label: 'Card' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'sidebarActive', label: 'Sidebar Active' },
]

function ColorCard({ label, hex }) {
  return (
    <div>
      <div className="h-16 rounded-xl border border-black/10" style={{ backgroundColor: hex }} />
      <p className="mt-2 text-xs font-semibold">{label}</p>
      <p className="text-[11px] font-mono text-gray-500">{hex}</p>
    </div>
  )
}

function ColorCardGrid({ specs }) {
  const present = specs.filter(function (s) { return colors[s.key] })
  if (!present.length) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {present.map(function (s) {
        return <ColorCard key={s.key} label={s.label} hex={colors[s.key]} />
      })}
    </div>
  )
}

function SectionLabel({ children }) {
  return <h4 className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">{children}</h4>
}

function ScaleRow({ family, roleLabel }) {
  if (!family || !family.shades) return null
  return (
    <div className="mb-4">
      <p className="text-xs font-medium mb-2">{family.familyName + ' (' + roleLabel + ')'}</p>
      <div className="flex gap-1.5">
        {SHADES.map(function (shade) {
          return (
            <div key={shade} className="flex-1 text-center">
              <div className="h-10 rounded-md border border-black/10" style={{ backgroundColor: family.shades[shade] }} />
              <span className="block mt-1 text-[10px] font-mono text-gray-500">{shade}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function resolveFontFamily(style) {
  if (style.role === 'body') return typography.fontFamily || 'Inter, sans-serif'
  return typography.fontFamilyDisplay || typography.fontFamily || 'Inter, sans-serif'
}

function TypographyTable() {
  const styles = typographyScale.slice().sort(function (a, b) { return b.sizePx - a.sizePx })
  if (!styles.length) return null
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-mono uppercase tracking-wider text-gray-500">
        <span>Estilo</span>
        <span>Vista previa</span>
        <span>Tamaño</span>
        <span>Peso</span>
      </div>
      {styles.map(function (style) {
        return (
          <div key={style.name} className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-100 items-center">
            <div>
              <p className="text-xs font-semibold">{style.name}</p>
              <p className="text-[10px] text-gray-500">{style.description}</p>
            </div>
            <p style={{ fontFamily: resolveFontFamily(style), fontSize: Math.min(style.sizePx, 28), fontWeight: style.weightValue }}>
              Aa Bb Cc
            </p>
            <span className="text-[11px] font-mono text-gray-500">{style.sizePx + 'px / ' + style.sizeRem + 'rem'}</span>
            <span className="text-[11px] font-mono text-gray-500">{style.weightValue + ' ' + style.weightName}</span>
          </div>
        )
      })}
    </div>
  )
}

function FoundationsPage() {
  const totalTokens = Object.keys(colors).length
  const hasScales = colorScales && (colorScales.primary || colorScales.accent || colorScales.neutral)

  return (
    <div className="p-6 space-y-8 font-sans max-w-4xl">
      <div>
        <p className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.primary }}>
          Foundation
        </p>
        <h1 className="text-2xl font-bold">Colors &amp; Typography</h1>
        <p className="text-sm text-gray-500 mt-1">Los tokens base que definen la identidad visual del design system.</p>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">Paleta de Colores</h2>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {totalTokens + ' tokens'}
          </span>
        </div>

        <div>
          <SectionLabel>Colores semánticos</SectionLabel>
          <ColorCardGrid specs={SEMANTIC_SPECS} />
        </div>

        <div>
          <SectionLabel>Neutros</SectionLabel>
          <ColorCardGrid specs={NEUTRAL_SPECS} />
        </div>

        <div>
          <SectionLabel>Superficies</SectionLabel>
          <ColorCardGrid specs={SURFACE_SPECS} />
        </div>

        {hasScales && (
          <div>
            <SectionLabel>Escalas de color</SectionLabel>
            <ScaleRow family={colorScales.primary} roleLabel="Primary" />
            <ScaleRow family={colorScales.accent} roleLabel="Accent" />
            <ScaleRow family={colorScales.neutral} roleLabel="Neutral" />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Tipografía</h2>
          <p className="text-xs text-gray-500 mt-0.5">{typography.fontFamily || 'Inter, sans-serif'}</p>
        </div>
        <div>
          <SectionLabel>Escala tipográfica</SectionLabel>
          <TypographyTable />
        </div>
      </section>
    </div>
  )
}

export default {
  title: 'Foundations/Colors & Typography',
}

export const Overview = {
  render: function () {
    return <FoundationsPage />
  },
}
`
}
