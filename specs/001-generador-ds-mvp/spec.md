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
- **FR-008 — Vista de resultados "Foundations"** *(nuevo por esta feature)*: la vista de preview
  de un design system generado debe presentar los tokens organizados como foundations de un
  design system real, no como una grilla plana:
  1. Encabezado de sección (eyebrow + título + subtítulo).
  2. Paleta de colores con conteo total de tokens.
  3. Colores semánticos (primary, accent/secondary, success, warning, error).
  4. Neutros (foreground, secondary text, muted fg, border, muted bg).
  5. Superficies (background, card, y variantes oscuras tipo sidebar si el tema las tiene).
  6. Escalas de color 50–900 para las familias primary/accent/neutral.
  7. Tipografía: fuente principal.
  8. Escala tipográfica en tabla (estilo, preview en vivo, tamaño en px/rem, peso con nombre y
     valor numérico), de mayor a menor tamaño.

## Fuera de alcance (por ahora)

- Edición manual de tokens generados desde la UI (solo se puede regenerar via chat).
- Multi-idioma (todo el chat/brief está en español).
- Roles/equipos — cada design system pertenece a un único usuario.
