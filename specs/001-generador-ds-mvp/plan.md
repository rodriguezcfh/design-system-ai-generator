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

`package.json` gana `exports`/`main`/`module` apuntando a `dist/` (ver corrección post-lanzamiento
abajo), y se agrega `src/index.js` (`buildIndexEntry`) reexportando los 5 componentes como named
exports desde el código fuente. Esto es suficiente para que `npm install github:<owner>/<repo>`
deje el paquete resoluble vía `require('<paquete>')` / `import { Button } from '<paquete>'` — no
hace falta un registry ni un paso de publish, porque npm soporta instalar directamente desde una
URL de GitHub.

`buildIndexEntry()` reexporta los 5 nombres sin importar si el valor real es el componente
generado por Gemini o el stub de `fallbackComponent()` de `withFallbacks()` (`export function X()
{ return null }`) — ambos son módulos JS válidos con el mismo named export, así que el
re-export funciona igual en cualquiera de los dos casos sin lógica condicional adicional.

### README generado (`buildReadme`)

Nuevo archivo en la raíz del repo exportado cubriendo: cómo correr el Storybook local (`npm
install && npm run storybook`), cómo instalar el repo como dependencia desde otro proyecto (`npm
install github:<owner>/<repo>`), las dos formas de aplicar estilos (CSS ya compilado vs. preset de
Tailwind), y un ejemplo de import por cada uno de los 5 componentes. Es la única documentación de
"cómo se consume este paquete" — no vive en el código de la app, porque el repo exportado es un
artefacto independiente que puede sobrevivir sin la app.

## Corrección post-lanzamiento: componentes precompilados en `dist/`

### El bug real

La primera versión de esta feature dejaba `package.json` apuntando `main`/`exports` directo a
`src/index.js`, que reexporta JSX sin compilar. Esto rompía en la práctica: el optimizador de
dependencias de Vite (basado en esbuild) intenta pre-bundlear cualquier paquete de `node_modules`
asumiendo JS plano, y falla con `Failed to resolve entry for package "..."` en cuanto la cadena de
imports de un dependency package contiene JSX real sin transformar. No era un problema de
`.gitignore` ni de archivos faltantes — `dist/` directamente no existía todavía, porque nunca se
compilaba nada.

### La corrección

`backend/src/lib/buildPackage.ts` agrega dos funciones que corren en el momento del export (no en
el consumidor, que nunca ejecuta un build):

- `buildComponentBundles(sources)`: usa la API de `esbuild` (asíncrona — `buildSync` no soporta
  plugins) con un plugin de módulos virtuales que resuelve `virtual:Button`, `virtual:Input`, etc.
  contra los strings de código ya generados por Gemini (nunca toca disco), transforma JSX
  (`jsx: 'automatic'`) y bundlea a CommonJS y a ESM en paralelo. `react`/`react-dom` quedan
  `external` — el bundle nunca incluye una copia propia de React, usa la del proyecto consumidor
  (evita el clásico "Invalid hook call" por doble instancia de React).
- `buildComponentCss(sources, themeExtend)`: corre PostCSS + Tailwind programáticamente sobre
  `@tailwind components; @tailwind utilities;`, con `content: [{ raw, extension: 'jsx' }]` por
  componente (Tailwind v3 soporta escanear strings en memoria, no requiere archivos en disco) y
  `theme.extend` calculado por `computeTailwindThemeExtend` (ver abajo). Resultado: un
  `dist/index.css` purgado a exactamente las clases que los 5 componentes usan — ideal para quien
  no quiere tocar su propio `tailwind.config.js`. Corre con `preflight: false` a propósito: un
  reset global (`@tailwind base`) filtrándose desde una librería de componentes pisaría los
  estilos base de la app consumidora entera, no solo los componentes.

`scaffold.ts` gana `computeTailwindThemeExtend(colors, colorScales, typography)`, que separa el
cómputo del objeto `theme.extend` (antes solo existía como texto plantillado dentro de
`buildTailwindPreset`) de su serialización a archivo. Ambos consumidores — el `tailwind-preset.js`
que se commitea (`buildTailwindPreset`, ahora solo serializa el resultado como JSON literal en vez
de un `require()` en runtime de `colors.json`/`colorScales.json`) y el build de CSS en memoria
(`buildComponentCss`) — comparten esa única fuente de verdad.

`github.service.ts` llama a ambas funciones en `scaffoldRepository` y en `createUpdatePR` (cada
export/update recompila desde cero, porque el código de los componentes pudo cambiar) y agrega
`dist/index.js`, `dist/index.esm.js`, `dist/index.css` a la lista de archivos escritos, junto con
un `.gitignore` (`buildGitignore`) que deliberadamente **no** excluye `dist/` — la razón de ser de
este archivo es justamente que sí quede versionado, porque un paquete instalado vía git nunca
corre `npm run build`.

