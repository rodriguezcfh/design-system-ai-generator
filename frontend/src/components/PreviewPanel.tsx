import type { ReactNode } from 'react'
import type { ColorScaleFamily, DesignTokens, Shade, TypographyStyle, WcagReport } from '../api/client'

type Props = {
  tokens: DesignTokens | null
  wcagReport: WcagReport | null
  isGenerating: boolean
}

const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']

function toCssVar(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
}

type ColorCardSpec = { key: string; label: string; fgKey?: string }

function ColorCard({ label, hex, cssVar }: { label: string; hex: string; cssVar: string }) {
  return (
    <div className="animate-fade-up">
      <div className="h-16 rounded-xl border border-black/5" style={{ backgroundColor: hex }} />
      <div className="mt-2 space-y-0.5">
        <p className="text-xs font-sans font-semibold text-ink truncate">{label}</p>
        <p className="text-[11px] font-mono text-ink-muted">{hex}</p>
        <p className="text-[10px] font-mono text-ink-faint">{cssVar}</p>
      </div>
    </div>
  )
}

function ColorCardGrid({ specs, colors }: { specs: ColorCardSpec[]; colors: Record<string, string> }) {
  const present = specs.filter((s) => colors[s.key])
  if (!present.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {present.map((s) => (
        <ColorCard key={s.key} label={s.label} hex={colors[s.key]} cssVar={toCssVar(s.key)} />
      ))}
    </div>
  )
}

function SubsectionLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-[11px] font-mono font-medium text-ink-muted uppercase tracking-wider mb-2.5">
      {children}
    </h4>
  )
}

