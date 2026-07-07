export type Shade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'

export type ColorScaleFamily = {
  familyName: string
  shades: Record<Shade, string>
}

type Hsl = { h: number; s: number; l: number }

function hexToHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l: l * 100 }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break
    case g: h = ((b - r) / d + 2) * 60; break
    default: h = ((r - g) / d + 4) * 60
  }

  return { h, s: s * 100, l: l * 100 }
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360 / 360
  const ss = Math.min(100, Math.max(0, s)) / 100
  const ll = Math.min(100, Math.max(0, l)) / 100

  if (ss === 0) {
    const v = Math.round(ll * 255)
    const hex = v.toString(16).padStart(2, '0')
    return `#${hex}${hex}${hex}`
  }

  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q

  const r = Math.round(hueToRgb(p, q, hh + 1 / 3) * 255)
  const g = Math.round(hueToRgb(p, q, hh) * 255)
  const b = Math.round(hueToRgb(p, q, hh - 1 / 3) * 255)

  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']

const LIGHTNESS: Record<Shade, number> = {
  '50': 97, '100': 94, '200': 87, '300': 78, '400': 66,
  '500': 55, '600': 46, '700': 38, '800': 30, '900': 20,
}

const SATURATION_MULTIPLIER: Record<Shade, number> = {
  '50': 0.5, '100': 0.6, '200': 0.75, '300': 0.85, '400': 0.95,
  '500': 1, '600': 1, '700': 0.95, '800': 0.9, '900': 0.85,
}

export function generateShadeScale(baseHex: string): Record<Shade, string> {
  const { h, s } = hexToHsl(baseHex)

  return SHADES.reduce((acc, shade) => {
    acc[shade] = hslToHex({ h, s: s * SATURATION_MULTIPLIER[shade], l: LIGHTNESS[shade] })
    return acc
  }, {} as Record<Shade, string>)
}

const HUE_NAMES: [number, string][] = [
  [9, 'Red'], [34, 'Orange'], [45, 'Amber'], [58, 'Yellow'], [82, 'Lime'],
  [140, 'Green'], [160, 'Emerald'], [175, 'Teal'], [190, 'Cyan'], [205, 'Sky'],
  [225, 'Blue'], [245, 'Indigo'], [265, 'Violet'], [285, 'Purple'], [305, 'Fuchsia'],
  [330, 'Pink'], [349, 'Rose'], [360, 'Red'],
]

export function nameColorFamily(hex: string): string {
  const { h, s } = hexToHsl(hex)
  if (s < 8) return 'Gray'
  return HUE_NAMES.find(([max]) => h < max)?.[1] ?? 'Gray'
}

export function buildColorScaleFamily(baseHex: string): ColorScaleFamily {
  return { familyName: nameColorFamily(baseHex), shades: generateShadeScale(baseHex) }
}

export function buildNeutralScaleFamily(baseHex: string): ColorScaleFamily {
  const { h } = hexToHsl(baseHex)
  const neutralHex = hslToHex({ h, s: 8, l: 50 })
  return { familyName: 'Neutral', shades: generateShadeScale(neutralHex) }
}
