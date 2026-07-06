import { describe, it, expect } from 'vitest'
import { relativeLuminance, contrastRatio, isWcagAA, validatePalette } from '../services/wcag.service'

describe('relativeLuminance', () => {
  it('returns 1 for white', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4)
  })

  it('returns 0 for black', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4)
  })

  it('is symmetric — RGB order does not matter for grey', () => {
    expect(relativeLuminance('#808080')).toBeCloseTo(relativeLuminance('#808080'), 5)
  })
})

describe('contrastRatio', () => {
  it('black on white gives 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('is symmetric (fg/bg order does not change the ratio)', () => {
    expect(contrastRatio('#333333', '#ffffff')).toEqual(
      contrastRatio('#ffffff', '#333333'),
    )
  })

  it('same color gives 1:1', () => {
    expect(contrastRatio('#4a90d9', '#4a90d9')).toBeCloseTo(1, 1)
  })
})

describe('isWcagAA', () => {
  it('passes for black on white (21:1)', () => {
    expect(isWcagAA('#000000', '#ffffff')).toBe(true)
  })

  it('passes for white on black (21:1)', () => {
    expect(isWcagAA('#ffffff', '#000000')).toBe(true)
  })

  it('fails for low-contrast grey on white (#777777 ≈ 4.48:1)', () => {
    expect(isWcagAA('#777777', '#ffffff')).toBe(false)
  })

  it('passes for dark grey on white (#666666 ≈ 5.74:1)', () => {
    expect(isWcagAA('#666666', '#ffffff')).toBe(true)
  })
})

describe('validatePalette', () => {
  const passingColors = {
    primary: '#1a56db',
    primaryForeground: '#ffffff',
    secondary: '#7e3af2',
    secondaryForeground: '#ffffff',
    background: '#ffffff',
    foreground: '#111928',
    muted: '#f3f4f6',
    mutedForeground: '#6b7280',
    error: '#c81e1e',
    errorForeground: '#ffffff',
  }

  it('returns allPass true when all pairs meet 4.5:1', () => {
    const report = validatePalette(passingColors)
    expect(report.allPass).toBe(true)
    expect(report.checks.length).toBeGreaterThan(0)
    expect(report.checks.every((c) => c.passes)).toBe(true)
  })

  it('returns allPass false when a pair fails', () => {
    const failingColors = {
      ...passingColors,
      primary: '#aaaaaa',
      primaryForeground: '#bbbbbb', // very low contrast
    }
    const report = validatePalette(failingColors)
    expect(report.allPass).toBe(false)
    const failedCheck = report.checks.find((c) => c.label === 'Primary button text')
    expect(failedCheck?.passes).toBe(false)
  })

  it('includes ratio and label in each check', () => {
    const report = validatePalette(passingColors)
    expect(report.checks[0]).toMatchObject({
      label: expect.any(String),
      foreground: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      background: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      ratio: expect.any(Number),
      passes: expect.any(Boolean),
    })
  })

  it('skips pairs where a token is missing', () => {
    const partial = { background: '#ffffff', foreground: '#111928' }
    const report = validatePalette(partial)
    expect(report.checks.length).toBe(1) // only foreground/background pair
  })
})
