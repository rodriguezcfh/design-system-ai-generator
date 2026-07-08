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

// W3C Design Tokens Community Group format ($type/$value) — the current standard Figma
// natively imports into Variables. Only colors and typography are included on purpose:
// component code (the generated Button) doesn't map to a Figma-importable token.
export function buildFigmaTokensJson(
  colors: Record<string, string>,
  typography: TypographyInput,
  typographyScale: TypographyStyle[] | null | undefined,
): string {
  const colorTokens = Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [
      toKebabCase(key),
      { $type: 'color', $value: value },
    ]),
  )

  const typographyTokens = Object.fromEntries(
    (typographyScale ?? []).map((style) => [
      style.name.toLowerCase().replace(/\s+/g, '-'),
      {
        $type: 'typography',
        $value: {
          fontFamily: resolveFontFamily(style, typography),
          fontWeight: style.weightValue,
          fontSize: `${style.sizePx}px`,
          lineHeight: typography.lineHeights?.normal ?? '1.5',
        },
      },
    ]),
  )

  return JSON.stringify(
    {
      color: colorTokens,
      ...(Object.keys(typographyTokens).length ? { typography: typographyTokens } : {}),
    },
    null,
    2,
  )
}
