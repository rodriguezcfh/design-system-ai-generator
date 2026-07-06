import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ChatPanel } from '../components/ChatPanel'
import { PreviewPanel } from '../components/PreviewPanel'
import { ExportPanel } from '../components/ExportPanel'
import { api, type ChatMessage, type DesignTokens, type WcagReport, type Export } from '../api/client'

const GITHUB_OAUTH_URL = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}&scope=repo`

type Tab = 'preview' | 'export'

function BriefBadge({ isComplete }: { isComplete: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border
      ${isComplete
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-amber-50 text-amber-600 border-amber-200'
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-400'}`} />
      {isComplete ? 'Brief completo' : 'Conversando…'}
    </span>
  )
}

export default function DesignSystemPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dsName, setDsName] = useState('')
  const [dsStatus, setDsStatus] = useState('DRAFT')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [tokens, setTokens] = useState<DesignTokens | null>(null)
  const [wcagReport, setWcagReport] = useState<WcagReport | null>(null)
  const [exports, setExports] = useState<Export[]>([])
  const [isBriefComplete, setIsBriefComplete] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGithubConnected, setIsGithubConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('preview')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const hasMessages = messages.length > 0
  const generatingRef = useRef(false)

  useEffect(() => {
    if (!id) return

    Promise.all([
      api.designSystems.get(id),
      api.designSystems.exports(id),
    ])
      .then(([dsData, exportsData]) => {
        setDsName(dsData.designSystem.name)
        setDsStatus(dsData.designSystem.status)
        if (dsData.conversation) {
          setMessages(dsData.conversation.messages ?? [])
          setIsBriefComplete(dsData.conversation.brief?.isComplete ?? false)
        }
        if (dsData.designSystem.tokens) {
          setTokens(dsData.designSystem.tokens.colors ? dsData.designSystem.tokens as unknown as DesignTokens : null)
          setWcagReport(dsData.designSystem.tokens.wcagReport as unknown as WcagReport ?? null)
        }
        setExports(exportsData)
        // Check if github is connected by seeing if user has any exports or trying to infer
        setIsGithubConnected(exportsData.length > 0 || dsData.designSystem.status === 'EXPORTED')
      })
      .catch(() => navigate('/'))
      .finally(() => setIsLoading(false))
  }, [id, navigate])

  async function handleSend(content: string) {
    if (!id || isChatLoading) return
    const userMsg: ChatMessage = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setIsChatLoading(true)
    try {
      const result = await api.chat.message(id, content)
      setMessages(prev => [...prev, { role: 'assistant', content: result.message }])
      if (result.brief?.isComplete) setIsBriefComplete(true)
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al procesar tu mensaje. Intentá de nuevo.' }])
    } finally {
      setIsChatLoading(false)
    }
  }

  async function handleAttach(file: File) {
    if (!id) return
    try {
      await api.chat.attachment(id, file)
      setMessages(prev => [...prev, { role: 'assistant', content: `Adjunto recibido: ${file.name}. Lo tendré en cuenta para el design system.` }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al subir el archivo.' }])
    }
  }

  async function handleGenerate() {
    if (!id || generatingRef.current) return
    generatingRef.current = true
    setIsGenerating(true)
    setActiveTab('preview')
    setError(null)
    try {
      const result = await api.designSystems.generate(id)
      setTokens(result.tokens)
      setWcagReport(result.wcagReport)
      setDsStatus('GENERATED')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar'
      setError(msg)
    } finally {
      setIsGenerating(false)
      generatingRef.current = false
    }
  }

  async function handleExport(repoName?: string, visibility?: 'public' | 'private') {
    if (!id) return
    const result = await api.designSystems.export(id, repoName, visibility)
    setDsStatus('EXPORTED')
    // Refresh exports
    const exportsData = await api.designSystems.exports(id)
    setExports(exportsData)
    setActiveTab('export')
    setIsGithubConnected(true)
    return result
  }

  function handleConnectGitHub() {
    const token = localStorage.getItem('dsai_token')
    const state = token ?? ''
    window.location.href = `${GITHUB_OAUTH_URL}&state=${encodeURIComponent(state)}`
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Sub-header */}
        <div className="bg-white border-b border-zinc-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/')} className="text-ink-muted hover:text-ink transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <h2 className="font-display font-semibold text-ink text-sm truncate">{dsName}</h2>
          <BriefBadge isComplete={isBriefComplete} />
          <div className="flex-1" />

          {error && (
            <span className="text-xs font-sans text-red-500 hidden sm:block">{error}</span>
          )}

          {hasMessages && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isChatLoading}
              className="btn-primary text-xs flex items-center gap-1.5 shrink-0"
            >
              {isGenerating ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v1m0 16v1M4.22 4.22l.7.7m12.16 12.16.7.7M3 12h1m16 0h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7"/>
                    <circle cx="12" cy="12" r="4"/>
                  </svg>
                  Generar
                </>
              )}
            </button>
          )}
        </div>

        {/* Main split layout */}
        <div className="flex-1 flex min-h-0">
          {/* Chat — 60% */}
          <div className="w-[60%] border-r border-zinc-200 flex flex-col min-h-0 bg-white">
            <ChatPanel
              messages={messages}
              isLoading={isChatLoading}
              onSend={handleSend}
              onAttach={handleAttach}
            />
          </div>

          {/* Preview + Export — 40% */}
          <div className="w-[40%] flex flex-col min-h-0 bg-surface-raised">
            {/* Tabs */}
            <div className="bg-white border-b border-zinc-200 flex shrink-0">
              {(['preview', 'export'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-sans font-medium transition-colors
                    ${activeTab === tab
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-ink-muted hover:text-ink'
                    }`}
                >
                  {tab === 'preview' ? 'Preview' : 'Exportar'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === 'preview' ? (
                <PreviewPanel tokens={tokens} wcagReport={wcagReport} isGenerating={isGenerating} />
              ) : (
                <ExportPanel
                  dsId={id!}
                  status={dsStatus}
                  exports={exports}
                  onExport={handleExport}
                  onConnectGitHub={handleConnectGitHub}
                  isGithubConnected={isGithubConnected}
                  canExport={dsStatus !== 'DRAFT'}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
