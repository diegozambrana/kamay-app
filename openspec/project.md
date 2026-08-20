# Kamay — Constitución del proyecto

Fuente: `specs/PRD/ARCHITECTURE.md` (autoridad sobre cómo se organiza el código). Los documentos de producto en `specs/PRD/` mandan sobre el qué; `openspec/specs/` manda sobre cómo se verifica; el código no es fuente de verdad de nada.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript `strict` · Supabase (Postgres + Auth + Storage + RLS) vía `@supabase/ssr` · Zustand · Tailwind 4 + shadcn/ui (Radix) + Lucide · react-hook-form + Zod · Vitest + Testing Library · pgTAP · Playwright · alias de importación `@/*` a la raíz · dev en puerto 3010.

## Convenciones no negociables

1. **Arquitectura por capas + rebanadas verticales.** `app/` (páginas delgadas) → `actions/` (Server Actions: sesión, organización, rol, Zod, `revalidatePath`) → `services/` (todo acceso a Supabase, clases con `SupabaseClient` inyectado) → `features/` (pantallas, hooks y stores por dominio). Ninguna consulta a Supabase fuera de `services/`; `"use server"` solo en `actions/`.
2. **RLS activo en toda tabla, sin excepción.** Multi-organización vía `organization_id` en toda tabla y toda consulta (aunque RLS ya filtre). El cliente de service role solo en trabajos programados y generación de notificaciones — jamás en una acción disparada por el usuario, jamás en el bundle de cliente.
3. **No existen políticas `DELETE`.** Se archiva con `archived_at`; nunca se borra.
4. **Nada derivado se almacena.** Saldos, totales, costos y márgenes viven en vistas con `security_invoker = true` (obligatorio en toda vista nueva), nunca en columnas ni en stores.
5. **Estados se comparan por `kind`** (`initial | in_progress | waiting | final | cancelled`), nunca por nombre: los nombres son configurables por organización y por línea.
6. **Migraciones solo como archivos nuevos** `YYYYMMDDHHMMSS_<nombre>.sql` en `supabase/migrations/`, cada una con su prueba pgTAP. Nunca editar una migración existente. Regenerar el grafo (`graphify .`) tras cualquier cambio de esquema.
7. **Un solo historial:** todo lo que muestre "qué pasó aquí" lee de `activity_log` (trigger genérico `log_activity()`, inmutable para `authenticated`).
8. **Idioma:** identificadores, rutas, tablas y mensajes de desarrollador en inglés; texto visible al usuario y documentación de producto en español.
9. **UUID generables en el cliente** como llave primaria (requisito del modo sin conexión); `occurred_at` lo fija el cliente, `created_at` el servidor.
10. **Tareas y pedidos no se sincronizan.** Un pedido nunca genera una tarea automáticamente; la única vía es la acción explícita del usuario.
11. **Ningún concepto nuevo** que no esté en el modelo conceptual de la especificación funcional: si hace falta uno, primero se escribe allí.
12. **Ningún cambio sin OpenSpec.** Toda funcionalidad entra por `openspec/changes/<id>/` (propuesta revisada con "fuera de alcance" cerrado); cada escenario del delta spec tiene al menos una prueba referenciada en `tasks.md`; el cambio se archiva al consolidarse.

## Pruebas

Tres niveles: unitarias (`*.test.ts(x)` junto al código, `npm run test:unit`), integración (pgTAP en `supabase/tests/` vía `supabase test db` + `tests/integration/`), e2e (Playwright en `tests/e2e/`). Ninguna migración se fusiona sin su prueba pgTAP. Toda prueba crea su propia organización. Cobertura mínima 90 % en `lib/` y `services/`. CI: `lint → typecheck → test:unit → supabase start → test:integration → build → test:e2e`.
