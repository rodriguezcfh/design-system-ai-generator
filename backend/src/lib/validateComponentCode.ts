import { InvalidComponentCodeError } from './errors'

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
