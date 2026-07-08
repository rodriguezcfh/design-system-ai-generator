import { describe, it, expect } from 'vitest'
import { detectTypeScriptSyntax, assertNoTypeScriptSyntax } from '../lib/validateComponentCode'
import { InvalidComponentCodeError } from '../lib/errors'

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
