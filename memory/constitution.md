# Constitution — Design System AI Generator

Principios que gobiernan cómo se construye este proyecto. Cualquier feature o cambio nuevo debe
poder justificarse contra estos puntos; si los contradice, la spec/plan de la feature debe decir
por qué explícitamente.

## 1. Test-Driven Development

Todo comportamiento de backend nuevo (endpoints, servicios, validaciones) se implementa con tests
que lo cubran — no se agrega lógica de negocio sin un test que la ejerza. Los mocks se hacen a
nivel de `prisma` y de servicios externos (Gemini, GitHub), nunca a nivel de base de datos real en
el suite automatizado.

## 2. WCAG 2.1 AA es un gate, no una sugerencia

Ninguna paleta generada se puede exportar a un repo real si no pasa contraste AA
(`validatePalette` en `wcag.service.ts`, gateado en `export.service.ts` vía `WcagFailedError`).
Cualquier color semántico nuevo que se agregue a los tokens (success, warning, etc.) debe sumarse
también a los pares chequeados, no solo a la paleta visual.

## 3. Secrets y tokens nunca llegan al frontend ni a los logs en crudo

Tokens de GitHub se guardan encriptados (`crypto` service) y solo se desencriptan en la capa de
servicio antes de llamar a la API externa. Nunca se exponen al cliente ni se loguean.

## 4. Errores reales se loguean, nunca se tragan en silencio

Todo `catch` que devuelve un 500 genérico debe loguear la causa real con `console.error` y
contexto de qué operación falló, para que un fallo de una dependencia externa (Gemini, GitHub,
DB) sea diagnosticable desde la terminal en vez de aparecer como "Internal server error" sin más
información.

## 5. Contratos de IA se diseñan para minimizar fragilidad

Cuando una feature necesita datos de un LLM (Gemini), solo se le pide al modelo lo que
genuinamente requiere criterio (paleta de colores, tono, textos), no cómputo determinístico que
el código puede hacer de forma confiable (ej. escalas de color 50-900 a partir de un hex base se
calculan en código, no se le piden 30 hex exactos a un LLM). Menos JSON generado por el modelo:
menos superficie para respuestas mal formadas o 500s.

## 6. Monorepo con dos workspaces

`frontend` (React + Vite + Tailwind) y `backend` (Express + Prisma + Postgres) conviven en un
único repo con `npm workspaces`. `npm run dev`/`npm run test` en la raíz corren ambos.