function ScaleRow({ family, roleLabel }: { family: ColorScaleFamily; roleLabel: string }) {
  return (
    <div>
      <p className="text-xs font-sans font-medium text-ink mb-2">
        {family.familyName} <span className="text-ink-muted font-normal">({roleLabel})</span>
      </p>
      <div className="flex gap-1.5">
        {SHADES.map((shade) => (
          <div key={shade} className="flex-1 text-center">
            <div
              className="h-10 rounded-md border border-black/5"
              style={{ backgroundColor: family.shades[shade] }}
            />
            <span className="block mt-1 text-[10px] font-mono text-ink-muted">{shade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function resolveFontFamily(style: TypographyStyle, typography: DesignTokens['typography']): string {
  if (style.role === 'body') return typography.fontFamily ?? 'Inter, sans-serif'
  return typography.fontFamilyDisplay ?? typography.fontFamily ?? 'Inter, sans-serif'
}

function TypographyScaleTable({ tokens }: { tokens: DesignTokens }) {
  const styles = [...(tokens.typographyScale ?? [])].sort((a, b) => b.sizePx - a.sizePx)

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr] gap-2 px-4 py-2 bg-zinc-50 border-b border-zinc-200">
        {['Estilo', 'Vista previa', 'Tamaño', 'Peso'].map((h) => (
          <span key={h} className="text-[10px] font-mono font-medium text-ink-muted uppercase tracking-wider">
            {h}
          </span>
        ))}
      </div>
      {styles.map((style) => (
        <div
          key={style.name}
          className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr] gap-2 px-4 py-3 border-b border-zinc-100 last:border-b-0 items-center"
        >
          <div>
            <p className="text-xs font-sans font-semibold text-ink">{style.name}</p>
            <p className="text-[10px] font-sans text-ink-muted">{style.description}</p>
          </div>
          <p
            className="text-ink truncate"
            style={{
              fontFamily: resolveFontFamily(style, tokens.typography),
              fontSize: Math.min(style.sizePx, 28),
              fontWeight: style.weightValue,
            }}
          >
            Aa Bb Cc
          </p>
          <span className="text-[11px] font-mono text-ink-muted">
            {style.sizePx}px / {style.sizeRem}rem
          </span>
          <span className="text-[11px] font-mono text-ink-muted">
            {style.weightValue} {style.weightName}
          </span>
        </div>
      ))}
    </div>
  )
}

function LegacyTypographyFallback({ tokens }: { tokens: DesignTokens }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2">
      <p className="text-xs text-ink-muted font-sans">{tokens.typography.fontFamily ?? 'Inter, sans-serif'}</p>
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
  )
}

function ButtonPreview({ colors }: { colors: Record<string, string> }) {
  const primary = colors.primary ?? '#6366f1'
  const primaryFg = colors.primaryForeground ?? '#ffffff'
  const secondary = colors.secondary ?? '#7e3af2'
  const secondaryFg = colors.secondaryForeground ?? '#ffffff'
  const bg = colors.background ?? '#ffffff'
  const fg = colors.foreground ?? '#09090b'
  const border = colors.border ?? colors.mutedForeground ?? '#71717a'

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

const SEMANTIC_SPECS: ColorCardSpec[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Accent / Secondary' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error / Destructive' },
]

const NEUTRAL_SPECS: ColorCardSpec[] = [
  { key: 'foreground', label: 'Foreground' },
  { key: 'secondaryForeground', label: 'Secondary text / FG' },
  { key: 'mutedForeground', label: 'Muted FG' },
  { key: 'border', label: 'Border' },
  { key: 'muted', label: 'Muted Background' },
]

const SURFACE_SPECS: ColorCardSpec[] = [
  { key: 'background', label: 'Background' },
  { key: 'card', label: 'Card' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'sidebarActive', label: 'Sidebar Active' },
]

export function PreviewPanel({ tokens, wcagReport, isGenerating }: Props) {
  if (isGenerating) return <Spinner />
  if (!tokens) return <EmptyState />

  const allPass = wcagReport?.allPass ?? false
  const totalTokens = Object.keys(tokens.colors).length
  const scales = tokens.colorScales

  return (
    <div className="flex flex-col h-full">
      {/* WCAG Banner — fixed header, outside the scrollable area */}
      <div className="shrink-0 p-4 pb-0">
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 animate-fade-up">
      {/* Foundation header */}
      <div>
        <p className="text-[11px] font-mono font-semibold text-accent uppercase tracking-wider mb-1.5">
          Foundation
        </p>
        <h2 className="text-2xl font-display font-semibold text-ink">Colors &amp; Typography</h2>
        <p className="text-sm font-sans text-ink-muted mt-1">
          Los tokens base que definen la identidad visual del design system.
        </p>
      </div>

      {/* Color palette */}
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
            <h3 className="text-base font-display font-semibold text-ink">Paleta de Colores</h3>
            <span className="text-[10px] font-mono font-medium text-ink-muted bg-zinc-100 px-2 py-0.5 rounded-full">
              {totalTokens} tokens
            </span>
          </div>
        </div>

        <div>
          <SubsectionLabel>Colores semánticos</SubsectionLabel>
          <ColorCardGrid specs={SEMANTIC_SPECS} colors={tokens.colors} />
        </div>

        <div>
          <SubsectionLabel>Neutros</SubsectionLabel>
          <ColorCardGrid specs={NEUTRAL_SPECS} colors={tokens.colors} />
        </div>

        <div>
          <SubsectionLabel>Superficies</SubsectionLabel>
          <ColorCardGrid specs={SURFACE_SPECS} colors={tokens.colors} />
        </div>

        {scales && (
          <div>
            <SubsectionLabel>Escalas de color</SubsectionLabel>
            <div className="space-y-4">
              <ScaleRow family={scales.primary} roleLabel="Primary" />
              <ScaleRow family={scales.accent} roleLabel="Accent" />
              <ScaleRow family={scales.neutral} roleLabel="Neutral" />
            </div>
          </div>
        )}
      </section>

      {/* Typography */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-display font-semibold text-ink">Tipografía</h3>
          <p className="text-xs font-sans text-ink-muted mt-0.5">
            {tokens.typography.fontFamily ?? 'Inter, sans-serif'}
          </p>
        </div>

        {tokens.typographyScale?.length ? (
          <div>
            <SubsectionLabel>Escala tipográfica</SubsectionLabel>
            <TypographyScaleTable tokens={tokens} />
          </div>
        ) : (
          <LegacyTypographyFallback tokens={tokens} />
        )}
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
    </div>
  )
}
