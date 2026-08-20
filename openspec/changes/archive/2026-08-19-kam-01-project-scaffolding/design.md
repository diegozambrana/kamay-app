# Design — KAM-01 · Andamiaje del proyecto

## Context

El repositorio ya existe como salida de `create-next-app` (Next.js 16.3.1, React 19.2.8, Tailwind 4, TypeScript, ESLint 9) con solo `app/`, y OpenSpec ya está inicializado con el esquema `spec-driven`. Restricciones que dan forma al enfoque: `specs/PRD/ARCHITECTURE.md` fija stack, estructura de carpetas, comandos y secuencia de CI; `AGENTS.md` advierte que esta versión de Next.js tiene cambios incompatibles con el conocimiento previo y obliga a consultar `node_modules/next/dist/docs/` antes de escribir código. Motivación: ver `proposal.md` — Why.

## Goals / Non-Goals

**Goals:**
- Dejar cada herramienta *demostrada*, no solo instalada: una prueba real por nivel, un pipeline de CI que corre y falla cuando debe.
- Que la estructura de carpetas y las convenciones queden fijadas antes de que exista código de producto que las erosione.

**Non-Goals:**
- Ninguna decisión de dominio: sin tablas de negocio, sin semillas de datos, sin autenticación (eso es KAM-02).
- No configurar Zustand, react-hook-form, Zod, dnd-kit, Serwist/Dexie ni el resto del stack de features: cada pieza se agrega en la tarea que la usa por primera vez.
- No configurar despliegue (Vercel u otro): KAM-23.

## Decisions

1. **Completar la base existente, no regenerarla.** El `create-next-app` ya cometido coincide con el stack requerido; se ajusta (`strict` verificado, alias `@/*`, puerto 3010 en `dev`) en lugar de rehacer el proyecto. Alternativa descartada: regenerar desde cero, que solo aportaría ruido en el historial.

2. **Tema con `next-themes` + shadcn/ui neutro.** shadcn/ui se inicializa con tema neutro (`neutral`) y CSS variables; el conmutador usa `next-themes` con `attribute="class"` y `suppressHydrationWarning` en `<html>`, y persiste por su mecanismo estándar (localStorage). Es el patrón que ARCHITECTURE.md ya prescribe; no hay alternativa real que considerar.

3. **Estructura de carpetas con `.gitkeep`.** Las carpetas de ARCHITECTURE.md (`actions/`, `services/`, `features/`, `components/`, `types/`, `lib/`, `constants/`, `configs/`, `hooks/`, `stores/`, `tests/`) se crean vacías con `.gitkeep` para que git las conserve. Alternativa descartada: crearlas al usarlas — perdería el efecto de mapa que la estructura completa da a asistentes y revisores.

4. **Vitest con dos proyectos: unit e integration.** Una sola instalación de Vitest con configuración separada por entorno: `test:unit` (jsdom + Testing Library, `*.test.ts(x)` junto al código) y `test:integration` (node, `tests/integration/`, presupone Supabase local levantado). Alternativa descartada: Jest — Vitest comparte la tubería de Vite/ESM con el resto del stack y es lo que fija ARCHITECTURE.md.

5. **pgTAP habilitado por migración inicial de infraestructura.** Una única migración `..._enable_pgtap.sql` con `create extension if not exists pgtap;` — es infraestructura de pruebas, no tabla de negocio, así que no viola el "fuera de alcance". La prueba pgTAP mínima (`supabase/tests/harness.test.sql`) verifica algo trivial pero real (p. ej. que la extensión responde), ejecutada con `supabase test db`. Alternativa descartada: crear la extensión desde el propio archivo de prueba — dejaría el esquema local distinto del que CI reconstruye con `db reset`.

6. **Playwright contra build de producción en CI, contra dev en local.** `playwright.config.ts` usa `webServer` apuntando al puerto 3010; en CI arranca `next start` tras `build` (la secuencia de ARCHITECTURE.md ya exige `build` antes de e2e). La prueba mínima abre `/` y verifica el conmutador de tema — cubre a la vez el escenario e2e y el criterio 1.

7. **CI en un solo job secuencial.** `.github/workflows/ci.yml` con la secuencia literal `lint → typecheck → test:unit → supabase start → test:integration (pgTAP) → build → test:e2e`, usando `supabase/setup-cli` para el CLI. Alternativa descartada: jobs paralelos — más rápidos, pero la secuencia única replica exactamente la definición de terminado del backlog y simplifica el diagnóstico; se puede paralelizar en KAM-23.

8. **Graphify vía gancho `post-commit` gestionado por `graphify hook install`.** Se usa el mecanismo propio de la herramienta en lugar de un gancho manual; `graphify-out/` ya existe y queda versionado. El grafo se regenera tras la migración de pgTAP (regla de ARCHITECTURE.md: todo cambio de esquema regenera el grafo).

9. **Leer `node_modules/next/dist/docs/` antes de tocar `app/`.** Por la advertencia de `AGENTS.md`, la primera tarea de implementación es revisar la documentación embarcada de esta versión de Next.js (layout raíz, `ThemeProvider`, configuración) en lugar de asumir las convenciones conocidas.

## Risks / Trade-offs

- [La versión de Next.js difiere del conocimiento entrenado del asistente] → Decisión 9: leer la documentación embarcada antes de escribir código; validar con `npm run dev` y la prueba e2e.
- [`supabase start` en CI es lento o inestable] → Usar `supabase/setup-cli` oficial y cachear; si el arranque falla de forma intermitente, reintentar el paso, no marcar la suite como opcional.
- [Las suites casi vacías dan sensación de seguridad falsa] → Cada nivel tiene al menos una prueba que ejercita el camino completo (renderizado real, base de datos real, navegador real), no un `expect(true)`.
- [El gancho `post-commit` alarga cada commit] → El modo incremental de Graphify lo mitiga; si resulta molesto, el gancho puede limitarse a avisar y la regeneración hacerse manual — se decidirá con uso real, sin cambiar el spec (el escenario solo exige que el grafo se actualice tras el commit).

## Migration Plan

No aplica: no hay sistema en producción ni datos. El cambio es el punto de partida del repositorio; revertirlo es revertir los commits.

## Open Questions

- Versión exacta de la imagen de Postgres local que fija el CLI de Supabase (no cambia el enfoque; se toma la que el CLI traiga al ejecutar `supabase init`).
