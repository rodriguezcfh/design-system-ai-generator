import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { api, type DesignSystem } from '../api/client'

const STATUS_CONFIG = {
  DRAFT: { label: 'Borrador', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  GENERATED: { label: 'Generado', className: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  APPROVED: { label: 'Aprobado', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  EXPORTED: { label: 'Exportado', className: 'bg-green-50 text-green-700 border-green-200' },
}

function DSCard({ ds }: { ds: DesignSystem }) {
  const navigate = useNavigate()
  const config = STATUS_CONFIG[ds.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT
  const date = new Date(ds.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <button
      onClick={() => navigate(`/ds/${ds.id}`)}
      className="group text-left bg-white border border-zinc-200 rounded-2xl p-5 hover:border-accent
                 hover:shadow-md transition-all duration-200 animate-fade-up"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface-raised border border-zinc-200 flex items-center justify-center
                        group-hover:bg-accent-light group-hover:border-accent transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="4.5"/><circle cx="6.5" cy="15.5" r="4.5"/>
            <circle cx="17.5" cy="16.5" r="3.5"/>
          </svg>
        </div>
        <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${config.className}`}>
          {config.label}
        </span>
      </div>
      <h3 className="font-display font-semibold text-ink text-sm mb-1 truncate">{ds.name}</h3>
      <p className="text-[11px] font-sans text-ink-muted">{date}</p>
    </button>
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

export default function DashboardPage() {
  const [systems, setSystems] = useState<DesignSystem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.designSystems.list()
      .then(setSystems)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  async function handleCreate(name: string) {
    const ds = await api.designSystems.create(name)
    navigate(`/ds/${ds.id}`)
  }

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
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : systems.length === 0 ? (
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
            {systems.map(ds => <DSCard key={ds.id} ds={ds} />)}
          </div>
        )}
      </div>

      {showModal && (
        <NewDSModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </Layout>
  )
}
