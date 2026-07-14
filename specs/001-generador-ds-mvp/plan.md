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

## Repo exportado instalable como dependencia (preset de Tailwind + package entry point)

### Separación preset / config

`tailwind.config.js` en el repo exportado mezclaba dos cosas que en realidad tienen audiencias
distintas: la parte reutilizable (colores/tipografía derivados de los tokens del design system,
útil para *cualquier* proyecto que consuma el paquete) y la parte específica de ese repo (`content`
— los globs de archivos a escanear, que solo tienen sentido para el propio Storybook local, nunca
para un consumidor externo). Se separan en dos archivos:

- `tailwind-preset.js` (`buildTailwindPreset`): solo `theme.extend.colors` (tokens semánticos
  planos + las escalas 50–900 de `colorScales` como objetos anidados, para que utilities como
  `bg-primary-700` funcionen igual que `bg-primary`) y `theme.extend.fontFamily`. Sin `content` —
  un preset con `content` fijo rompería el escaneo de clases del proyecto que lo importe.
- `tailwind.config.js` (`buildTailwindConfig`): `content` propio del repo + `presets:
  [require('./tailwind-preset.js')]`. Dejó de repetir colores/tipografía.

Esto es lo que permite que un segundo proyecto haga `presets:
[require('<paquete>/tailwind-preset')]` en su propio `tailwind.config.js` sin heredar (ni pisar)
el `content` del repo exportado.

### Paquete instalable vía git

`package.json` gana `main: "src/index.js"` y `exports` (`"."` → `src/index.js`, `"./tailwind-preset"`
→ `tailwind-preset.js`), y se agrega `src/index.js` (`buildIndexEntry`) reexportando los 5
componentes como named exports. Esto es suficiente para que `npm install
github:<owner>/<repo>` deje el paquete resoluble vía `require('<paquete>')` /
`import { Button } from '<paquete>'` — no hace falta un registry ni un paso de publish, porque npm
soporta instalar directamente desde una URL de GitHub.

Los componentes se siguen distribuyendo como JSX sin compilar (mismo criterio que ya regía para el
Storybook local: el consumidor necesita un bundler que entienda JSX — Vite, Next, CRA, etc. — lo
cual es la norma en proyectos React modernos). No se agrega un paso de build/transpile a esta
feature; queda documentado explícitamente en el README para que no sea una sorpresa.

`buildIndexEntry()` reexporta los 5 nombres sin importar si el valor real es el componente
generado por Gemini o el stub de `fallbackComponent()` de `withFallbacks()` (`export function X()
{ return null }`) — ambos son módulos JS válidos con el mismo named export, así que el
re-export funciona igual en cualquiera de los dos casos sin lógica condicional adicional.

### README generado (`buildReadme`)

Nuevo archivo en la raíz del repo exportado cubriendo: cómo correr el Storybook local (`npm
install && npm run storybook`), cómo instalar el repo como dependencia desde otro proyecto (`npm
install github:<owner>/<repo>`), cómo extender el `tailwind.config.js` del proyecto consumidor
con el preset, un ejemplo de import por cada uno de los 5 componentes, y la nota sobre JSX sin
compilar. Es la única documentación de "cómo se consume este paquete" — no vive en el código de la
app, porque el repo exportado es un artefacto independiente que puede sobrevivir sin la app.
