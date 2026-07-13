import type { TypographyStyle } from '../services/gemini.service'

type TypographyInput = {
  fontFamily?: string
  fontFamilyDisplay?: string
  lineHeights?: Record<string, string>
}

function toKebabCase(key: string): string {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

function resolveFontFamily(style: TypographyStyle, typography: TypographyInput): string {
  if (style.role === 'body') return typography.fontFamily ?? 'Inter, sans-serif'
  return typography.fontFamilyDisplay ?? typography.fontFamily ?? 'Inter, sans-serif'
}

// Tokens Studio for Figma format: everything nested under a top-level token set name
// ("global") — the plugin only recognizes $value/$type tokens when they're inside a named
// set, a bare {color, typography} root (the plain W3C DTCG shape) reads as "no sets" and the
// plugin shows nothing. fontWeight is a named string ("Bold", "Regular") rather than a numeric
// weight, matching Tokens Studio's own typography composite convention. Only colors and
// typography are included on purpose: component code (the generated Button) doesn't map to a
// Figma-importable token.
export function buildFigmaTokensJson(
  colors: Record<string, string>,
  typography: TypographyInput,
  typographyScale: TypographyStyle[] | null | undefined,
): string {
  const colorTokens = Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [
      toKebabCase(key),
      { $value: value, $type: 'color' },
    ]),
  )

  const typographyTokens = Object.fromEntries(
    (typographyScale ?? []).map((style) => [
      style.name.toLowerCase().replace(/\s+/g, '-'),
      {
        $value: {
          fontFamily: resolveFontFamily(style, typography),
          fontWeight: style.weightName,
          fontSize: `${style.sizePx}px`,
        },
        $type: 'typography',
      },
    ]),
  )

  return JSON.stringify(
    {
      global: {
        color: colorTokens,
        ...(Object.keys(typographyTokens).length ? { typography: typographyTokens } : {}),
      },
    },
    null,
    2,
  )
}
