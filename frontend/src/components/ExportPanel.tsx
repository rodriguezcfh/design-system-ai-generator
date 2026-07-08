import { useState, type ReactNode } from 'react'
import type { Export } from '../api/client'

type Props = {
  dsId: string
  status: string
  exports: Export[]
  onExport: (repoName?: string, visibility?: 'public' | 'private') => Promise<void>
  onConnectGitHub: () => void
  isGithubConnected: boolean
  canExport: boolean
  repoFullName?: string | null
  onDownloadFigmaTokens: () => Promise<void>
}

function vercelDeployUrl(repoFullName: string): string {
  const repoUrl = `https://github.com/${repoFullName}`
  const suggestedName = repoFullName.split('/')[1] ?? 'design-system'
  const params = new URLSearchParams({
    'repository-url': repoUrl,
    'project-name': suggestedName,
    'repository-name': suggestedName,
  })
  return `https://vercel.com/new/clone?${params}`
}

function Section({ index, title, description, children }: {
  index: number; title: string; description: string; children: ReactNode
}) {
  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 animate-fade-up">
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-5 h-5 rounded-full bg-accent-light text-accent text-[11px] font-mono font-semibold
          flex items-center justify-center mt-0.5">
          {index}
        </span>
        <div>
          <p className="text-sm font-sans font-semibold text-ink">{title}</p>
          <p className="text-xs font-sans text-ink-muted leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>
      <div className="pl-[30px]">{children}</div>
    </section>
  )
}

