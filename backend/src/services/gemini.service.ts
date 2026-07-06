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
    model: 'gemini-1.5-flash',
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
