import { InvalidComponentCodeError, DisallowedImportError } from './errors'

const TS_SYNTAX_PATTERNS: [RegExp, string][] = [
  [/\binterface\s+\w+/, "uses 'interface' (TypeScript-only declaration)"],
  [/\benum\s+\w+\s*\{/, "uses 'enum' (TypeScript-only declaration)"],
  [/\btype\s+\w+\s*=/, "declares a 'type' alias (TypeScript-only)"],
  [/forwardRef\s*<[^>(]+>/, 'uses generics after forwardRef (e.g. forwardRef<Element, Props>)'],
  [/:\s*React\.FC\b/, "annotates with 'React.FC<...>' (TypeScript type)"],
  [/\)\s*:\s*JSX\.Element\b/, "annotates a 'JSX.Element' return type"],
  [/:\s*(string|number|boolean|void|any|unknown)\s*[,)=]/, 'uses a TypeScript primitive type annotation'],
  [/\bas\s+(const|unknown|any)\b/, "uses an 'as' type assertion"],
]

export function detectTypeScriptSyntax(code: string): string[] {
  return TS_SYNTAX_PATTERNS.filter(([pattern]) => pattern.test(code)).map(([, reason]) => reason)
}

export function assertNoTypeScriptSyntax(code: string): void {
  const reasons = detectTypeScriptSyntax(code)
  if (reasons.length > 0) throw new InvalidComponentCodeError(reasons)
}

// The exported repo's package.json only ever declares react/react-dom as dependencies
// (see buildPackageJson in scaffold.ts) — any other import resolves to nothing when Vite
// bundles the Storybook build, which fails the ENTIRE build (not just the Button story). This
// is exactly what broke a real export: Gemini generated a Button importing
// class-variance-authority, tailwind-merge, and prop-types, none of which are installed.
const ALLOWED_IMPORT_SOURCES = new Set(['react', 'react-dom'])

function isRelativeOrAllowed(source: string): boolean {
  return source.startsWith('.') || source.startsWith('/') || ALLOWED_IMPORT_SOURCES.has(source)
}

export function detectDisallowedImports(code: string): string[] {
  const found = new Set<string>()
  const importRe = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const re of [importRe, requireRe]) {
    let match: RegExpExecArray | null
    while ((match = re.exec(code))) {
      const source = match[1]
      if (!isRelativeOrAllowed(source)) found.add(source)
    }
  }

  return [...found]
}

export function assertNoDisallowedImports(code: string): void {
  const packages = detectDisallowedImports(code)
  if (packages.length > 0) throw new DisallowedImportError(packages)
}
