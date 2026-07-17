import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const SYSTEM_INSTRUCTION = `Sos un consultor de branding que ayuda a los usuarios a definir su design system.
Tu objetivo es extraer la personalidad de la marca mediante conversación natural en español.
Necesitás entender: tono/estilo, dirección de color, preferencias tipográficas, valores de la marca, industria/sector.

Si el usuario menciona colores hexadecimales concretos (ej. "#0077B6") o nombres de tipografía
concretos (ej. "Kiona para títulos", "Montserrat para textos"), capturalos LITERALMENTE — no los
reinterpretes, no los traduzcas a otro color/fuente ni los completes con opciones que no dijo.

Sobre tipografía específicamente: si el usuario pide EXPLÍCITAMENTE dos tipografías distintas
(una para títulos, otra para texto), marcá preferredFontMode como "SEPARATE" y completá
preferredHeadingFont/preferredBodyFont con cada una (aunque solo haya dado una de las dos todavía,
"SEPARATE" indica que están en dos campos separados, no que ya estén completos). Si pide
EXPLÍCITAMENTE una sola tipografía para todo el sistema, marcá preferredFontMode como "SINGLE" y
guardá esa fuente en preferredHeadingFont, dejando preferredBodyFont en null. Si todavía no dijo
nada sobre tipografía, dejá preferredFontMode como "UNSET".

Respondé siempre con JSON válido en este formato exacto (sin markdown, sin texto adicional):
{
  "assistantMessage": "Tu respuesta conversacional en español",
  "brief": {
    "tone": "string descriptivo del tono o null si aún no se determinó",
    "values": ["valor de marca 1", "valor de marca 2"],
    "references": ["referencia o inspiración mencionada"],
    "preferredColors": ["#hex1", "#hex2"] o null si no mencionó colores concretos,
    "preferredFontMode": "UNSET" | "SINGLE" | "SEPARATE",
    "preferredHeadingFont": "nombre de fuente para títulos, o la única fuente si preferredFontMode es SINGLE, o null",
    "preferredBodyFont": "nombre de fuente para texto de cuerpo o null (siempre null si preferredFontMode es SINGLE)",
    "isComplete": false
  }
}

Marcá isComplete en true solo cuando tengas suficiente información (tono + dirección de color + al menos un valor).
Si necesitás más info, hacé UNA sola pregunta de seguimiento enfocada en assistantMessage.

Cuando marques isComplete en true, terminá tu assistantMessage avisándole al usuario que ya tenés
todo lo necesario y que puede hacer clic en el botón "Generar" (arriba a la derecha del chat) para
ver su design system — no sigas haciendo preguntas de seguimiento en ese mensaje.`

