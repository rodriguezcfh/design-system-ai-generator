import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const SYSTEM_INSTRUCTION = `Sos un consultor de branding que ayuda a los usuarios a definir su design system.
Tu objetivo es extraer la personalidad de la marca mediante conversación natural en español.
Necesitás entender: tono/estilo, dirección de color, preferencias tipográficas, valores de la marca, industria/sector.

Respondé siempre con JSON válido en este formato exacto (sin markdown, sin texto adicional):
{
  "assistantMessage": "Tu respuesta conversacional en español",
  "brief": {
    "tone": "string descriptivo del tono o null si aún no se determinó",
    "values": ["valor de marca 1", "valor de marca 2"],
    "references": ["referencia o inspiración mencionada"],
    "isComplete": false
  }
}

Marcá isComplete en true solo cuando tengas suficiente información (tono + dirección de color + al menos un valor).
Si necesitás más info, hacé UNA sola pregunta de seguimiento enfocada en assistantMessage.`

export type BriefExtraction = {
  assistantMessage: string
  brief: {
    tone: string | null
    values: string[]
    references: string[]
    isComplete: boolean
  }
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function extractBrief(messages: ChatMessage[]): Promise<BriefExtraction> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1]
  const chat = model.startChat({ history })
  const result = await chat.sendMessage(lastMessage.content)

  return JSON.parse(result.response.text()) as BriefExtraction
}

// ─── Design System Generation ───────────────────────────────────────────────

const GENERATION_INSTRUCTION = `You are a design system generator. Given a brand brief, produce a complete set of
design tokens and a React + Tailwind CSS Button component.

Respond ONLY with valid JSON (no markdown, no extra text) in this exact shape:
{
  "colors": {
    "primary": "#hex",
    "primaryForeground": "#hex",
    "secondary": "#hex",
    "secondaryForeground": "#hex",
    "background": "#hex",
    "foreground": "#hex",
    "muted": "#hex",
    "mutedForeground": "#hex",
    "error": "#hex",
    "errorForeground": "#hex"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontFamilyDisplay": "Inter, sans-serif",
    "sizes": { "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem" },
    "weights": { "normal": "400", "medium": "500", "semibold": "600", "bold": "700" },
    "lineHeights": { "tight": "1.25", "normal": "1.5", "relaxed": "1.75" }
  },
  "buttonComponent": "// full React + Tailwind Button component code as a single escaped string"
}

CRITICAL for colors: ensure ALL text/foreground colors meet WCAG 2.1 AA contrast ratio (≥4.5:1) against
their paired background. Use the Tailwind token class names (bg-primary, text-primary-foreground, etc.)
in the buttonComponent — never hardcoded hex values.

The buttonComponent must export a Button with variants (primary, secondary, ghost),
sizes (sm, md, lg), and states (default, hover, active, disabled, focus-visible).`

export type GeneratedDesignSystem = {
  colors: Record<string, string>
  typography: Record<string, unknown>
  buttonComponent: string
}

type BriefInput = {
  tone: string | null
  values: string[]
  references: string[]
}

export type PRDescription = { title: string; body: string }

export async function generatePRDescription(params: {
  changedTokenKeys: string[]
  hasComponentChanges: boolean
  dsName: string
}): Promise<PRDescription> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const prompt = `Write a clear, technical Pull Request title and description for a design system update.

Design system: ${params.dsName}
Changed tokens: ${params.changedTokenKeys.join(', ')}
Component changes: ${params.hasComponentChanges ? 'Yes — Button component updated' : 'No'}

Respond with JSON: { "title": "string (max 72 chars, present tense)", "body": "markdown string with what changed and why" }`

  const result = await model.generateContent(prompt)
  return JSON.parse(result.response.text()) as PRDescription
}

export async function generateDesignSystem(brief: BriefInput): Promise<GeneratedDesignSystem> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: GENERATION_INSTRUCTION,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const prompt = `Brand brief:
- Tone: ${brief.tone ?? 'not specified'}
- Values: ${brief.values.length ? brief.values.join(', ') : 'not specified'}
- References / inspirations: ${brief.references.length ? brief.references.join(', ') : 'none'}

Generate the design system tokens and Button component.`

  const result = await model.generateContent(prompt)
  return JSON.parse(result.response.text()) as GeneratedDesignSystem
}
