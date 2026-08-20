# KAM-02 · Tareas

> Cada escenario de los deltas `tenant-isolation` y `user-auth` tiene su prueba referenciada en los grupos 2 y 7.

## 1. Base de datos: modelo de tenant

- [x] 1.1 Crear migración `supabase/migrations/<timestamp>_tenants.sql` con `organizations` y `memberships` (DDL canónico §5: check de rol, unique `(organization_id, user_id)`, `archived_at`, índice parcial por `user_id`)
- [x] 1.2 Añadir en la misma migración `is_member(org uuid)` e `is_owner(org uuid)` (`security definer`, `stable`, `set search_path = public`)
- [x] 1.3 Añadir en la misma migración RLS habilitado y políticas: `select` con `is_member`, `insert`/`update` con `is_owner`, **sin política `delete`** (D2)
- [x] 1.4 Verificar `supabase db reset` en verde

## 2. Pruebas pgTAP (deltas `tenant-isolation`)

- [x] 2.1 `supabase/tests/rls_isolation.test.sql` — helpers para crear usuarios en `auth.users` y simular sesión (`role authenticated` + `request.jwt.claims`)
- [x] 2.2 En `rls_isolation`: escenarios "Cross-organization reads return zero rows" y "Cross-organization writes are rejected"
- [x] 2.3 En `rls_isolation`: escenarios de funciones — "Active member is recognized", "Archived membership grants nothing", "Assistant is not owner"
- [x] 2.4 En `rls_isolation`: escenarios de modelo — "Membership roles are constrained", "A user cannot be member of the same organization twice"
- [x] 2.5 En `rls_isolation`: escenarios de escritura — "Assistant cannot modify the organization", "Owner can manage memberships"
- [x] 2.6 `supabase/tests/no_delete.test.sql` — escenario "DELETE affects zero rows" sobre ambas tablas, incluido como dueño
- [x] 2.7 `supabase test db` en verde

## 3. Clientes Supabase y middleware

- [x] 3.1 Mover `@supabase/supabase-js` a `dependencies` y añadir `@supabase/ssr`; variables de entorno en `.env.local` y `.env.example`
- [x] 3.2 Crear `lib/supabase/server.ts`, `client.ts`, `admin.ts` (solo servidor) y `proxy.ts`
- [x] 3.3 Crear `middleware.ts`: refresco de sesión por petición y redirección de rutas `(app)` sin sesión a `/auth/login?next=<ruta>` (validación anti open-redirect, D4)
- [x] 3.4 Pruebas unitarias de la validación de `next` y del matcher del middleware (`lib/` requiere ≥90 % de cobertura)

## 4. Pantallas de autenticación (V1)

- [x] 4.1 Deshabilitar registro público (`enable_signup = false` en `supabase/config.toml`) y crear `supabase/seed.sql` con organizaciones y usuarios de desarrollo/prueba (D7)
- [x] 4.2 `app/auth/login`: formulario correo + contraseña (react-hook-form + Zod), errores en español, enlace "¿Olvidaste tu contraseña?", sin opción de registro
- [x] 4.3 `app/auth/forgot-password` y `app/auth/reset-password`; route handlers `auth/confirm` y `auth/callback` (D8)
- [x] 4.4 `app/auth/select-org`: lista de organizaciones activas del usuario, fija la cookie `kamay-org` (D6)
- [x] 4.5 Redirección tras login: `next` válido → esa ruta; si no, `/dashboard` o `/quick` según user-agent (D5); selección de organización intercalada cuando hay más de una

## 5. Cascarón autenticado

- [x] 5.1 Layout del grupo `(app)` con `AuthCheck`: carga usuario + membresías, revalida cookie `kamay-org` (inválida ⇒ borrar y reelegir), redirige a login sin sesión
- [x] 5.2 `providers/UserProvider.tsx` y `providers/OrganizationProvider.tsx`; `stores/user-store.ts` y `stores/organization-store.ts` (Zustand) hidratados desde el servidor
- [x] 5.3 `components/layout/`: barra superior (escritorio) y barra inferior (móvil) con navegación vacía, presentes en todo `(app)`
- [x] 5.4 Páginas cascarón `app/(app)/dashboard/page.tsx` y `app/(app)/quick/page.tsx`
- [x] 5.5 Pruebas unitarias de stores y providers

## 6. Pruebas e2e (delta `user-auth`)

- [x] 6.1 Setup e2e: usuarios/organizaciones semilla vía cliente admin; proyectos Playwright desktop y mobile
- [x] 6.2 `tests/e2e/auth.spec.ts` — "Anonymous visitor is redirected" y "No public sign-up exists"
- [x] 6.3 — "Desktop lands on the dashboard" / "Mobile lands on quick capture" y escenarios del cascarón ("Desktop shell shows the top bar", "Mobile shell shows the bottom bar")
- [x] 6.4 — "Multi-organization user selects before continuing" y "Single-organization user skips selection"
- [x] 6.5 — "User recovers access" (captura del correo en el servidor de pruebas de Supabase)
- [x] 6.6 — "Active session stays alive" y expiración: "Original destination is restored after login" (invalidar cookie, D expiración)

## 7. Cierre

- [x] 7.1 Suite completa local en verde: `lint → typecheck → test:unit → test:integration → build → test:e2e`
- [x] 7.2 Regenerar el grafo (`graphify .`) tras el cambio de esquema (convención 6)
- [x] 7.3 `openspec validate --strict` del cambio en verde
