import * as esbuild from 'esbuild'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import type { TailwindThemeExtend } from './scaffold'
import { UnresolvableComponentExportError } from './errors'

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

function hasNamedExport(expectedName: string, code: string): boolean {
  const declPatterns = [
    new RegExp(`export\\s+function\\s+${expectedName}\\s*\\(`),
    new RegExp(`export\\s+const\\s+${expectedName}\\b`),
    new RegExp(`export\\s+class\\s+${expectedName}\\b`),
  ]
  if (declPatterns.some((re) => re.test(code))) return true

  const exportBlockRe = /export\s*\{([^}]*)\}/g
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = exportBlockRe.exec(code)) !== null) {
    const bindings = blockMatch[1].split(',').map((b) => b.trim()).filter(Boolean)
    for (const binding of bindings) {
      const asMatch = binding.match(/^\S+\s+as\s+(\S+)$/)
      const exportedName = asMatch ? asMatch[1] : binding
      if (exportedName === expectedName) return true
    }
  }
  return false
}

// Older design systems (generated before the prompt forced an exact named-export contract) may
// have a component saved with a valid-but-different export style — `export default`. esbuild's
// virtual entry re-exports every component by name (`export { Button } from 'virtual:Button'`),
// so a default-only export fails bundling with a raw "No matching export" error. This rewrites
// the common default-export shapes into an equivalent named export without touching behavior.
export function normalizeComponentExport(expectedName: string, code: string): string {
  if (hasNamedExport(expectedName, code)) return code

  // export default function Name(...) { ... }  — named or anonymous function declaration
  const fnDeclRe = /export\s+default\s+function\s*[A-Za-z_$][\w$]*\s*\(|export\s+default\s+function\s*\(/
  if (fnDeclRe.test(code)) {
    const rewritten = code.replace(fnDeclRe, `function ${expectedName}(`)
    return `${rewritten}\nexport { ${expectedName} }\n`
  }

  // export default Identifier;  — bare reference to something declared earlier in the file
  const bareIdentifierRe = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/
  const bareMatch = code.match(bareIdentifierRe)
  if (bareMatch) {
    const identifier = bareMatch[1]
    const withoutDefault = code.replace(bareIdentifierRe, '')
    const alias = identifier === expectedName ? identifier : `${identifier} as ${expectedName}`
    return `${withoutDefault}\nexport { ${alias} }\n`
  }

  // export default (props) => {...}  or any other default-exported expression
  const exprDefaultRe = /export\s+default\s+/
  if (exprDefaultRe.test(code)) {
    const rewritten = code.replace(exprDefaultRe, `const ${expectedName} = `)
    return `${rewritten}\nexport { ${expectedName} }\n`
  }

  return code
}

function normalizeAllSources(sources: ComponentSources): ComponentSources {
  const normalized = {} as ComponentSources
  for (const name of COMPONENT_NAMES) {
    const code = normalizeComponentExport(name, sources[name])
    if (!hasNamedExport(name, code)) throw new UnresolvableComponentExportError(name)
    normalized[name] = code
  }
  return normalized
}

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
  const normalizedSources = normalizeAllSources(sources)
  const shared = {
    entryPoints: ['virtual:index'],
    bundle: true,
    external: ['react', 'react-dom'],
    jsx: 'automatic' as const,
    plugins: [virtualComponentsPlugin(normalizedSources)],
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
