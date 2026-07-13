import { describe, it, expect } from 'vitest'
import {
  detectTypeScriptSyntax, assertNoTypeScriptSyntax,
  detectDisallowedImports, assertNoDisallowedImports,
  assertValidComponentCode,
} from '../lib/validateComponentCode'
import { InvalidComponentCodeError, DisallowedImportError } from '../lib/errors'

const validJsx = `
const cn = (...classes) => classes.filter(Boolean).join(' ')

const Button = React.forwardRef(({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
  return (
    <button ref={ref} className={cn('rounded-md', className)} {...props}>
      {children}
    </button>
  )
})

export { Button }
`

describe('detectTypeScriptSyntax', () => {
  it('returns an empty array for plain JS + JSX', () => {
    expect(detectTypeScriptSyntax(validJsx)).toEqual([])
  })

  it('flags the real-world failure: generics after forwardRef plus an interface declaration', () => {
    const code = `
interface ButtonProps {
  variant?: 'primary' | 'secondary'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return <button ref={ref} {...props} />
})
`
    const reasons = detectTypeScriptSyntax(code)
    expect(reasons.length).toBeGreaterThanOrEqual(2)
    expect(reasons.some(r => r.includes('interface'))).toBe(true)
    expect(reasons.some(r => r.includes('forwardRef'))).toBe(true)
  })

  it('flags TypeScript primitive type annotations on parameters', () => {
    const code = `function Button(label: string, disabled: boolean) { return <button>{label}</button> }`
    expect(detectTypeScriptSyntax(code).length).toBeGreaterThan(0)
  })

  it('flags "as" type assertions', () => {
    const code = `const el = document.querySelector('button') as unknown`
    expect(detectTypeScriptSyntax(code).length).toBeGreaterThan(0)
  })

  it('flags enum and type alias declarations', () => {
    expect(detectTypeScriptSyntax('enum Variant { Primary, Secondary }').length).toBeGreaterThan(0)
    expect(detectTypeScriptSyntax('type Variant = "primary" | "secondary"').length).toBeGreaterThan(0)
  })
})

describe('assertNoTypeScriptSyntax', () => {
  it('does not throw for valid JS + JSX', () => {
    expect(() => assertNoTypeScriptSyntax(validJsx)).not.toThrow()
  })

  it('throws InvalidComponentCodeError with a clear message for TS syntax', () => {
    const code = `interface Props {}`
    expect(() => assertNoTypeScriptSyntax(code)).toThrow(InvalidComponentCodeError)
    expect(() => assertNoTypeScriptSyntax(code)).toThrow(/interface/)
  })
})

describe('detectDisallowedImports', () => {
  it('returns an empty array for a component that only imports react', () => {
    expect(detectDisallowedImports(validJsx)).toEqual([])
  })

  it('flags the real-world failure: a Button importing class-variance-authority, tailwind-merge, and prop-types', () => {
    const code = `
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';
import PropTypes from 'prop-types';
`
    const found = detectDisallowedImports(code)
    expect(found).toContain('class-variance-authority')
    expect(found).toContain('tailwind-merge')
    expect(found).toContain('prop-types')
    expect(found).not.toContain('react')
  })

  it('allows relative imports (the component importing its own siblings)', () => {
    const code = `import { cn } from './utils'\nimport Icon from '../icons/Icon.jsx'`
    expect(detectDisallowedImports(code)).toEqual([])
  })

  it('flags a disallowed package pulled in via require() too', () => {
    const code = `const { cva } = require('class-variance-authority')`
    expect(detectDisallowedImports(code)).toEqual(['class-variance-authority'])
  })
})

describe('assertNoDisallowedImports', () => {
  it('does not throw when only react is imported', () => {
    expect(() => assertNoDisallowedImports(validJsx)).not.toThrow()
  })

  it('throws DisallowedImportError naming the offending package', () => {
    const code = `import { cva } from 'class-variance-authority'`
    expect(() => assertNoDisallowedImports(code)).toThrow(DisallowedImportError)
    expect(() => assertNoDisallowedImports(code)).toThrow(/class-variance-authority/)
  })
})

describe('assertValidComponentCode', () => {
  it('does not throw for valid JS + JSX importing only react', () => {
    expect(() => assertValidComponentCode('Input', validJsx)).not.toThrow()
  })

  it('prefixes the component name to a TypeScript-syntax error, so a multi-component 422 says which one failed', () => {
    const code = `interface Props {}`
    expect(() => assertValidComponentCode('Input', code)).toThrow(/^Input: /)
    expect(() => assertValidComponentCode('Input', code)).toThrow(/interface/)
  })

  it('prefixes the component name to a disallowed-import error', () => {
    const code = `import { cva } from 'class-variance-authority'`
    expect(() => assertValidComponentCode('Alert', code)).toThrow(/^Alert: /)
    expect(() => assertValidComponentCode('Alert', code)).toThrow(/class-variance-authority/)
  })
})
