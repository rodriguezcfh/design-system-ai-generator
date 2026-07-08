import { describe, it, expect } from 'vitest'
import { buildPostcssConfig, buildVercelConfig } from '../lib/scaffold'

describe('buildPostcssConfig', () => {
  it('wires up the tailwindcss and autoprefixer plugins so Tailwind directives get processed', () => {
    const config = buildPostcssConfig()

    expect(config).toContain('tailwindcss')
    expect(config).toContain('autoprefixer')
    expect(config).toContain('module.exports')
  })
})

describe('buildVercelConfig', () => {
  it('sets the Storybook build command and static output directory so any Vercel import works without manual config', () => {
    const config = JSON.parse(buildVercelConfig())

    expect(config.buildCommand).toBe('npm run build-storybook')
    expect(config.outputDirectory).toBe('storybook-static')
  })
})