`package.json` pasa a `main: './dist/index.js'`, `module: './dist/index.esm.js'` (convención de
bundlers para preferir ESM) y un `exports['.']` condicional (`import`/`require`/`default`), más
`exports['./styles.css']` apuntando al CSS compilado. El README (FR-010) documenta ambas formas de
aplicar estilos como alternativas explícitas, no una sola verdad.

## Segunda consolidación: el incidente de `prueba.3`

### Qué pasó

Después del fix de arriba, `prueba.3` (un design system exportado antes del fix) tenía un
`package.json` viejo y roto. En vez de re-exportar/actualizar desde la app, alguien parcheó el
repo exportado a mano: agregó un `dist/index.css` y cambió el `exports` de `package.json` a mano,
pero con una ruta (`./dist/index.css`) que no coincidía con la que el README documentaba
(`./styles.css`). Resultado: un repo exportado que ya no reflejaba lo que el generador produce, y
un import roto contra un archivo que el `exports` real no declaraba. Esto confirmó dos huecos
reales, no hipotéticos:

1. **`createUpdatePR` nunca reescribía `package.json`.** Solo `scaffoldRepository` (export
   inicial) lo hacía. Un design system exportado antes de esta feature, actualizado después via
   PR, se quedaría con su `package.json` viejo para siempre — el `dist/*` nuevo se agregaría, pero
   apuntando a un entry point que el `package.json` ni conocía. Se agregó `package.json` a la
   lista de `filesToUpdate` de `createUpdatePR`.
2. **Nada impedía que el README y el `package.json` generados quedaran desincronizados** si
   alguien tocaba uno sin el otro (a mano en el repo exportado, o editando `buildReadme`/
   `buildPackageJson` en el futuro sin querer). Se agregó un test (`scaffold.test.ts`, describe
   `README ↔ package.json exports stay in sync`) que extrae por regex cada ruta de import/require
   de ejemplo del README generado (`import '<paquete>/x'`, `from '<paquete>'`,
   `require('<paquete>/x')`) y falla si esa ruta no es una key real del `exports` que
   `buildPackageJson` generó — usando `'prueba.3'` como nombre de repo de prueba (con el punto
   literal del nombre real) para blindar el propio escapeo de la regex.

### Refuerzos adicionales

- `dist/index.js`, `dist/index.esm.js` y `dist/index.css` ahora empiezan con un comentario
  (`/* Archivo generado automáticamente en cada exportación — no editar a mano, se
  sobreescribe. */`), y el README repite la advertencia en prosa. La intención no es impedir
  técnicamente una edición manual (no hay forma de hacerlo en un repo git normal), sino dejar
  imposible de ignorar que cualquier cambio ahí se pierde en la próxima exportación.
- El README (`buildReadme`) pasa de presentar "dos opciones equivalentes" a dos caminos con roles
  explícitos: **principal** (`dist/` + `styles.css`, recomendado, funciona sin Tailwind propio) y
  **avanzado/opcional** (`tailwind-preset.js`, para quien construye sus propios componentes con
  los mismos tokens). Ambos siguen derivando de `computeTailwindThemeExtend`, así que no hay forma
  de que un cambio de color quede reflejado en uno y no el otro.

### Por qué la verificación de punta a punta no se puede automatizar completamente

Instalar `github:<owner>/<repo>` real y confirmar que un `npm run dev`/`build` externo no falla
requiere: (a) un design system real exportado a través del flujo autenticado de la app, y (b) una
cuenta de GitHub conectada por OAuth (consentimiento en navegador). Ninguna de las dos se puede
fabricar de forma segura fuera de una sesión real del usuario — así que esa verificación final
(incluyendo re-exportar `prueba.3` para confirmar que el flujo pisa limpio el parche manual) la
corre el usuario desde la app, no el agente.

## Segundo modo de export: `EMBEDDED` ("agregar a mi proyecto")

### Por qué dos modos, y por qué `EMBEDDED` es el default

El modo original (ahora `STANDALONE`) resuelve un caso específico: un design system que se
reutiliza como dependencia versionada entre varios proyectos. Pero el caso más común observado en
uso real es más simple — alguien construyendo un único proyecto puntual (una landing, un sitio)
que solo necesita los tokens y componentes *adentro* de ese proyecto, sin la sobrecarga de un
segundo repo, un `package.json` propio, Storybook, o un paso de build con esbuild. Forzar siempre
el camino `STANDALONE` para ese caso agrega fricción real: hay que crear/administrar un repo
aparte y aprender a instalarlo como dependencia, para terminar usando los mismos 5 componentes que
podrían vivir directo en el proyecto. `EMBEDDED` es la respuesta a eso — mismo patrón que
shadcn/ui: los archivos se copian al proyecto del usuario y pasan a ser su código, no una
dependencia versionada. Por resolver el caso más común, es el modo por default en el selector del
frontend; `STANDALONE` sigue existiendo intacto para quien de verdad necesita un paquete
reutilizable, elegido a propósito.

