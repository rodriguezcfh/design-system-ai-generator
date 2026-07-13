# Plan técnico — Generador de Design System (MVP)

## Arquitectura

- **Backend**: Express + TypeScript, Prisma sobre Postgres (Railway en dev). Auth con JWT
  (`lib/jwt.ts`). Capas: `controllers/` (HTTP + validación zod) → `services/` (lógica de negocio,
  mockeable en tests) → `lib/` (utilidades puras: `wcag.service.ts`, `crypto.ts`, `scaffold.ts`).
- **IA**: Google Gemini (`@google/generative-ai`, modelo `gemini-2.5-flash`) para dos tareas:
  extraer el brief de marca desde la conversación (`extractBrief`) y generar los tokens/componente
  (`generateDesignSystem`). Ambas fuerzan `responseMimeType: application/json` y devuelven un JSON
  con forma fija que el backend parsea directamente.
- **Frontend**: React + Vite + Tailwind, sin state manager global — estado por página
  (`DesignSystemPage.tsx`) pasado como props a `ChatPanel`/`PreviewPanel`/`ExportPanel`. Tipos de
  API (`api/client.ts`) espejan a mano las formas del backend (no hay paquete compartido).

## Esta feature: brief con preferencias explícitas + PreviewPanel "Foundations"

### Por qué colorScales se calcula en código y no se le pide a Gemini

Pedirle a un LLM 30 hex exactos (10 shades × 3 familias) con buen contraste y progresión visual
consistente es frágil: más superficie de JSON mal formado, más tokens, y el resultado no es
verificable determinísticamente. Una escala de shades a partir de un color base es matemática
conocida (interpolación en HSL sobre lightness, manteniendo hue/saturation). Se implementa una vez
en `backend/src/lib/colorScale.ts`, testeable de forma pura, igual que `wcag.service.ts`.

Lo que sí le pedimos a Gemini es **criterio de diseño real**: qué hex usar como primary/accent
cuando el usuario no dio preferencia, y qué escala tipográfica (tamaños/pesos con propósito:
Display para héroes, Body para texto) tiene sentido para el tono de marca — eso no es
determinístico y es exactamente para lo que sirve el modelo.

### Contrato ampliado (`GeneratedDesignSystem`, `backend/src/services/gemini.service.ts`)

- `colors`: se mantiene `Record<string, string>` plano (compatibilidad con `wcag.service.ts` y el
  scaffold de export, que iteran genéricamente sobre esa forma). Se agregan keys nuevas:
  `success`, `successForeground`, `warning`, `warningForeground`, `border`, `card`,
  `cardForeground`, y opcionalmente `sidebar*`.
- `colorScales`: **no** viene de Gemini. Se calcula en `generation.service.ts` después de recibir
  la respuesta, a partir de `colors.primary` / `colors.secondary` / `colors.foreground`.
- `typographyScale`: sí viene de Gemini, como array de estilos con rol (`display`/`heading`/
  `body`) — el tamaño/peso por nivel es una decisión de diseño, no cómputo.
- `BriefInput` (lo que recibe `generateDesignSystem`) gana `preferredColors`,
  `preferredHeadingFont`, `preferredBodyFont` opcionales, propagados desde `BrandBrief`.

### Persistencia

`DesignTokens.colors`/`.typography` no cambian de forma (compat con export). Se agregan columnas
`colorScales Json?` y `typographyScale Json?` en vez de anidarlos dentro de `colors`/`typography`,
para no romper el `Object.entries()` genérico que usa `scaffold.ts` al armar `tailwind.config.js`
y `colors.json`/`typography.json` del repo exportado.

`BrandBrief` gana `preferredColors Json?`, `preferredHeadingFont String?`,
`preferredBodyFont String?` — persistidos en cada turno de chat aunque el brief todavía no esté
completo, igual que `tone`/`values`/`references` hoy.

## Componentes adicionales (Input, Alert, Textarea, Badge)

### Contrato de props fijo por componente

El mismo patrón que ya resolvía Button se replica 4 veces: el prompt le exige a Gemini una API de
props específica y documentada (`Input: { placeholder, disabled, error, errorMessage,
defaultValue }`, etc. — ver FR-009 en `spec.md`), y `scaffold.ts` escribe una story CSF estática
(no generada por IA) que asume esa API exacta. Esto es necesario porque la story se escribe una
sola vez en nuestro código; si el prop contract variara según lo que la IA decida cada vez, la
story rompería. La IA controla el styling (qué clases de Tailwind, qué estructura JSX interna),
no el contrato público del componente.

### `additionalComponents` como columna separada, no reemplazo de `componentCode`

`DesignTokens.componentCode` (Button) queda intacto. Se agrega `additionalComponents Json?` con
forma `{ input, alert, textarea, chip }` en vez de migrar todo a una estructura unificada
`components: Json` — evita tocar el código/tests existentes de Button sin necesidad real, y deja
la puerta abierta a que Button se sume a esa estructura más adelante si hiciera falta.

### Validación por componente con nombre en el error

`assertValidComponentCode(name, code)` en `validateComponentCode.ts` envuelve los 2 guards
existentes (`assertNoTypeScriptSyntax`, `assertNoDisallowedImports`) y prefija el nombre del
componente al mensaje de error. Sin esto, un 422 por un componente roto entre 5 no diría cuál —
`generation.service.ts` corre el guard 5 veces (Button, Input, Alert, Textarea, Badge) antes de
persistir nada.

### Por qué el preview en el frontend no ejecuta el JSX generado

`PreviewPanel.tsx` nunca ejecutó el código de Button generado por la IA — `ButtonPreview` es un
componente React propio que aproxima visualmente el resultado usando `tokens.colors`. Evaluar
JSX arbitrario generado por un LLM en el navegador del usuario sería una superficie de
inyección de código innecesaria para lo que se necesita (una vista previa aproximada, no una
ejecución fiel). Los 4 preview nuevos (`InputPreview`, `AlertPreview`, `TextareaPreview`,
`BadgePreview`) siguen el mismo patrón.

### Compatibilidad con design systems generados antes de esta feature

Un `DesignTokens` viejo tiene `additionalComponents: null`. `export.service.ts` resuelve esto con
`withFallbacks()`: si es `null`, sustituye por componentes placeholder mínimos (`export function
Input() { return null }`, etc.) en vez de romper el export — el usuario puede regenerar el design
system para obtener los componentes reales.
