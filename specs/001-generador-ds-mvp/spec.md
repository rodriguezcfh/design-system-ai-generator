# Spec — Generador de Design System (MVP)

## Resumen

Una app donde un usuario conversa con un asistente de marca (Gemini) para definir tono, valores y
preferencias de una marca, genera a partir de eso un design system (paleta de colores + tipografía
+ componente Button) validado contra WCAG 2.1 AA, y lo exporta como PR/repo de Storybook a GitHub.

## Requisitos funcionales

- **FR-001 — Autenticación**: signup/login por email+password, sesión vía JWT.
- **FR-002 — CRUD de design systems**: un usuario crea, lista y consulta sus design systems
  (`DesignSystem` con estado `DRAFT → GENERATED → APPROVED → EXPORTED`).
- **FR-003 — Chat de marca**: el usuario conversa en lenguaje natural (español) con un asistente
  que va completando un `BrandBrief` (tono, valores, referencias) y decide cuándo el brief está
  completo (`isComplete`). Soporta adjuntar archivos (PDF) como referencia.
- **FR-004 — Extracción de preferencias explícitas del brief** *(ampliado por esta feature)*:
  además de tono/valores/referencias, si el usuario menciona **colores hexadecimales concretos**
  o **nombres de tipografía concretos** (para títulos y/o para texto de cuerpo), el asistente los
  debe capturar literalmente — sin reinterpretarlos ni reemplazarlos — en el brief
  (`preferredColors`, `preferredHeadingFont`, `preferredBodyFont`). Si no se mencionan, quedan en
  `null`.
- **FR-005 — Generación de tokens**: a partir del brief completo, se genera una paleta de colores,
  tipografía y un componente Button en React+Tailwind. Si el brief trae preferencias explícitas de
  FR-004, la generación las debe respetar tal cual (no reinventar esos valores) y construir el
  resto del sistema alrededor de ellas manteniendo WCAG AA.
- **FR-006 — Validación WCAG 2.1 AA**: toda paleta generada se valida contra pares
  foreground/background conocidos (botones, texto, estados). Una paleta que no pasa AA bloquea el
  export (no bloquea la generación ni la visualización).
- **FR-007 — Export a GitHub/Storybook**: con una cuenta de GitHub conectada (OAuth), el usuario
  exporta el design system aprobado como un repo nuevo (scaffold de Storybook + Tailwind) o, si ya
  existe un repo para ese design system, como un PR de actualización con título/descripción
  generados por IA.
- **FR-008 — Vista de resultados "Foundations"**: la vista de preview de un design system
  generado debe presentar los tokens organizados como foundations de un design system real, no
  como una grilla plana:
  1. Encabezado de sección (eyebrow + título + subtítulo).
  2. Paleta de colores con conteo total de tokens.
  3. Colores semánticos (primary, accent/secondary, success, warning, error).
  4. Neutros (foreground, secondary text, muted fg, border, muted bg).
  5. Superficies (background, card, y variantes oscuras tipo sidebar si el tema las tiene).
  6. Escalas de color 50–900 para las familias primary/accent/neutral.
  7. Tipografía: fuente principal.
  8. Escala tipográfica en tabla (estilo, preview en vivo, tamaño en px/rem, peso con nombre y
     valor numérico), de mayor a menor tamaño.
- **FR-009 — Biblioteca de componentes ampliada** *(nuevo por esta feature)*: además del Button,
  la generación produce 4 componentes más pensados para armar una landing page simple, cada uno
  con un contrato de props fijo (independiente de lo que la IA elija estilísticamente) para que
  las stories de Storybook que los documentan sean deterministas:
  - **Input**: `{ placeholder, disabled, error, errorMessage, defaultValue }`. Estados: default,
    foco (ring con el color primary), disabled, error (borde/texto en el color error + mensaje).
  - **Textarea**: mismo contrato que Input más `rows` (default 4).
  - **Alert**: `{ variant: 'success'|'warning'|'error', title, children }`. Usa los tokens
    semánticos ya existentes (success/warning/error + sus foregrounds).
  - **Badge** (Chip): `{ variant: 'default'|'primary'|'success'|'warning'|'error', children }`,
    para categorías/etiquetas.
  La vista de preview (FR-008) muestra los 4 componentes nuevos antes de exportar, y el export
  a GitHub/Storybook (FR-007) los documenta con su propia story junto a la de Button.
- **FR-010 — Repo exportado instalable como dependencia** *(nuevo por esta feature; corregido y
  consolidado post-lanzamiento tras un incidente real — ver plan.md)*: el repo que genera FR-007
  no debe ser solo un Storybook standalone — también debe poder consumirse como paquete desde otro
  proyecto. Esta es la forma **oficial y única** de distribuirlo; no depende de ediciones manuales
  en el repo exportado, que se pierden en la siguiente exportación.
  - `npm install github:<owner>/<repo>` debe dejar los 5 componentes (Button, Input, Textarea,
    Alert, Badge) importables como named exports desde la raíz del paquete
    (`import { Button } from '<paquete>'`), y resolver correctamente con bundlers modernos
    (Vite, webpack, etc.) sin errores de resolución de entrada.
  - **Camino principal (recomendado)**: los componentes se distribuyen **precompilados**
    (`dist/index.js` CommonJS + `dist/index.esm.js` ESM, `react`/`react-dom` externos) junto con
    `dist/index.css` (hoja de estilos purgada a las clases que los 5 componentes realmente usan)
    — funciona en cualquier bundler/framework sin depender de que el consumidor tenga Tailwind
    configurado. Un paquete instalado vía git nunca corre un paso de build, así que este
    compilado tiene que existir físicamente en el repo, y queda marcado como generado
    (no editable a mano). El código fuente sin compilar sigue disponible en `src/components/`
    para quien lo quiera inspeccionar directamente.
  - **Camino avanzado/opcional**: un preset de Tailwind (`tailwind-preset.js`) con los tokens
    semánticos y las escalas de color 50–900, para quien prefiera construir sus propios
    componentes reusando la paleta de marca en vez de (o además de) usar los 5 ya armados,
    extendiendo su propio `tailwind.config.js` con `presets: [require('<paquete>/tailwind-preset')]`.
  - Ambos caminos derivan del mismo cómputo de tema (una única fuente de verdad) — un cambio de
    color nunca puede quedar reflejado en uno y no en el otro.
  - El `tailwind.config.js` propio del repo exportado (el que usa su Storybook local) debe
    consumir ese mismo preset en vez de repetir la configuración de colores/tipografía.
  - `dist/*`, `tailwind-preset.js` y `package.json` (con su campo `exports`) se **regeneran en
    toda exportación**, tanto la inicial (repo nuevo) como cualquier actualización posterior
    (PR de update) — nunca solo en la primera.
  - El README del repo exportado debe cubrir: cómo correr el Storybook local, cómo instalar el
    repo como dependencia, los dos caminos de consumo con sus roles diferenciados, un ejemplo de
    import por cada uno de los 5 componentes, y la advertencia de que `dist/` es generado.
  - El generador debe tener un test que falle si algún ejemplo de import/require documentado en
    el README no corresponde a una key real del `exports` de `package.json` — para que el README
    y el paquete nunca puedan desincronizarse silenciosamente.

## Fuera de alcance (por ahora)

- Edición manual de tokens generados desde la UI (solo se puede regenerar via chat).
- Multi-idioma (todo el chat/brief está en español).
- Roles/equipos — cada design system pertenece a un único usuario.
