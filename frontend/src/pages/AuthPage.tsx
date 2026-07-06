import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const { login, signup, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password)
      }
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-accent opacity-[0.08] blur-[80px] pointer-events-none" />

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-mono text-xl font-medium text-white tracking-tight">
            super<span className="text-accent-soft">ds</span>ai
          </span>
          <p className="text-zinc-400 text-sm font-sans mt-1.5">
            {mode === 'login' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta gratis'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex bg-zinc-800 rounded-xl p-1 mb-6">
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-1.5 text-sm font-sans font-medium rounded-lg transition-colors
                  ${mode === m
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-300'
                  }`}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-sans text-zinc-400 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="hola@empresa.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600
                           rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none
                           focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-sans text-zinc-400 mb-1.5 block">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : '••••••••'}
                required
                minLength={mode === 'signup' ? 8 : 1}
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600
                           rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none
                           focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-950 border border-red-800 rounded-xl">
                <span className="text-red-400 text-xs shrink-0">✗</span>
                <p className="text-xs font-sans text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-sans font-medium text-sm py-2.5 rounded-xl transition-colors
                         flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {mode === 'login' ? 'Iniciando…' : 'Creando cuenta…'}
                </>
              ) : (
                mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-sans text-zinc-600 mt-6">
          Design system generation powered by Gemini AI
        </p>
      </div>
    </div>
  )
}