export type BriefExtraction = {
  assistantMessage: string
  brief: {
    tone: string | null
    values: string[]
    references: string[]
    preferredColors: string[] | null
    preferredFontMode: 'UNSET' | 'SINGLE' | 'SEPARATE'
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

// Shared between GENERATION_INSTRUCTION (full generation) and EDIT_INSTRUCTION (chat-driven
// edits to an existing design system) — both produce/patch the same 5 component code strings,
// under the same hard constraints.
const COMPONENT_CODE_CONSTRAINTS = `CRITICAL: every component's code must be plain JavaScript + JSX
— each will be saved as its own .jsx file and parsed by Storybook/Babel's JSX-only parser, which
cannot handle TypeScript syntax. This means:
- NO generics anywhere (no "forwardRef<HTMLButtonElement, ButtonProps>", no "useState<...>").
- NO "interface" or "type X = ..." declarations.
- NO type annotations on parameters, variables, or return types (no ": string", ": ButtonProps",
  "): JSX.Element", no "React.FC<...>").
- NO "as" type assertions (no "as const", "as unknown", "as SomeType").
- NO enums.
If you want to document props, use JSDoc comments — never TypeScript.

CRITICAL: no component may import ANY npm package other than "react" — no
class-variance-authority, tailwind-merge, clsx, prop-types, @radix-ui/*, or anything else. The
exported repo's package.json only declares react/react-dom as dependencies, so any other import
is unresolvable and fails the ENTIRE Storybook build, not just that one component. Implement
className merging with a small inline helper function (e.g. a local cn(...classes) that filters
and joins strings) and variant/size lookup with plain object literals — do not reach for a
runtime prop validation library either, a plain JSDoc comment is enough.

CRITICAL: every component must keep exporting exactly the same name it already has (Button,
Input, Textarea, Alert, Badge) as a named export (e.g. "export { Button }" or "export function
Button(...)") — never switch to a default export or rename the export, other code statically
imports these components by that exact name.`

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
  "buttonComponent": "// full React + Tailwind Button component code as a single escaped string",
  "additionalComponents": {
    "input": "// full React + Tailwind Input component code, see contract below",
    "alert": "// full React + Tailwind Alert component code, see contract below",
    "textarea": "// full React + Tailwind Textarea component code, see contract below",
    "chip": "// full React + Tailwind Badge component code, see contract below"
  }
}

CRITICAL for colors: ensure ALL text/foreground colors meet WCAG 2.1 AA contrast ratio (≥4.5:1) against
their paired background. Use the Tailwind token class names (bg-primary, text-primary-foreground, etc.)
in every component — never hardcoded hex values.

If the brief includes explicit preferred colors, use those EXACT hex values verbatim for
primary/secondary (do not invent alternatives) and design the rest of the palette (neutrals,
success/warning/error, surfaces) to complement them while still passing WCAG AA.

Font handling depends on preferredFontMode: "SINGLE" means the brief wants ONE font for the whole
system — use preferredHeadingFont verbatim as BOTH fontFamilyDisplay and fontFamily (identical
values, do not force a second font). "SEPARATE" means two distinct fonts — use
preferredHeadingFont verbatim as fontFamilyDisplay and preferredBodyFont verbatim as fontFamily
(if only one of the two is given, use that same one for both, since a second font hasn't been
decided yet). "UNSET" means no font preference was stated — choose fonts freely that fit the
brand tone.

The buttonComponent must export a Button with variants (primary, secondary, ghost),
sizes (sm, md, lg), and states (default, hover, active, disabled, focus-visible).

Each of the 4 additionalComponents has a FIXED prop contract you must implement exactly — a
static Storybook story (already written, not generated by you) calls these components with these
exact prop names, so any deviation breaks the story:
- input: export a component named Input accepting props { placeholder, disabled, error,
  errorMessage, defaultValue }. When error is true, the border/ring use the "error" color token
  and errorMessage renders below the field in "error" colored small text. Default state uses the
  "border" token; focus state uses a focus-visible ring in the "primary" token; disabled reduces
  opacity and disables pointer events.
- alert: export a component named Alert accepting props { variant, title, children } where
  variant is one of "success" | "warning" | "error". Background/border/text must use that
  variant's matching color tokens (e.g. variant="success" uses the "success"/"successForeground"
  tokens). title renders bold above children.
- textarea: export a component named Textarea accepting props { placeholder, rows, disabled,
  error, errorMessage, defaultValue }. Same error/default/focus/disabled behavior as Input, rows
  defaults to 4 if not provided.
- chip: export a component named Badge accepting props { variant, children } where variant is
  one of "default" | "primary" | "success" | "warning" | "error". Each variant maps to its
  matching color tokens (variant="default" uses "muted"/"mutedForeground"). Renders as a small
  rounded-full pill.

${COMPONENT_CODE_CONSTRAINTS}
(applies to all 5: buttonComponent + the 4 in additionalComponents)

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

export type AdditionalComponents = {
  input: string
  alert: string
  textarea: string
  chip: string
}

export type GeneratedDesignSystem = {
  colors: Record<string, string>
  typography: Record<string, unknown>
  typographyScale: TypographyStyle[]
  buttonComponent: string
  additionalComponents: AdditionalComponents
}

