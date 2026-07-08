import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { WelcomeModal } from '../components/WelcomeModal'
import { api, consumeOnboardingFlag, type DesignSystem } from '../api/client'

const STATUS_CONFIG = {
  DRAFT: { label: 'Borrador', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  GENERATED: { label: 'Generado', className: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  APPROVED: { label: 'Aprobado', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  EXPORTED: { label: 'Exportado', className: 'bg-green-50 text-green-700 border-green-200' },
}

function DSCard({ ds, onDelete }: { ds: DesignSystem; onDelete: (id: string, name: string) => void }) {
  const navigate = useNavigate()
  const config = STATUS_CONFIG[ds.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT
  const date = new Date(ds.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/ds/${ds.id}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/ds/${ds.id}`) }}
      className="group relative text-left bg-white border border-zinc-200 rounded-2xl p-5 hover:border-accent
                 hover:shadow-md transition-all duration-200 animate-fade-up cursor-pointer"
    >
      <button
        onClick={e => { e.stopPropagation(); onDelete(ds.id, ds.name) }}
        title="Eliminar design system"
        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint
                   opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>

      <div className="mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface-raised border border-zinc-200 flex items-center justify-center
                        group-hover:bg-accent-light group-hover:border-accent transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="4.5"/><circle cx="6.5" cy="15.5" r="4.5"/>
            <circle cx="17.5" cy="16.5" r="3.5"/>
          </svg>
        </div>
      </div>
      <h3 className="font-display font-semibold text-ink text-sm mb-1 truncate pr-6">{ds.name}</h3>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-sans text-ink-muted">{date}</p>
        <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border shrink-0 ${config.className}`}>
          {config.label}
        </span>
      </div>
    </div>
  )
}

function NewDSModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsLoading(true)
    try {
      onCreate(name.trim())
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-fade-up">
        <h2 className="font-display font-semibold text-ink text-base mb-4">Nuevo design system</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-sans text-ink-muted mb-1.5 block">Nombre del proyecto</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Mi Brand System"
              autoFocus
              required
              className="input-field text-sm w-full"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-sm flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={!name.trim() || isLoading} className="btn-primary text-sm flex-1">
              {isLoading ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ name, error, onCancel, onConfirm }: {
  name: string; error: string | null; onCancel: () => void; onConfirm: () => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirm() {
    setIsDeleting(true)
    try {
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-fade-up">
        <div className="w-11 h-11 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <h2 className="font-display font-semibold text-ink text-base mb-1.5">Eliminar design system</h2>
        <p className="text-sm font-sans text-ink-muted leading-relaxed mb-5">
          ¿Seguro que querés eliminar <span className="font-medium text-ink">"{name}"</span>? Esta acción no se puede deshacer.
        </p>
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg mb-4">
            <span className="text-red-500 text-sm">✗</span>
            <p className="text-xs font-sans text-red-700">{error}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={isDeleting} className="btn-ghost text-sm flex-1">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="text-sm flex-1 rounded-lg bg-red-500 text-white font-sans font-medium hover:bg-red-600
                       disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Eliminando…
              </>
            ) : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [systems, setSystems] = useState<DesignSystem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.designSystems.list()
      .then(setSystems)
      .catch(console.error)
      .finally(() => setIsLoading(false))

    if (consumeOnboardingFlag()) setShowWelcome(true)
  }, [])

  async function handleCreate(name: string) {
    const ds = await api.designSystems.create(name)
    navigate(`/ds/${ds.id}`)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteError(null)
    const previous = systems
    setSystems(systems.filter(ds => ds.id !== id))
    try {
      await api.designSystems.delete(id)
      setDeleteTarget(null)
    } catch (err) {
      setSystems(previous)
      setDeleteError('No se pudo eliminar el design system. Intentá de nuevo.')
    }
  }

  const hasSystems = systems.length > 0

  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-ink text-xl">Design Systems</h1>
            <p className="text-sm font-sans text-ink-muted mt-0.5">
              {systems.length === 0 ? 'Aún no tenés ninguno' : `${systems.length} proyecto${systems.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {hasSystems && (
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Nuevo
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : !hasSystems ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-accent-light border border-accent/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="4.5"/><circle cx="6.5" cy="15.5" r="4.5"/>
                <circle cx="17.5" cy="16.5" r="3.5"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-ink">Empezá tu primer design system</p>
              <p className="text-sm font-sans text-ink-muted mt-1 max-w-xs">
                Describí tu marca y la IA generará paleta, tipografía y componentes en segundos.
              </p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Crear design system
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {systems.map(ds => (
              <DSCard key={ds.id} ds={ds} onDelete={(id, name) => { setDeleteTarget({ id, name }); setDeleteError(null) }} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewDSModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}

      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          name={deleteTarget.name}
          error={deleteError}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </Layout>
  )
}
