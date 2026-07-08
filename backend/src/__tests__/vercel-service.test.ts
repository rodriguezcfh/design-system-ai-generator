import { describe, it, expect } from 'vitest'
import { sanitizeProjectName } from '../services/vercel.service'

describe('sanitizeProjectName', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(sanitizeProjectName('Echos of soul 2-design-system')).toBe('echos-of-soul-2-design-system')
  })

  it('strips accents and ñ so the result is valid for Vercel project names', () => {
    expect(sanitizeProjectName('Marca Cañón Ñu-design-system')).toBe('marca-canon-nu-design-system')
  })

  it('replaces any character outside [a-z0-9._-] with a hyphen', () => {
    expect(sanitizeProjectName('my_brand!!system++')).toBe('my_brand-system')
  })

  it('truncates to 100 characters', () => {
    const long = 'a'.repeat(150)
    expect(sanitizeProjectName(long).length).toBe(100)
  })
})