type BriefInput = {
  tone: string | null
  values: string[]
  references: string[]
  preferredColors?: string[] | null
  preferredFontMode?: 'UNSET' | 'SINGLE' | 'SEPARATE'
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
- preferredFontMode: ${brief.preferredFontMode ?? 'UNSET'}
- Preferred heading font (use verbatim if present): ${brief.preferredHeadingFont ?? 'none specified'}
- Preferred body font (use verbatim if present): ${brief.preferredBodyFont ?? 'none specified'}

Generate the design system tokens, typography scale, Button component, and the 4
additionalComponents (input, alert, textarea, chip) per their fixed contracts.`

  const result = await model.generateContent(prompt)
  return JSON.parse(result.response.text()) as GeneratedDesignSystem
}

// ─── Chat-driven edits to an already-generated design system ───────────────

export type AdditionalComponentsPatch = Partial<AdditionalComponents>

export type TokensPatch = {
  colors: Record<string, string> | null
  typography: Record<string, unknown> | null
  buttonComponent: string | null
  additionalComponents: AdditionalComponentsPatch | null
}

export type EditInterpretation = {
  assistantMessage: string
  needsConfirmation: boolean
  confirmationSummary: string | null
  confirmsPendingEdit: boolean
  patch: TokensPatch | null
}

type CurrentTokensContext = {
  colors: Record<string, string>
  typography: Record<string, unknown>
  buttonComponent: string
  additionalComponents: AdditionalComponents
}

const EDIT_INSTRUCTION = `Sos un asistente que aplica ediciones puntuales, por chat, a un design
system YA GENERADO (colores, tipografía, y 5 componentes: Button, Input, Textarea, Alert, Badge).
Te paso el estado actual de esos tokens/componentes como contexto en cada mensaje — nunca
inventes valores para lo que no se te pidió cambiar, y nunca reescribas algo que no fue mencionado.

## Regla 1 — Gestión flexible de tipografía

- Si el usuario pide EXPLÍCITAMENTE dos tipografías (una para títulos, otra para texto), devolvé
  "typography" con fontFamilyDisplay y fontFamily distintos, cada uno con el nombre exacto pedido
  (conservando el resto del objeto typography sin cambios).
- Si pide EXPLÍCITAMENTE una sola tipografía para todo el sistema, devolvé "typography" con
  fontFamilyDisplay y fontFamily IGUALES a esa fuente — no fuerces una segunda tipografía.
- Si el mensaje no menciona tipografía para nada, dejá "typography": null en el patch (no la
  toques), y en assistantMessage sugerí — una sola vez por conversación, no lo repitas si ya lo
  sugeriste antes en este historial — que se puede configurar una tipografía para títulos y otra
  distinta para el texto. Ejemplo de tono: "Mantuve la tipografía actual, pero si querés podemos
  configurar una fuente para títulos y otra para texto — ¿preferís dejar una sola o configurar
  dos?".

## Regla 2 — Mínima modificación y aislamiento de estilos

- Un pedido sobre UN componente puntual (ej. "el botón", "el input", "el badge") tiene que
  reflejarse SOLO en ese componente (buttonComponent, o UNA key de additionalComponents) — dejá
  null todo lo demás: colors, typography, y los otros componentes no mencionados. Preferí resolver
  el pedido con un cambio dentro del código de ESE componente (ej. una clase Tailwind puntual)
  en vez de tocar un color semántico compartido (cualquier key de colors), aunque el pedido
  mencione la palabra "color".
- Un pedido que requiera cambiar un color semántico compartido (cualquier key de colors) o la
  tipografía global SÍ afecta a todo el sistema — varios componentes lo usan y las escalas de
  color derivadas se recalculan a partir de primary/secondary/foreground. Esto es un cambio
  global/destructivo. En este caso respondé con needsConfirmation=true, confirmationSummary
  explicando en una frase qué se va a afectar, Y IGUAL incluí el "patch" completo con el cambio
  que aplicarías (el backend lo guarda pero NO lo aplica todavía hasta que el usuario confirme —
  vos siempre describís el cambio real, nunca dejes "patch" vacío solo porque hace falta
  confirmar). Usá lenguaje del usuario explícitamente amplio ("todo el sistema", "todos los
  botones", "el primary en general") como señal real de que quiere un cambio global — si el
  pedido suena acotado a un solo componente, preferí la resolución local de arriba en vez de
  tocar colors.

## Confirmación de un cambio pendiente

Si el contexto que te paso incluye un cambio pendiente de confirmación (algo que vos mismo
propusiste en un mensaje anterior), evaluá si el ÚLTIMO mensaje del usuario lo confirma
afirmativamente (ej. "sí", "dale", "confirmá", "aplicalo", "hacelo"). Si lo confirma, respondé
"confirmsPendingEdit": true (con needsConfirmation false, confirmationSummary null, patch null —
el backend aplica el cambio que ya tenía guardado, no necesita que vuelvas a describirlo). Si el
usuario en cambio pidió otra cosa distinta o rechazó el cambio, respondé "confirmsPendingEdit":
false y tratá su último mensaje como un pedido nuevo (puede ser otro cambio quirúrgico, otro
cambio global que requiera confirmación de nuevo, o simplemente una respuesta conversacional).

${COMPONENT_CODE_CONSTRAINTS}

## Formato de respuesta JSON exacto (sin markdown, sin texto adicional)

{
  "assistantMessage": "tu respuesta conversacional en español",
  "needsConfirmation": false,
  "confirmationSummary": "string explicando el cambio global propuesto, o null",
  "confirmsPendingEdit": false,
  "patch": {
    "colors": { "key": "#hex" } o null si no cambian colores,
    "typography": { "fontFamily": "...", "fontFamilyDisplay": "..." } o null si no cambia tipografía (si cambia, incluí el objeto typography completo, no solo las keys de fuente),
    "buttonComponent": "código completo y actualizado del Button" o null si no cambia,
    "additionalComponents": { "input": "código actualizado" } (SOLO las keys que cambian: input/alert/textarea/chip, cada una con su código completo) o null si ninguna cambia
  }
}

"patch" describe SIEMPRE el cambio real que corresponde al pedido — incluso cuando
needsConfirmation es true (el backend decide no aplicarlo todavía, pero necesita el patch real
guardado para aplicarlo tal cual si el usuario confirma después, sin volver a generarlo). La
ÚNICA vez que "patch" va en null es cuando confirmsPendingEdit es true (ahí se reusa el patch ya
guardado) o cuando el mensaje no pide ningún cambio a los tokens (pregunta, charla, etc.).`

export async function interpretDesignSystemEdit(
  messages: ChatMessage[],
  currentTokens: CurrentTokensContext,
  pendingEdit: { summary: string } | null,
): Promise<EditInterpretation> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: EDIT_INSTRUCTION,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1]

  const contextPrefix = `Estado actual del design system (contexto — no lo repitas en
assistantMessage, y no inventes valores para lo que no se te pide cambiar):
- colors: ${JSON.stringify(currentTokens.colors)}
- typography: ${JSON.stringify(currentTokens.typography)}
- buttonComponent: ${currentTokens.buttonComponent}
- additionalComponents.input: ${currentTokens.additionalComponents.input}
- additionalComponents.alert: ${currentTokens.additionalComponents.alert}
- additionalComponents.textarea: ${currentTokens.additionalComponents.textarea}
- additionalComponents.chip (Badge): ${currentTokens.additionalComponents.chip}
${pendingEdit ? `\nCambio pendiente de confirmación que vos mismo propusiste antes: ${pendingEdit.summary}` : ''}

Mensaje del usuario: ${lastMessage.content}`

  const chat = model.startChat({ history })
  const result = await chat.sendMessage(contextPrefix)

  return JSON.parse(result.response.text()) as EditInterpretation
}
