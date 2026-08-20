# Tasks — KAM-01 · Andamiaje del proyecto

> Cada escenario del delta spec (`specs/project-foundation/spec.md`) aparece referenciado por nombre en la tarea que lo verifica.

## 1. Base del proyecto

- [x] 1.1 Leer `node_modules/next/dist/docs/` (layout raíz, configuración, convenciones vigentes de esta versión de Next.js) antes de tocar `app/` — obligación de `AGENTS.md`
- [x] 1.2 Verificar/ajustar `tsconfig.json` (`strict: true`, alias `@/*` a la raíz) y fijar el puerto 3010 en el script `dev`
- [x] 1.3 Añadir los scripts `typecheck`, `test:unit`, `test:integration`, `test:e2e` a `package.json` (aunque apunten a suites vacías al inicio)

## 2. Tema y UI base

- [x] 2.1 Inicializar shadcn/ui con tema neutro y CSS variables; instalar `next-themes` y Lucide
- [x] 2.2 Configurar `app/layout.tsx` con `ThemeProvider` (`attribute="class"`, `suppressHydrationWarning`) y dejar `app/page.tsx` como página vacía con el conmutador de tema
- [x] 2.3 Verificar manualmente el escenario **"Dev server serves the empty shell"** (`npm run dev` sin errores en consola ni en el log)

## 3. Estructura de carpetas

- [x] 3.1 Crear las carpetas de ARCHITECTURE.md con `.gitkeep`: `actions/`, `services/`, `features/`, `components/` (con `components/ui/` de shadcn), `types/`, `lib/`, `constants/`, `configs/`, `hooks/`, `stores/`, `tests/integration/`, `tests/factories/`

## 4. Supabase local

- [x] 4.1 `supabase init` y verificar que `supabase start` completa sin error
- [x] 4.2 Crear la migración `YYYYMMDDHHMMSS_enable_pgtap.sql` (`create extension if not exists pgtap;`) — única migración permitida en este cambio
- [x] 4.3 Verificar el escenario **"Supabase starts and resets cleanly"** (`supabase start` + `supabase db reset` con salida 0)

## 5. Arnés de pruebas

- [x] 5.1 Instalar y configurar Vitest + Testing Library con proyectos separados `unit` (jsdom) e `integration` (node, `tests/integration/`)
- [x] 5.2 Escribir la prueba unitaria mínima (render real de un componente, p. ej. el conmutador de tema) — verifica el escenario **"One passing unit test"**
- [x] 5.3 Escribir `supabase/tests/harness.test.sql` (pgTAP mínimo real) y comprobar `supabase test db` — verifica el escenario **"One passing pgTAP test"**
- [x] 5.4 Escribir una prueba de integración mínima en `tests/integration/` que toque la base local (asegura que `test:integration` levanta y usa Supabase)
- [x] 5.5 Instalar y configurar Playwright (`webServer` en el puerto 3010; `next start` tras `build` en CI)
- [x] 5.6 Escribir la prueba e2e mínima: abrir `/`, alternar el tema y recargar — verifica los escenarios **"One passing end-to-end test"** y **"Theme toggle switches and persists"**
- [x] 5.7 Ejecutar los cinco comandos de calidad en limpio — verifica el escenario **"All quality commands succeed"**

## 6. OpenSpec

- [x] 6.1 Completar `openspec/project.md` con las convenciones no negociables de ARCHITECTURE.md (capas, RLS en todo, sin DELETE, nada derivado se guarda, estados por `kind`, inglés/español, migraciones solo como archivos nuevos con prueba pgTAP) — verifica el escenario **"Conventions are present in project.md"**
- [x] 6.2 Comprobar `openspec view` — verifica el escenario **"OpenSpec reports the initialized project"**

## 7. Graphify

- [x] 7.1 Verificar la instalación de Graphify, regenerar el grafo tras la migración de pgTAP y confirmar que `graphify-out/` está versionado (`git ls-files graphify-out/`) — verifica el escenario **"Graph output is tracked"**
- [x] 7.2 Instalar el gancho con `graphify hook install` y comprobar con un commit real que el grafo se actualiza — verifica el escenario **"Post-commit hook updates the graph"**

## 8. Integración continua

- [x] 8.1 Crear `.github/workflows/ci.yml` con la secuencia `lint → typecheck → test:unit → supabase start → test:integration (pgTAP) → build → test:e2e`, usando `supabase/setup-cli`
- [ ] 8.2 Abrir un pull request de prueba sano y comprobar que el pipeline termina en verde — verifica el escenario **"CI passes on a healthy pull request"**
- [ ] 8.3 En el mismo PR, introducir deliberadamente un error de tipos, comprobar que CI falla en `typecheck` y revertirlo — verifica el escenario **"CI fails on a broken typecheck"**

## 9. Cierre

- [ ] 9.1 Repasar los criterios de aceptación 1–7 de KAM-01 en `specs/PRD/kamay-backlog.md` contra el estado real del repositorio
- [ ] 9.2 Confirmar que no se creó ninguna pantalla de producto, tabla de negocio ni dato (fuera de alcance)
