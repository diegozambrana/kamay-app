# KAM-04 · Tareas — Configuración de la organización y semilla

## 1. Modelo conceptual

- [x] 1.1 Anotar `invitations` en `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §6 (columnas, único parcial por `(organization_id, email)` pendiente, y la función `accept_invitation()`), y mencionarla en la matriz de acceso de §16 como tabla de dueño. Requisito de la convención nº 11 antes de escribir SQL (design D7).

## 2. Migración de configuración

- [x] 2.1 Crear `supabase/migrations/YYYYMMDDHHMMSS_configuration.sql` con las cuatro tablas del esquema canónico §6 —`business_lines`, `sales_channels`, `expense_categories`, `units`— con sus columnas, sus únicos por organización y `archived_at`. (Spec: "Configuration tables exist with the canonical shape")
- [x] 2.2 En la misma migración, añadir el invariante de la línea compartida: índice único parcial `(organization_id) where is_shared and archived_at is null` y trigger `before update` que rechaza archivar la línea compartida y rechaza cambiar `is_shared` (design D2). (Spec: "Exactly one shared business line exists and cannot be archived")
- [x] 2.3 En la misma migración, adjuntar el trigger `audit` a las cuatro tablas, según el procedimiento de `supabase/README.md`. (Spec: escenarios "Creating a configuration row is logged" y "Archiving is logged as archived")
- [x] 2.4 En la misma migración, habilitar RLS en las cuatro tablas con `select` = `is_member`, `insert`/`update` = `is_owner`, sin política `DELETE`, más los grants explícitos (`select, insert, update` a `authenticated`; `select` a `service_role`; ningún `delete`) (design D3). (Spec: "Only the owner writes configuration; every member reads it")
- [x] 2.5 Escribir `supabase/tests/rls_roles.test.sql`: ayudante lee y no escribe en las cuatro tablas, dueño escribe, cero filas cruzando organización, `DELETE` rechazado para todos. Usar `pg_temp.login()`/`logout()` y organización propia. (Spec: los cuatro escenarios de "Only the owner writes configuration…")
- [x] 2.6 Escribir `supabase/tests/shared_line.test.sql`: segunda línea compartida rechazada, archivado de la compartida rechazado, `is_shared` inmutable, y nombre duplicado en la misma organización rechazado pero permitido en otra. (Spec: "Exactly one shared business line…", escenarios de unicidad de "Configuration tables exist…")
- [x] 2.7 Ejecutar `supabase db reset` y `supabase test db`; confirmar que las suites nuevas y las existentes pasan.

## 3. Migración de invitaciones y membresías

- [x] 3.1 Crear `supabase/migrations/YYYYMMDDHHMMSS_invitations.sql` con la tabla `invitations` (`organization_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at`, `invited_by`, `created_at`, `archived_at`), su único parcial de invitación pendiente por `(organization_id, email)` y el trigger `audit`. (Spec: "Invitations are stored per organization with a single-use token")
- [x] 3.2 En la misma migración, RLS de `invitations`: `select`/`insert`/`update` solo `is_owner(organization_id)`, sin política `DELETE`, más los grants explícitos. (Spec: "Only the owner manages invitations…")
- [x] 3.3 En la misma migración, crear `accept_invitation(p_token text)` `security definer` con `set search_path = public`: busca por `digest(p_token,'sha256')`, valida no archivada / no aceptada / no caducada / correo coincidente con `auth.email()`, crea o desarchiva la membresía, marca `accepted_at` y devuelve el `organization_id`; error genérico idéntico para todos los fallos (design D7). Conceder `execute` a `authenticated`. (Spec: "Accepting a valid invitation creates the membership")
- [x] 3.4 En la misma migración, añadir el trigger `before update on memberships` que rechaza archivar la última membresía `owner` activa de la organización (design D8). (Spec: escenario "The last active owner cannot be archived")
- [x] 3.5 Escribir `supabase/tests/invitations.test.sql`: ayudante no lee ni crea invitaciones, cero filas cruzando organización, revocar archiva sin borrar, aceptación válida crea membresía activa con el rol invitado, token reusado / caducado / de otro correo rechazados con el mismo error, `DELETE` rechazado, y guardia del último dueño. (Spec: todos los escenarios de `user-management` verificables en base)
- [x] 3.6 Ejecutar `supabase db reset` y `supabase test db`.

## 4. Semilla de Geeko Store

- [x] 4.1 Ampliar `supabase/seed.sql` con la organización Geeko Store (uuid fijo), su membresía de dueño, sus cuatro líneas —Sublimación `blue`, Impresión 3D `violet`, Alfarería `orange`, General `zinc` con `is_shared = true`— y sus cuatro canales (Feria, Redes, Pedido directo, Mostrador), sin tocar `Taller Kamay` ni `Kamay Feria` (design D11). (Spec: "Geeko Store is seeded with its real lines and channels")
- [x] 4.2 Añadir a la semilla un juego mínimo de categorías de gasto y unidades para Geeko Store, y verificar tras `supabase db reset` que existen las cuatro líneas con sus colores, los cuatro canales y que las organizaciones de prueba siguen con sus membresías. (Spec: ambos escenarios de "Geeko Store is seeded…")

## 5. Servicios y tipos

- [x] 5.1 Añadir a `types/index.ts` los tipos `BusinessLine`, `SalesChannel`, `ExpenseCategory`, `Unit` e `Invitation`, con el mapeo de snake_case a camelCase que ya usa `MembershipService`.
- [x] 5.2 Crear `services/configuration/config-table-service.ts`: base con tabla y mapeo inyectados y las operaciones listar activas, crear, renombrar y archivar/desarchivar, siempre filtrando por `organization_id` explícito y `archived_at is null` (design D6).
- [x] 5.3 Crear las cuatro subclases delgadas (`BusinessLineService` con `color`, `icon`, `is_shared`, `position`; `SalesChannelService`; `ExpenseCategoryService`; `UnitService` con `code`) y sus pruebas unitarias con cliente de Supabase simulado.
- [x] 5.4 Crear `services/organization-service.ts` (leer y actualizar `name`, `currency`, `timezone`, `logo_path`). (Spec: "General settings of the organization are editable")
- [x] 5.5 Crear `services/invitation-service.ts`: listar pendientes, crear con `token_hash`, revocar (archivar), invocar `accept_invitation`, cambiar rol y archivar membresía. (Spec: `user-management`)

## 6. Contexto de línea

- [x] 6.1 Añadir a `constants/auth.ts` (o `constants/business-lines.ts`) el nombre de cookie `kamay-line-<organizationId>` y reutilizar la constante de duración de un año (design D4).
- [x] 6.2 Crear `lib/business-lines/active-line.ts` con `resolveActiveLine(cookieValue, activeLines)` y su prueba unitaria: cookie ausente, `all`, línea archivada, línea de otra organización, línea válida. (Spec: "The active line is resolved on the server before the first render", escenario "A selection pointing at an archived or foreign line is discarded")
- [x] 6.3 Crear `lib/business-lines/colors.ts` con el mapa token → clases literales de Tailwind y respaldo `zinc`, más su prueba unitaria con un token desconocido (design D10).
- [x] 6.4 Crear `stores/business-line-store.ts` (`lines`, `activeLineId`, `setActiveLine`) y su prueba unitaria, siguiendo el patrón de `stores/organization-store.ts`.
- [x] 6.5 Crear `components/providers/business-line-provider.tsx` que hidrata el store desde el servidor, siguiendo el patrón de `OrganizationProvider`.
- [x] 6.6 Crear `actions/business-line-context.ts` con la acción que fija la cookie (`httpOnly`, `sameSite: lax`, un año) y llama a `revalidatePath("/", "layout")` (design D4). (Spec: "The selection survives the end of the session")
- [x] 6.7 Cargar las líneas activas y resolver la línea en `app/(app)/layout.tsx`, envolviendo la interfaz con `BusinessLineProvider` (design D5). (Spec: "The active line is resolved on the server before the first render")
- [x] 6.8 Crear `features/business-lines/line-selector.tsx` (opción "Todas" + líneas activas con su color) y montarlo en `components/layout/header.tsx`. (Spec: "The shell offers a global business line selector"; `user-auth` MODIFIED)

## 7. Pantalla de configuración

- [x] 7.1 Añadir `/settings` a `PROTECTED_PREFIXES` en `lib/auth/routes.ts` y actualizar su prueba unitaria.
- [x] 7.2 Crear `app/(app)/settings/layout.tsx` con la guardia de rol (dueño; si no, redirección con `defaultLandingPath`) y la navegación de secciones; `app/(app)/settings/page.tsx` redirige a `/settings/general` (design D9). (Spec: escenarios "Owner opens settings" y "Assistant is redirected from settings")
- [x] 7.3 Filtrar por rol las entradas de menú del `Header` para que la entrada de `/settings` no exista para el ayudante, no aparezca deshabilitada. (Spec: `user-auth` MODIFIED, escenarios de entradas por rol; `org-configuration`, "Settings is absent from the assistant menu")
- [x] 7.4 Crear `actions/configuration.ts` con las acciones de crear, renombrar y archivar/desarchivar de las cuatro entidades: sesión, organización, rol, validación Zod (incluido el enum de colores) y `revalidatePath`.
- [x] 7.5 Crear `features/settings/` con la sección General (nombre, moneda, zona horaria, logo) y su ruta `settings/general`. (Spec: "General settings of the organization are editable")
- [x] 7.6 Crear las secciones Líneas de negocio, Canales, Categorías y Unidades con sus rutas: listar activas y archivadas, crear, renombrar y archivar; la línea compartida se lista sin control de archivar (design D2). (Spec: "Archiving hides a line from new work without erasing its history", "A new business line is usable immediately", escenario "The shared line is not offered for archiving in the interface")

## 8. Usuarios y roles

- [x] 8.1 Crear `actions/members.ts`: invitar (genera el token, guarda el hash y devuelve el enlace una sola vez), revocar invitación, cambiar rol y archivar membresía — todas con guardia de dueño y `revalidatePath` (design D7). (Spec: "Inviting a user never requires elevated privileges", "The owner changes the role…", "The owner archives a membership…")
- [x] 8.2 Crear la sección Usuarios y roles (`settings/members`): membresías activas con su rol, invitaciones pendientes con su caducidad, y el enlace de invitación mostrado una sola vez tras crearla.
- [x] 8.3 Crear `app/auth/invite/[token]/page.tsx`: con sesión, acepta la invitación; sin sesión, ofrece el alta con el correo invitado precargado y acepta al quedar la sesión establecida (design D7). (Spec: "Accepting a valid invitation creates the membership")
- [x] 8.4 Verificar que los cuatro rechazos de aceptación (token reusado, caducado, revocado, correo distinto) muestran el mismo mensaje genérico y no crean membresía.

## 9. Verificación y cierre

- [x] 9.1 Escribir `tests/e2e/settings.spec.ts`: el dueño crea una línea → aparece en el selector con su color → navega a otra sección → la selección se conserva; cerrar sesión y volver a entrar conserva la línea. (Spec: "A new business line is usable immediately", "The selection survives navigation between sections", "The selection survives the end of the session")
- [x] 9.2 Ampliar `tests/e2e/settings.spec.ts` con el ayudante: `/settings` por dirección directa lo deja fuera y la entrada no está en su menú. (Spec: escenarios "Assistant is redirected from settings" y "Settings is absent from the assistant menu")
- [ ] 9.3 Correr `npm run lint`, `npm run typecheck`, `npm run test:unit`, `supabase test db`, `npm run test:integration`, `npm run build` y `npm run test:e2e`; confirmar la cobertura mínima de 90 % en `lib/` y `services/`.
- [x] 9.4 Regenerar el grafo de conocimiento (`graphify .`) tras las migraciones (convención nº 6).
- [x] 9.5 Repasar el checklist de "Definición de terminado" del backlog para KAM-04 —incluida la anotación de `invitations` en el modelo conceptual— y dejar el cambio listo para archivar con `openspec archive`.

## Notas de cierre

Dos puntos quedaron abiertos al repasar la "Definición de terminado"; ninguno
tiene solución dentro del alcance de KAM-04:

1. **Cobertura del 90 % sin verificar.** El proyecto declara la regla en
   `openspec/project.md` pero no tiene instalada ninguna herramienta de
   cobertura (`@vitest/coverage-v8` falta) ni umbral configurado en
   `vitest.config.ts`, y la tubería de CI tampoco la ejecuta. Todo el código
   nuevo de `lib/` y `services/` lleva pruebas unitarias, pero el porcentaje no
   se pudo medir. Instalar y cablear la herramienta es trabajo de la tubería
   (KAM-01/KAM-23), no de esta tarea.

2. **El escenario "Historical records still show the archived line" todavía no
   se puede probar.** Ninguna tabla referencia `business_lines` hasta KAM-06
   (catálogo) y KAM-07 (pedidos): no existe registro histórico que mostrar. Lo
   que sí quedó verificado es el mecanismo del que depende — archivar conserva
   la fila con su nombre y su color, y nada se borra (`rls_roles.test.sql`,
   `shared_line.test.sql`). La prueba del escenario completo corresponde a la
   primera tarea que cree una tabla con `business_line_id`.
