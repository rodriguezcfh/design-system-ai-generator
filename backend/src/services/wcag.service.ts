export type WcagCheck = {
  label: string
  foreground: string
  background: string
  ratio: number
  passes: boolean
}

export type WcagReport = {
  allPass: boolean
  checks: WcagCheck[]
}

// [foreground token key, background token key, label]
const COLOR_PAIRS: [string, string, string][] = [
  ['primaryForeground', 'primary', 'Primary button text'],
  ['secondaryForeground', 'secondary', 'Secondary button text'],
  ['foreground', 'background', 'Body text'],
  ['mutedForeground', 'background', 'Muted text'],
  ['errorForeground', 'error', 'Error state text'],
]

function linearize(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(hex: string): number {
  const r = linearize(parseInt(hex.slice(1, 3), 16))
  const g = linearize(parseInt(hex.slice(3, 5), 16))
  const b = linearize(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
}

export function isWcagAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 4.5
}

export function validatePalette(colors: Record<string, string>): WcagReport {
  const checks: WcagCheck[] = COLOR_PAIRS.flatMap(([fgKey, bgKey, label]) => {
    const fg = colors[fgKey]
    const bg = colors[bgKey]
    if (!fg || !bg) return []
    const ratio = contrastRatio(fg, bg)
    return [{ label, foreground: fg, background: bg, ratio, passes: ratio >= 4.5 }]
  })

  return { allPass: checks.length > 0 && checks.every((c) => c.passes), checks }
}
