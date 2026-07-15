import { describe, it, expect } from 'vitest'
import { buildComponentBundles, buildComponentCss, normalizeComponentExport } from '../lib/buildPackage'
import { computeTailwindThemeExtend } from '../lib/scaffold'
import { UnresolvableComponentExportError } from '../lib/errors'

const sources = {
  Button: `import React from 'react'
  const Button = React.forwardRef(({ variant = 'primary', className, children, ...props }, ref) => (
    <button ref={ref} className={'bg-primary text-primary-foreground ' + (className || '')} {...props}>{children}</button>
  ))
  export { Button }`,
  Input: `import React from 'react'
  const Input = React.forwardRef((props, ref) => <input ref={ref} className="border-border" {...props} />)
  export { Input }`,
  Textarea: `import React from 'react'
  const Textarea = React.forwardRef((props, ref) => <textarea ref={ref} className="border-border" {...props} />)
  export { Textarea }`,
  Alert: `const Alert = ({ variant = 'success', title, children }) => (
    <div className="bg-success text-success-foreground"><strong>{title}</strong>{children}</div>
  )
  export { Alert }`,
  Badge: `const Badge = ({ variant = 'default', children }) => <span className="bg-accent-500">{children}</span>
  export { Badge }`,
}

describe('buildComponentBundles', () => {
  it('bundles all 5 components into a requirable CJS module', async () => {
    const { cjs } = await buildComponentBundles(sources)
    const mod = { exports: {} }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('module', 'exports', 'require', cjs)(mod, mod.exports, require)

    for (const name of ['Button', 'Input', 'Textarea', 'Alert', 'Badge']) {
      // forwardRef components (Button/Input/Textarea) are objects, not plain functions
      expect((mod.exports as Record<string, unknown>)[name]).toBeTruthy()
    }
  })

  it('keeps react/react-dom external instead of bundling them', async () => {
    const { cjs, esm } = await buildComponentBundles(sources)
    expect(cjs).toContain("require(\"react\")")
    expect(esm).toMatch(/from\s+"react"/)
  })

  it('produces a valid ESM module (uses export, not require/module.exports)', async () => {
    const { esm } = await buildComponentBundles(sources)
    expect(esm).toContain('export {')
    expect(esm).not.toContain('module.exports')
  })

  it('prefixes both bundles with a "generated, do not edit" banner', async () => {
    const { cjs, esm } = await buildComponentBundles(sources)
    expect(cjs.startsWith('/* Archivo generado automáticamente')).toBe(true)
    expect(esm.startsWith('/* Archivo generado automáticamente')).toBe(true)
  })
})

describe('buildComponentCss', () => {
  it('purges to exactly the utility classes the 5 components reference, with the right resolved colors', async () => {
    const themeExtend = computeTailwindThemeExtend(
      { primary: '#1a56db', primaryForeground: '#ffffff', border: '#e5e7eb', success: '#0e9f6e', successForeground: '#ffffff' },
      { accent: { familyName: 'Purple', shades: { '500': '#8b5cf6' } } },
      { fontFamily: 'Inter, sans-serif' },
    )
    const css = await buildComponentCss(sources, themeExtend)

    expect(css).toContain('.bg-primary')
    expect(css).toContain('26 86 219') // #1a56db as rgb
    expect(css).toContain('.text-primary-foreground')
    expect(css).toContain('.border-border')
    expect(css).toContain('.bg-success')
    expect(css).toContain('.bg-accent-500')
    expect(css).toContain('139 92 246') // #8b5cf6 as rgb
  })

  it('does not include the Tailwind base reset (would leak into the consumer\'s global styles)', async () => {
    const themeExtend = computeTailwindThemeExtend({}, null, {})
    const css = await buildComponentCss(sources, themeExtend)
    expect(css).not.toContain('*,::before,::after')
  })

  it('prefixes the output with a "generated, do not edit" banner', async () => {
    const themeExtend = computeTailwindThemeExtend({}, null, {})
    const css = await buildComponentCss(sources, themeExtend)
    expect(css.startsWith('/* Archivo generado automáticamente')).toBe(true)
  })
})

describe('normalizeComponentExport', () => {
  it('leaves an already-correct named export unchanged', () => {
    const code = `const Button = (props) => <button {...props} />\nexport { Button }`
    expect(normalizeComponentExport('Button', code)).toBe(code)
  })

  it('rewrites "export default function Name(...) {...}" into a named export', () => {
    const code = `export default function Button(props) { return <button {...props} /> }`
    const normalized = normalizeComponentExport('Button', code)

    expect(normalized).not.toContain('export default')
    expect(normalized).toContain('function Button(props)')
    expect(normalized).toContain('export { Button }')
  })

  it('rewrites a const-arrow declared earlier + "export default Name" at the end', () => {
    const code = `const Button = (props) => { return <button {...props} /> }\nexport default Button`
    const normalized = normalizeComponentExport('Button', code)

    expect(normalized).not.toMatch(/export\s+default/)
    expect(normalized).toContain('export { Button }')
  })

  it('rewrites a function declared earlier + "export default Name" at the end of the file', () => {
    const code = `function Button(props) { return <button {...props} /> }\nexport default Button`
    const normalized = normalizeComponentExport('Button', code)

    expect(normalized).not.toMatch(/export\s+default/)
    expect(normalized).toContain('export { Button }')
  })

  it('bundles successfully after normalizing all 3 export-default shapes', async () => {
    const defaultExportSources = {
      Button: `export default function Button(props) { return <button {...props}>{props.children}</button> }`,
      Input: `const Input = (props) => <input {...props} />\nexport default Input`,
      Textarea: `function Textarea(props) { return <textarea {...props} /> }\nexport default Textarea`,
      Alert: `const Alert = ({ title, children }) => <div><strong>{title}</strong>{children}</div>\nexport { Alert }`,
      Badge: `const Badge = ({ children }) => <span>{children}</span>\nexport { Badge }`,
    }

    const { cjs } = await buildComponentBundles(defaultExportSources)
    const mod = { exports: {} }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('module', 'exports', 'require', cjs)(mod, mod.exports, require)

    for (const name of ['Button', 'Input', 'Textarea', 'Alert', 'Badge']) {
      expect((mod.exports as Record<string, unknown>)[name]).toBeTruthy()
    }
  })

  it('throws UnresolvableComponentExportError (naming the component) when a component has no recognizable export at all', async () => {
    const brokenSources = {
      ...sources,
      Input: `const somethingElse = () => null`, // no export of any kind
    }

    await expect(buildComponentBundles(brokenSources)).rejects.toThrow(UnresolvableComponentExportError)
    await expect(buildComponentBundles(brokenSources)).rejects.toThrow(/^Input:/)
  })
})