### Qué NO se toca en modo `EMBEDDED`, y por qué

- **Sin Storybook, sin `package.json`, sin `dist/` compilado.** Ninguno de estos tiene sentido
  dentro de la carpeta de otro proyecto — el usuario ya tiene su propio bundler, su propio
  `package.json`, y probablemente ya renderiza sus componentes con Vite/Next/CRA. Compilar un
  `dist/` ahí sería redundante (el bundler del propio proyecto ya procesa JSX) y generaría
  archivos derivados que quedarían obsoletos apenas alguien edite el componente a mano — cosa que
  se espera que pase, porque estos archivos son del usuario ahora.
- **Nunca se edita el `tailwind.config` del usuario.** El generador no conoce su formato (CJS vs
  ESM, si ya tiene otros `presets`/`plugins`, si usa Tailwind v3 o v4) — una edición automática
  mal hecha puede romper su build silenciosamente, y el usuario no tiene por qué confiar en que un
  bot le va a tocar bien un archivo de configuración central de su proyecto. En cambio, el export
  deja la única línea que hace falta agregar (`presets:
  [require('./<targetPath>/tailwind-preset')]`) documentada en `INSTALL.md` y en el cuerpo del PR
  — una acción explícita de una línea que el usuario revisa y aplica él mismo.
- **Los componentes SÍ pasan por `normalizeComponentSources`** (la misma normalización de
  `export default` → export nombrado que ya protege el modo `STANDALONE`), pero **no llevan el
  banner de "generado, no editar"** que sí lleva `dist/*` en `STANDALONE` — es la distinción
  clave entre los dos modos: en `EMBEDDED` estos archivos están pensados para ser editados a mano
  desde el primer commit, son la entrega final, no un artefacto intermedio.

### `embedIntoRepository` — commit inicial vs. rama + PR

Mismo criterio que ya usa `createUpdatePR` para decidir static entre crear vs. actualizar, pero la
pregunta que responde es distinta: no "¿ya existe un repo para este design system?" (eso lo
decide `Repository.mode` en la base de datos), sino "¿el repo destino tiene commits?" — porque el
repo es del usuario, pudo haber sido creado vacío recién (para este propósito) o ya tener su
proyecto andando. Se detecta intentando `GET /repos/{owner}/{repo}/branches/{default_branch}`: un
404 significa repo sin commits todavía, y la API de Contents (`PUT
/repos/{owner}/{repo}/contents/{path}`) puede crear el primer commit de un repo vacío directo
sobre la rama default sin necesitar un ref previo — eso resuelve el caso "recién creado" sin rama
ni PR. Si la rama default ya existe, se sigue el mismo patrón de `createUpdatePR`: rama nueva +
PR, pero escribiendo *solo* rutas bajo `targetPath/` — nunca se toca ni se lista ningún otro
archivo del repo del usuario.

Antes de escribir nada, se valida que el repo exista y que el token conectado tenga permiso de
escritura (`GET /repos/{owner}/{repo}` y su campo `permissions.push`) — un repo inexistente o sin
acceso de escritura tira un error tipado (`GithubRepoNotFoundError` /
`GithubRepoAccessDeniedError`) antes de intentar ninguna escritura, no un 500 genérico a mitad de
camino.

### Modelo de datos: `Repository` deja de ser un repo único por Design System

Un Design System puede tener a lo sumo un repo `STANDALONE` (invariante que ya existía), pero
puede tener N repos `EMBEDDED` — un mismo design system inyectado en varios proyectos puntuales
distintos. Esto rompe el supuesto original de "un `Repository` por `DesignSystem`"
(`designSystemId @unique`). Se quita ese `@unique` y `Repository` gana `mode` (`STANDALONE` |
`EMBEDDED`, default `STANDALONE`) y `targetPath` (solo aplica a `EMBEDDED`). La relación en
`DesignSystem` pasa de `repository Repository?` (uno) a `repositories Repository[]` (varios).

El invariante "a lo sumo un `STANDALONE` por Design System" ya no lo garantiza la base de datos —
se sigue enforzando en código, igual que antes: `export.service.ts` busca un repo `STANDALONE`
existente (`findFirst({ where: { designSystemId, mode: 'STANDALONE' } })`) antes de decidir si
crea uno nuevo o actualiza el que ya existe. Para `EMBEDDED`, la búsqueda análoga filtra además
por `repoFullName`, porque ahí sí puede haber más de una fila legítima por Design System — lo que
se evita es crear una fila duplicada cada vez que se actualiza el *mismo* repo destino.

El endpoint que devuelve el detalle de un Design System (`designSystem.service.ts`) sigue
exponiendo `repository` (singular) en su respuesta — internamente ahora resuelve cuál de las
`repositories` es la `STANDALONE`, para no romper el contrato que ya consume el frontend (el botón
de "Desplegar en Vercel" solo tiene sentido para `STANDALONE`, `EMBEDDED` no tiene Storybook que
desplegar).
