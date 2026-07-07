import { describe, it, expect } from 'vitest'
import { buildPostcssConfig } from '../lib/scaffold'

describe('buildPostcssConfig', () => {
  it('wires up the tailwindcss and autoprefixer plugins so Tailwind directives get processed', () => {
    const config = buildPostcssConfig()

    expect(config).toContain('tailwindcss')
    expect(config).toContain('autoprefixer')
    expect(config).toContain('module.exports')
  })
})
