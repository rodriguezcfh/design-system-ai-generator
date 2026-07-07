import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const SYSTEM_INSTRUCTION = `Sos un consultor de branding que ayuda a los usuarios a definir su design system.
Tu objetivo es extraer la personalidad de la marca mediante conversación natural en español.
Necesitás entender: tono/estilo, dirección de color, preferencias tipográficas, valores de la marca, industria/sector.

Si el usuario menciona colores hexadecimales concretos (ej. "#0077B6") o nombres de tipografía
concretos (ej. "Kiona para títulos", "Montserrat para textos"), capturalos LITERALMENTE — no los
reinterpretes, no los traduzcas a otro color/fuente ni los completes con opciones que no dijo.

Respondé siempre con JSON válido en este formato exacto (sin markdown, sin texto adicional):
{
  "assistantMessage": "Tu respuesta conversacional en español",
  "brief": {
    "tone": "string descriptivo del tono o null si aún no se determinó",
    "values": ["valor de marca 1", "valor de marca 2"],
    "references": ["referencia o inspiración mencionada"],
    "preferredColors": ["#hex1", "#hex2"] o null si no mencionó colores concretos,
    "preferredHeadingFont": "nombre de fuente para títulos o null si no mencionó ninguna",
    "preferredBodyFont": "nombre de fuente para texto de cuerpo o null si no mencionó ninguna",
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
    preferredColors: string[] | null
    preferredHeadingFont: string | null
    preferredBodyFont: string | null
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
design tokens, a typographic scale, and a React + Tailwind CSS Button component.

Respond ONLY with valid JSON (no markdown, no extra text) in this exact shape:
{
  "colors": {
    "primary": "#hex",
    "primaryForeground": "#hex",
    "secondary": "#hex",
    "secondaryForeground": "#hex",
    "success": "#hex",
    "successForeground": "#hex",
    "warning": "#hex",
    "warningForeground": "#hex",
    "error": "#hex",
    "errorForeground": "#hex",
    "background": "#hex",
    "foreground": "#hex",
    "card": "#hex",
    "cardForeground": "#hex",
    "muted": "#hex",
    "mutedForeground": "#hex",
    "border": "#hex",
    "sidebar": "#hex",
    "sidebarForeground": "#hex",
    "sidebarActive": "#hex",
    "sidebarActiveForeground": "#hex"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontFamilyDisplay": "Inter, sans-serif",
    "sizes": { "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem" },
    "weights": { "normal": "400", "medium": "500", "semibold": "600", "bold": "700" },
    "lineHeights": { "tight": "1.25", "normal": "1.5", "relaxed": "1.75" }
  },
  "typographyScale": [
    { "name": "Display", "description": "short usage hint in Spanish", "sizePx": 48, "sizeRem": 3, "weightName": "ExtraBold", "weightValue": 800, "role": "display" },
    { "name": "Heading 1", "description": "...", "sizePx": 36, "sizeRem": 2.25, "weightName": "Bold", "weightValue": 700, "role": "heading" },
    { "name": "Heading 2", "description": "...", "sizePx": 30, "sizeRem": 1.875, "weightName": "Bold", "weightValue": 700, "role": "heading" },
    { "name": "Heading 3", "description": "...", "sizePx": 24, "sizeRem": 1.5, "weightName": "Semibold", "weightValue": 600, "role": "heading" },
    { "name": "Heading 4", "description": "...", "sizePx": 20, "sizeRem": 1.25, "weightName": "Semibold", "weightValue": 600, "role": "heading" },
    { "name": "Body", "description": "...", "sizePx": 16, "sizeRem": 1, "weightName": "Regular", "weightValue": 400, "role": "body" }
  ],
  "buttonComponent": "// full React + Tailwind Button component code as a single escaped string"
}

CRITICAL for colors: ensure ALL text/foreground colors meet WCAG 2.1 AA contrast ratio (≥4.5:1) against
their paired background. Use the Tailwind token class names (bg-primary, text-primary-foreground, etc.)
in the buttonComponent — never hardcoded hex values.

If the brief includes explicit preferred colors, use those EXACT hex values verbatim for
primary/secondary (do not invent alternatives) and design the rest of the palette (neutrals,
success/warning/error, surfaces) to complement them while still passing WCAG AA. If the brief
includes explicit preferred fonts for headings and/or body text, use those EXACT font names
verbatim as fontFamilyDisplay/fontFamily — do not substitute a different font.

The buttonComponent must export a Button with variants (primary, secondary, ghost),
sizes (sm, md, lg), and states (default, hover, active, disabled, focus-visible).

typographyScale must be ordered from largest to smallest and cover at least Display, Heading 1-4,
and Body.`

export type TypographyStyle = {
  name: string
  description: string
  sizePx: number
  sizeRem: number
  weightName: string
  weightValue: number
  role: 'display' | 'heading' | 'body'
}

export type GeneratedDesignSystem = {
  colors: Record<string, string>
  typography: Record<string, unknown>
  typographyScale: TypographyStyle[]
  buttonComponent: string
}

type BriefInput = {
  tone: string | null
  values: string[]
  references: string[]
  preferredColors?: string[] | null
  preferredHeadingFont?: string | null
  preferredBodyFont?: string | null
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
- Preferred colors (use verbatim if present): ${brief.preferredColors?.length ? brief.preferredColors.join(', ') : 'none specified'}
- Preferred heading font (use verbatim if present): ${brief.preferredHeadingFont ?? 'none specified'}
- Preferred body font (use verbatim if present): ${brief.preferredBodyFont ?? 'none specified'}

Generate the design system tokens, typography scale, and Button component.`

  const result = await model.generateContent(prompt)
  return JSON.parse(result.response.text()) as GeneratedDesignSystem
}
