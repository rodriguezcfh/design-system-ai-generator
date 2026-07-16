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

export function buildTailwindConfig(
  _colors: Record<string, string>,
  _colorScales: Record<string, unknown> | null,
): string {
  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './.storybook/**/*.{js,jsx}'],
  presets: [require('./tailwind-preset.js')],
  plugins: [],
}
`
}

type ColorScaleFamily = { familyName?: string; shades?: Record<string, string> }

export type TailwindThemeExtend = {
  colors: Record<string, string | Record<string, string>>
  fontFamily: Record<string, string[]>
}

// Shared by buildTailwindPreset (emits this as the shipped tailwind-preset.js) and
// buildPackage.ts (drives the in-memory Tailwind CSS build for dist/index.css) — one
// source of truth for "what does this design system's theme.extend look like".
export function computeTailwindThemeExtend(
  colors: Record<string, string>,
  colorScales: Record<string, unknown> | null,
  typography: Record<string, unknown>,
): TailwindThemeExtend {
  const scales = (colorScales ?? {}) as Record<string, ColorScaleFamily>
  const scaleKeys = Object.keys(scales).filter((key) => scales[key]?.shades)

  const themeColors: Record<string, string | Record<string, string>> = {}

  for (const [key, value] of Object.entries(colors)) {
    if (scaleKeys.includes(key)) continue
    const tailwindKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    themeColors[tailwindKey] = value
  }

  for (const key of scaleKeys) {
    const tailwindKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    const hasFlatDefault = Object.prototype.hasOwnProperty.call(colors, key)
    themeColors[tailwindKey] = {
      ...(hasFlatDefault ? { DEFAULT: colors[key] } : {}),
      ...(scales[key].shades as Record<string, string>),
    }
  }

  const fontFamilyValue = typeof typography.fontFamily === 'string' ? typography.fontFamily : null
  const fontFamily = {
    sans: fontFamilyValue ? fontFamilyValue.split(',').map((f) => f.trim()) : ['Inter', 'sans-serif'],
  }

  return { colors: themeColors, fontFamily }
}

export function buildTailwindPreset(
  colors: Record<string, string>,
  colorScales: Record<string, unknown> | null,
  typography: Record<string, unknown>,
): string {
  const themeExtend = computeTailwindThemeExtend(colors, colorScales, typography)

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: ${JSON.stringify(themeExtend, null, 2).split('\n').join('\n    ')},
  },
}
`
}

// dist/ is intentionally NOT ignored: a git-installed package (`npm install github:owner/repo`)
// never runs a build step, so the compiled bundle has to be a physical, committed file.
export function buildGitignore(): string {
  return `node_modules/
storybook-static/
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
      main: './dist/index.js',
      module: './dist/index.esm.js',
      exports: {
        '.': {
          import: './dist/index.esm.js',
          require: './dist/index.js',
          default: './dist/index.js',
        },
        './tailwind-preset': './tailwind-preset.js',
        './styles.css': './dist/index.css',
        './package.json': './package.json',
      },
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

export function buildIndexEntry(): string {
  return `export { Button } from './components/Button'
export { Input } from './components/Input'
export { Textarea } from './components/Textarea'
export { Alert } from './components/Alert'
export { Badge } from './components/Badge'
`
}

export function buildReadme(repoName: string): string {
  return `# ${repoName}

Design system generado con SuperDSAI Generator: tokens de color/tipografía + 5 componentes
(Button, Input, Textarea, Alert, Badge) documentados en Storybook.

## Storybook local

\`\`\`
npm install
npm run storybook
\`\`\`

## Instalar como dependencia

Este repo se puede instalar directamente desde GitHub en otro proyecto:

\`\`\`
npm install github:<owner>/${repoName}
\`\`\`

## Camino principal: usar los 5 componentes ya armados

Es el camino recomendado — funciona en cualquier bundler/framework (Vite, Next.js, CRA, etc.) sin
depender de que tu proyecto tenga Tailwind configurado.

\`\`\`jsx
import { Button, Input, Textarea, Alert, Badge } from '${repoName}'
import '${repoName}/styles.css'
\`\`\`

Los componentes se distribuyen **precompilados** en \`dist/\` (CommonJS + ESM, \`react\`/
\`react-dom\` quedan como peer — usan la instancia de React de tu proyecto), junto con
\`dist/index.css\`, una hoja de estilos ya purgada a exactamente las clases que estos 5 componentes
usan. Esto es necesario porque un paquete instalado vía \`npm install github:...\` nunca corre un
paso de build: los archivos compilados tienen que estar físicamente en el repo.

> **\`dist/\` se regenera automáticamente en cada exportación/actualización desde el generador —
> no lo edites a mano, cualquier cambio manual se pierde en el próximo export.** El código fuente
> sin compilar sigue disponible en \`src/components/\` para quien quiera inspeccionarlo.

## Camino avanzado (opcional): construir tus propios componentes con estos tokens

Si en vez de (o además de) usar los 5 componentes ya armados querés construir los tuyos propios
reusando la misma paleta de marca (colores semánticos + escalas 50–900 + tipografía), extendé tu
\`tailwind.config.js\` con el preset de este paquete:

\`\`\`js
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('${repoName}/tailwind-preset')],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
}
\`\`\`

Esto habilita tanto los tokens semánticos (\`bg-primary\`, \`text-error\`, etc.) como las utilities
de escala (\`bg-primary-700\`, \`bg-accent-100\`, etc.), generadas por tu propio Tailwind con
tree-shaking de lo que no uses. El preset y el \`dist/index.css\` del camino principal se derivan
de la misma fuente de tokens, así que nunca quedan desincronizados entre sí.
`
}