function ExportRow({ exp }: { exp: Export }) {
  const isUpdate = exp.type === 'UPDATE'
  const statusColor = {
    OPEN: 'text-blue-600 bg-blue-50 border-blue-200',
    MERGED: 'text-green-700 bg-green-50 border-green-200',
    CLOSED: 'text-zinc-500 bg-zinc-50 border-zinc-200',
  }[exp.status] ?? 'text-zinc-500 bg-zinc-50 border-zinc-200'

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-100 last:border-0 animate-fade-up">
      <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0
        ${isUpdate ? 'bg-violet-50' : 'bg-green-50'}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isUpdate ? '#7c3aed' : '#16a34a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isUpdate
            ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
            : <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></>
          }
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-sans font-medium text-ink truncate">
            {isUpdate ? 'PR de actualización' : 'Repositorio inicial'}
          </span>
          <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full border ${statusColor}`}>
            {exp.status}
          </span>
        </div>
        {exp.prUrl && (
          <a
            href={exp.prUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-mono text-accent hover:underline mt-0.5 block truncate"
          >
            {exp.prUrl.replace('https://github.com/', '')}
          </a>
        )}
        {exp.repoUrl && !exp.prUrl && (
          <a
            href={exp.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-mono text-accent hover:underline mt-0.5 block truncate"
          >
            {exp.repoUrl.replace('https://github.com/', '')}
          </a>
        )}
        <p className="text-[10px] text-ink-faint font-sans mt-0.5">
          {new Date(exp.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

export function ExportPanel({
  dsId, status, exports, onExport, onConnectGitHub, isGithubConnected, canExport,
  repoFullName, onDownloadFigmaTokens,
}: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRepoModal, setShowRepoModal] = useState(false)
  const [repoName, setRepoName] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [isDownloadingTokens, setIsDownloadingTokens] = useState(false)

  const hasExports = exports.length > 0
  const isInitialExport = !hasExports
  const notGenerated = status === 'DRAFT'

  async function handleExport() {
    setError(null)
    if (isInitialExport && !showRepoModal) {
      setShowRepoModal(true)
      return
    }
    setIsExporting(true)
    setShowRepoModal(false)
    try {
      await onExport(repoName || undefined, visibility)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al exportar'
      if (message.includes('GitHub')) {
        onConnectGitHub()
      } else {
        setError(message)
      }
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownloadTokens() {
    setIsDownloadingTokens(true)
    try {
      await onDownloadFigmaTokens()
    } finally {
      setIsDownloadingTokens(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <Section
        index={1}
        title="Exportar a GitHub"
        description="Guarda el código y el proyecto de Storybook en tu repositorio, listo para correr con npm install && npm run storybook."
      >
        {!isGithubConnected ? (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2.5">
            <p className="text-xs font-sans text-ink-muted leading-relaxed">
              Conectá tu cuenta de GitHub para poder exportar.
            </p>
            <button onClick={onConnectGitHub} className="btn-primary text-sm w-full">
              Conectar con GitHub
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {notGenerated && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-600 text-sm">⚠️</span>
                <p className="text-xs font-sans text-amber-700">
                  Generá el design system antes de exportar.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-red-500 text-sm">✗</span>
                <p className="text-xs font-sans text-red-700">{error}</p>
              </div>
            )}

            {showRepoModal && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-3">
                <p className="text-sm font-sans font-medium text-ink">Configurar repositorio</p>
                <div>
                  <label className="text-xs font-sans text-ink-muted mb-1 block">Nombre del repo (opcional)</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={e => setRepoName(e.target.value)}
                    placeholder="mi-design-system"
                    className="input-field text-sm w-full"
                  />
                </div>
                <div className="flex gap-2">
                  {(['private', 'public'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className={`flex-1 text-xs font-sans py-1.5 rounded-lg border transition-colors
                        ${visibility === v
                          ? 'border-accent bg-accent-light text-accent font-medium'
                          : 'border-zinc-200 text-ink-muted hover:border-zinc-300'
                        }`}
                    >
                      {v === 'private' ? '🔒 Privado' : '🌐 Público'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowRepoModal(false)} className="btn-ghost text-sm flex-1">Cancelar</button>
                  <button onClick={handleExport} disabled={isExporting} className="btn-primary text-sm flex-1">
                    {isExporting ? 'Exportando…' : 'Crear repositorio'}
                  </button>
                </div>
              </div>
            )}

            {!showRepoModal && (
              <button
                onClick={handleExport}
                disabled={isExporting || notGenerated}
                className="btn-primary text-sm w-full flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Exportando…
                  </>
                ) : hasExports ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Crear PR de actualización
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Exportar a GitHub
                  </>
                )}
              </button>
            )}

            {hasExports && (
              <div>
                <h4 className="text-[10px] font-mono font-medium text-ink-muted uppercase tracking-wider mb-2">
                  Historial
                </h4>
                <div className="bg-zinc-50 rounded-lg border border-zinc-200 px-3 divide-y divide-zinc-100">
                  {exports.map(exp => <ExportRow key={exp.id} exp={exp} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        index={2}
        title="Desplegar en Vercel"
        description="Opcional — publicá tu Storybook en la nube con tu propia cuenta de Vercel. Tu Storybook ya vive en el código de GitHub y podés correrlo localmente sin este paso."
      >
        {repoFullName ? (
          <a
            href={vercelDeployUrl(repoFullName)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary text-sm w-full flex items-center justify-center gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19.5h20L12 2z"/></svg>
            Desplegar en Vercel
          </a>
        ) : (
          <p className="text-xs font-sans text-ink-faint italic">
            Disponible después de exportar a GitHub (paso 1).
          </p>
        )}
      </Section>

      <Section
        index={3}
        title="Descargar Tokens para Figma"
        description="Un .json con los colores y estilos tipográficos en formato estándar de Design Tokens, para importar en Figma. No incluye componentes como el Button — solo tokens de color y tipografía."
      >
        {notGenerated ? (
          <p className="text-xs font-sans text-ink-faint italic">
            Generá el design system primero.
          </p>
        ) : (
          <button
            onClick={handleDownloadTokens}
            disabled={isDownloadingTokens}
            className="btn-ghost text-sm w-full flex items-center justify-center gap-2 border border-zinc-200"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {isDownloadingTokens ? 'Descargando…' : 'Descargar design-tokens.json'}
          </button>
        )}
      </Section>
    </div>
  )
}
