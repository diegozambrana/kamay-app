# KAM-01 · Andamiaje del proyecto y disciplina de trabajo

> Origen: `specs/PRD/kamay-backlog.md` — tarea **KAM-01**, Fase 0. Sin dependencias previas.

## Why

Todo el trabajo posterior de Kamay (KAM-02 en adelante) presupone que el repositorio ya tiene estructura, pruebas en tres niveles, especificaciones vivas y CI desde el primer commit. La versión anterior del sistema fracasó precisamente por agregar disciplina "después": este cambio la instala antes de escribir una sola pantalla de producto.

## What Changes

- Proyecto Next.js 16 + React 19 + TypeScript `strict`, con el alias `@/*` (base ya generada por `create-next-app`; se completa y se verifica).
- Tailwind 4 y shadcn/ui inicializados con tema neutro y conmutador de modo claro/oscuro (`next-themes`).
- Estructura de carpetas completa de `specs/PRD/ARCHITECTURE.md` (`actions/`, `services/`, `features/`, `components/`, `types/`, `lib/`, `constants/`, `configs/`, `hooks/`, `stores/`, `supabase/`, `tests/`), aunque muchas queden vacías.
- Supabase local (`supabase init`), con `supabase start` y `supabase db reset` funcionando; pgTAP habilitado.
- Arnés de pruebas: Vitest + Testing Library (`test:unit`), integración con Supabase local + pgTAP (`test:integration`), Playwright (`test:e2e`), con al menos una prueba mínima por nivel que pasa.
- OpenSpec ya inicializado; se completa `openspec/project.md` con las convenciones no negociables de ARCHITECTURE.md.
- Graphify: grafo generado, gancho `post-commit` configurado y `graphify-out/` versionado.
- CI en GitHub Actions con la secuencia `lint → typecheck → test:unit → supabase start → test:integration (pgTAP) → build → test:e2e`.

## Capabilities

### New Capabilities

- `project-foundation`: el andamiaje del repositorio como capacidad verificable — la aplicación arranca con tema claro/oscuro funcional, los tres niveles de prueba se ejecutan y pasan, el entorno Supabase local completa sin error, las herramientas de disciplina (OpenSpec, Graphify) están operativas y el pipeline de CI falla cuando el código se rompe.

### Modified Capabilities

_Ninguna. Es el primer cambio del proyecto; no existen specs previas._

## Impact

- **Código afectado:** raíz del repositorio (estructura de carpetas, `package.json`, `tsconfig.json`, configuración de Tailwind/shadcn), `app/` (layout raíz con `ThemeProvider` y página vacía), `supabase/` (inicialización local), `tests/`, `.github/workflows/ci.yml`, `openspec/project.md`, `graphify-out/` y gancho de git.
- **Dependencias nuevas:** shadcn/ui (+ Radix), `next-themes`, Lucide, Vitest, Testing Library, Playwright; Supabase CLI como herramienta local.
- **Sin tablas de negocio ni datos:** las migraciones quedan vacías salvo lo necesario para habilitar pgTAP.
- **Desbloquea:** KAM-02 (autenticación y aislamiento) y todo el resto del backlog.

## Fuera de alcance

_Copiado literalmente del backlog:_

- Cualquier pantalla de producto. Ninguna tabla de negocio. Ningún dato.
