import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../api/client'

type Props = {
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (content: string) => void
  onAttach: (file: File) => void
}

function TypingBubble() {
  return (
    <div className="flex gap-2.5 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-accent text-xs font-mono font-medium">ai</span>
      </div>
      <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block animate-pulse-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} animate-fade-up`}>
      <div className={`w-7 h-7 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-xs font-mono font-medium
        ${isUser ? 'bg-ink text-white' : 'bg-accent-light text-accent'}`}>
        {isUser ? 'tú' : 'ai'}
      </div>
      <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm font-sans leading-relaxed whitespace-pre-wrap
        ${isUser
          ? 'bg-ink text-white rounded-tr-sm'
          : 'bg-white border border-zinc-200 text-ink rounded-tl-sm'
        }`}>
        {msg.content}
      </div>
    </div>
  )
}

const CHIPS = [
  'Quiero algo minimalista para una startup tech',
  'Marca cálida y cercana para una fintech joven',
  'Estilo premium y elegante para una consultora',
  'Colorido y divertido para una app educativa',
]

export function ChatPanel({ messages, isLoading, onSend, onAttach }: Props) {
  const [input, setInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function submit() {
    const value = input.trim()
    if (!value || isLoading) return
    onSend(value)
    setInput('')
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function handleFile(file: File | null) {
    if (!file) return
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) return alert('Solo PDF, PNG, JPG o WEBP.')
    onAttach(file)
  }

  return (
    <div
      className={`flex flex-col h-full relative ${dragging ? 'ring-2 ring-accent ring-inset' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        handleFile(e.dataTransfer.files[0] ?? null)
      }}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12 animate-fade-in">
            <div className="text-center space-y-1.5">
              <p className="font-display text-lg font-semibold text-ink">Describí tu marca</p>
              <p className="text-sm text-ink-muted font-sans max-w-xs">
                Contame el tono, los valores y la personalidad que querés transmitir.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => { setInput(chip); textRef.current?.focus() }}
                  className="text-xs font-sans px-3 py-1.5 rounded-full border border-zinc-200 text-ink-muted
                             hover:border-accent hover:text-accent hover:bg-accent-light transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {isLoading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-200 bg-white p-3">
        <div className="flex items-end gap-2 bg-surface-raised rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-accent transition-shadow">
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 mb-0.5 text-ink-muted hover:text-ink transition-colors"
            title="Adjuntar PDF o imagen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            ref={textRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Escribí sobre tu marca…"
            className="flex-1 resize-none bg-transparent text-sm font-sans text-ink placeholder:text-ink-faint outline-none max-h-32 py-0.5"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isLoading}
            className="shrink-0 mb-0.5 w-7 h-7 rounded-lg bg-accent flex items-center justify-center
                       hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-ink-faint font-sans text-center mt-1.5">
          Enter para enviar · Shift+Enter para nueva línea · Arrastrá un PDF o imagen
        </p>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden"
        onChange={e => handleFile(e.target.files?.[0] ?? null)} />
    </div>
  )
}
