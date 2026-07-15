import * as esbuild from 'esbuild'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import type { TailwindThemeExtend } from './scaffold'

export type ComponentSources = {
  Button: string
  Input: string
  Textarea: string
  Alert: string
  Badge: string
}

const COMPONENT_NAMES = ['Button', 'Input', 'Textarea', 'Alert', 'Badge'] as const

const GENERATED_BANNER =
  '/* Archivo generado automáticamente en cada exportación — no editar a mano, se sobreescribe. */\n'

function virtualComponentsPlugin(sources: ComponentSources): esbuild.Plugin {
  const indexSource = COMPONENT_NAMES
    .map((name) => `export { ${name} } from 'virtual:${name}'`)
    .join('\n') + '\n'

  return {
    name: 'virtual-components',
    setup(build) {
      build.onResolve({ filter: /^virtual:/ }, (args) => ({ path: args.path, namespace: 'virtual' }))
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
        if (args.path === 'virtual:index') return { contents: indexSource, loader: 'jsx' }
        const name = args.path.slice('virtual:'.length) as keyof ComponentSources
        return { contents: sources[name], loader: 'jsx' }
      })
    },
  }
}

// Bundles the 5 AI-generated JSX components into real, requirable/importable JS —
// react/react-dom stay external so the consumer's own React instance is used (no
// duplicate-React "Invalid hook call" issues). Produced once at export time and
// committed as dist/*, because a git-installed package never runs a build step.
export async function buildComponentBundles(sources: ComponentSources): Promise<{ cjs: string; esm: string }> {
  const shared = {
    entryPoints: ['virtual:index'],
    bundle: true,
    external: ['react', 'react-dom'],
    jsx: 'automatic' as const,
    plugins: [virtualComponentsPlugin(sources)],
    write: false as const,
    logLevel: 'silent' as const,
  }

  const [cjs, esm] = await Promise.all([
    esbuild.build({ ...shared, format: 'cjs' }),
    esbuild.build({ ...shared, format: 'esm' }),
  ])

  return {
    cjs: GENERATED_BANNER + cjs.outputFiles[0].text,
    esm: GENERATED_BANNER + esm.outputFiles[0].text,
  }
}

// Compiles Tailwind base+components+utilities scoped to exactly the classes the 5
// components reference (Tailwind's `content: [{ raw, extension }]` scans in-memory
// strings, no files needed) — a ready-to-use stylesheet for consumers who don't want
// to wire up the tailwind-preset in their own Tailwind config.
export async function buildComponentCss(
  sources: ComponentSources,
  themeExtend: TailwindThemeExtend,
): Promise<string> {
  const content = COMPONENT_NAMES.map((name) => ({ raw: sources[name], extension: 'jsx' }))

  const result = await postcss([
    tailwindcss({
      content,
      theme: { extend: themeExtend },
      corePlugins: { preflight: false },
    }),
    autoprefixer,
  ]).process('@tailwind components;\n@tailwind utilities;\n', { from: undefined })

  return GENERATED_BANNER + result.css
}
