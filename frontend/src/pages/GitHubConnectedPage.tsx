import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function GitHubConnectedPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-surface-raised flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-md p-8 max-w-sm w-full text-center space-y-4 animate-fade-up">
        <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>
        <div>
          <h1 className="font-display font-semibold text-ink text-lg">GitHub conectado</h1>
          <p className="text-sm font-sans text-ink-muted mt-1">
            Tu cuenta de GitHub quedó vinculada. Ya podés exportar tus design systems.
          </p>
        </div>
        <p className="text-xs font-sans text-ink-faint">Redirigiendo al dashboard…</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary text-sm w-full"
        >
          Ir al dashboard
        </button>
      </div>
    </div>
  )
}
