import type { DesignTokens, WcagReport } from '../api/client'

type Props = {
  tokens: DesignTokens | null
  wcagReport: WcagReport | null
  isGenerating: boolean
}

const TOKEN_LABELS: Record<string, string> = {
  primary: 'Primary',
  primaryForeground: 'Primary text',
  secondary: 'Secondary',
  secondaryForeground: 'Secondary text',
  background: 'Background',
  foreground: 'Foreground',
  muted: 'Muted',
  mutedForeground: 'Muted text',
  error: 'Error',
  errorForeground: 'Error text',
}

function ColorSwatch({ name, hex, wcagReport }: { name: string; hex: string; wcagReport: WcagReport | null }) {
  const label = TOKEN_LABELS[name] ?? name
  const check = wcagReport?.checks.find(c =>
    c.background === hex || c.foreground === hex,
  )

  const isDark = (() => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  })()

  return (
    <div className="group relative animate-fade-up">
      <div
        className="h-16 rounded-xl border border-black/5 transition-transform duration-200 group-hover:scale-[1.03] group-hover:shadow-md"
        style={{ backgroundColor: hex }}
      >
        {check && (
          <span className={`absolute top-2 right-2 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full
            ${check.passes
              ? 'bg-green-500/20 text-green-700'
              : 'bg-red-500/20 text-red-700'
            }`}>
            {check.passes ? 'AA ✓' : 'AA ✗'}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-0.5">
        <span className="text-xs font-sans text-ink-soft truncate">{label}</span>
        <span className="text-[10px] font-mono text-ink-muted">{hex}</span>
      </div>
    </div>
  )
}

function ButtonPreview({ colors }: { colors: Record<string, string> }) {
  const primary = colors.primary ?? '#6366f1'
  const primaryFg = colors.primaryForeground ?? '#ffffff'
  const secondary = colors.secondary ?? '#7e3af2'
  const secondaryFg = colors.secondaryForeground ?? '#ffffff'
  const bg = colors.background ?? '#ffffff'
  const fg = colors.foreground ?? '#09090b'
  const border = colors.mutedForeground ?? '#71717a'

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <button
        style={{ backgroundColor: primary, color: primaryFg }}
        className="px-4 py-2 rounded-lg text-sm font-sans font-medium transition-opacity hover:opacity-90"
      >
        Primary
      </button>
      <button
        style={{ backgroundColor: secondary, color: secondaryFg }}
        className="px-4 py-2 rounded-lg text-sm font-sans font-medium transition-opacity hover:opacity-90"
      >
        Secondary
      </button>
      <button
        style={{ backgroundColor: bg, color: fg, border: `1px solid ${border}` }}
        className="px-4 py-2 rounded-lg text-sm font-sans font-medium"
      >
        Ghost
      </button>
      <button
        style={{ backgroundColor: primary, color: primaryFg, opacity: 0.5 }}
        className="px-4 py-2 rounded-lg text-sm font-sans font-medium cursor-not-allowed"
        disabled
      >
        Disabled
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-accent-light flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="13.5" cy="6.5" r="4.5"/><circle cx="6.5" cy="15.5" r="4.5"/>
          <circle cx="17.5" cy="16.5" r="3.5"/>
        </svg>
      </div>
      <div>
        <p className="font-display font-semibold text-ink text-sm">Sin preview aún</p>
        <p className="text-xs text-ink-muted font-sans mt-1 max-w-[200px]">
          Describí tu marca en el chat y hacé clic en "Generar" para ver la paleta y los componentes.
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
      <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      <p className="text-sm text-ink-muted font-sans">Generando design system…</p>
    </div>
  )
}

export function PreviewPanel({ tokens, wcagReport, isGenerating }: Props) {
  if (isGenerating) return <Spinner />
  if (!tokens) return <EmptyState />

  const colorEntries = Object.entries(tokens.colors)
  const allPass = wcagReport?.allPass ?? false

  return (
    <div className="overflow-y-auto p-4 space-y-6 animate-fade-up">
      {/* WCAG Banner */}
      <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-sans font-medium
        ${allPass
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
        <span className="text-base">{allPass ? '✅' : '⚠️'}</span>
        {allPass
          ? 'Paleta aprobada — cumple WCAG 2.1 AA'
          : 'Algunos colores no pasan el contraste WCAG AA — ajustá antes de exportar'
        }
      </div>

      {/* Color palette */}
      <section>
        <h3 className="text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-3">
          Paleta
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {colorEntries.map(([name, hex]) => (
            <ColorSwatch key={name} name={name} hex={hex} wcagReport={wcagReport} />
          ))}
        </div>
      </section>

      {/* Typography */}
      <section>
        <h3 className="text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-3">
          Tipografía
        </h3>
        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2">
          <p className="text-xs text-ink-muted font-sans">
            {tokens.typography.fontFamily ?? 'Inter, sans-serif'}
          </p>
          <p className="text-2xl font-display text-ink" style={{ fontFamily: tokens.typography.fontFamily }}>
            Aa Bb Cc
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {Object.entries(tokens.typography.sizes ?? {}).slice(0, 5).map(([name, size]) => (
              <span key={name} className="font-sans text-ink-muted" style={{ fontSize: size }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Button preview */}
      <section>
        <h3 className="text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-3">
          Componente — Button
        </h3>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <ButtonPreview colors={tokens.colors} />
        </div>
      </section>

      {/* Component code snippet */}
      {tokens.componentCode && (
        <section>
          <h3 className="text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-3">
            Código generado
          </h3>
          <div className="bg-ink rounded-xl p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-zinc-300 whitespace-pre leading-relaxed">
              {tokens.componentCode.slice(0, 500)}{tokens.componentCode.length > 500 ? '\n…' : ''}
            </pre>
          </div>
        </section>
      )}
    </div>
  )
}