// EMBEDDED mode: these files become the user's own project code from the first commit (same
// idea as shadcn/ui) — no "generated, do not edit" banner here, unlike STANDALONE's dist/*.
export function buildInstallMd(targetPath: string): string {
  return `# Design system

Tokens y componentes agregados a este proyecto por SuperDSAI Generator, en \`${targetPath}/\`.
Estos archivos ya son parte de tu proyecto — podés editarlos libremente, no dependen del
generador ni se van a sobreescribir salvo que vuelvas a exportar sobre el mismo repo.

## Setup — una sola línea a mano

Agregá el preset de Tailwind a tu \`tailwind.config.js\` (no lo hacemos automáticamente: no
conocemos el formato ni el contenido actual de tu config, y una edición automática mal hecha
puede romper tu build):

\`\`\`js
module.exports = {
  presets: [require('./${targetPath}/tailwind-preset')],
  // ...el resto de tu config sin cambios
}
\`\`\`

## Uso

\`\`\`jsx
import { Button } from './${targetPath}/components/Button'
import { Input } from './${targetPath}/components/Input'
import { Textarea } from './${targetPath}/components/Textarea'
import { Alert } from './${targetPath}/components/Alert'
import { Badge } from './${targetPath}/components/Badge'
\`\`\`

Los tokens en bruto (colores, tipografía, escalas) están en \`${targetPath}/tokens/\` si los
necesitás fuera de Tailwind.
`
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

export function buildInputStories(): string {
  return `import { Input } from './Input'

export default {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    errorMessage: { control: 'text' },
  },
}

export const Default = { args: { placeholder: 'Escribí algo…' } }
export const WithValue = { args: { defaultValue: 'Texto ingresado', placeholder: 'Escribí algo…' } }
export const Disabled = { args: { placeholder: 'Escribí algo…', disabled: true } }
export const Error = { args: { placeholder: 'Escribí algo…', error: true, errorMessage: 'Este campo es obligatorio' } }
`
}

export function buildAlertStories(): string {
  return `import { Alert } from './Alert'

export default {
  title: 'Components/Alert',
  component: Alert,
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'error'] },
    title: { control: 'text' },
  },
}

export const Success = { args: { variant: 'success', title: 'Listo', children: 'La operación se completó con éxito.' } }
export const Warning = { args: { variant: 'warning', title: 'Atención', children: 'Revisá los datos antes de continuar.' } }
export const Error = { args: { variant: 'error', title: 'Error', children: 'Ocurrió un problema al procesar la solicitud.' } }
`
}

export function buildTextareaStories(): string {
  return `import { Textarea } from './Textarea'

export default {
  title: 'Components/Textarea',
  component: Textarea,
  argTypes: {
    placeholder: { control: 'text' },
    rows: { control: 'number' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    errorMessage: { control: 'text' },
  },
}

export const Default = { args: { placeholder: 'Escribí un mensaje…', rows: 4 } }
export const WithValue = { args: { defaultValue: 'Texto de varias líneas ingresado por el usuario.', rows: 4 } }
export const Disabled = { args: { placeholder: 'Escribí un mensaje…', rows: 4, disabled: true } }
export const Error = { args: { placeholder: 'Escribí un mensaje…', rows: 4, error: true, errorMessage: 'Este campo es obligatorio' } }
`
}

export function buildBadgeStories(): string {
  return `import { Badge } from './Badge'

export default {
  title: 'Components/Badge',
  component: Badge,
  argTypes: {
    variant: { control: 'select', options: ['default', 'primary', 'success', 'warning', 'error'] },
  },
}

export const Default = { args: { variant: 'default', children: 'Etiqueta' } }
export const Primary = { args: { variant: 'primary', children: 'Nuevo' } }
export const Success = { args: { variant: 'success', children: 'Activo' } }
export const Warning = { args: { variant: 'warning', children: 'Pendiente' } }
export const Error = { args: { variant: 'error', children: 'Vencido' } }
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
