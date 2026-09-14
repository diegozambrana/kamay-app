## Context

Motivación y alcance en `proposal.md`; comportamiento exigido en `specs/platform-administration`, `specs/tenant-isolation` y `specs/user-auth`. Aquí, solo lo que condiciona el cómo.

- **Todo el acceso pasa por dos funciones.** `is_member(org)` e `is_owner(org)` (`20260820100000_tenants.sql:38-59`, `security definer`) aparecen unas 88 veces en las ~84 políticas del sistema y también en funciones internas: `order_entry.sql` (`if not is_member(v_org)`), `offline_sync.sql:45`, el disparador de `catalog.sql:132` (`if not is_owner(...)`), `record_export`, las RPC de reportes (`security invoker` que llaman a `is_owner`) y las cuatro políticas de Storage (`is_member(primer segmento de la ruta)`). `has_line_access` solo se evalúa en `tasks`, siempre detrás de `is_owner(...) or …`.
- **La organización activa es solo una cookie** (`kamay-org`). La base no sabe cuál es: toda consulta recibe `organization_id` explícito (convención 2).
- **`getSessionContext()`** (`lib/auth/session-context.ts`) devuelve `membership: MembershipWithOrganization` y el control de rol es `context.membership.role === "owner"` (`getOwnerContext`). Hay ~66 lecturas de `.membership` entre `actions/`, `app/`, `features/` y `components/`; el cliente lee `useUserStore(s => s.membership?.role)` en el menú lateral, la barra móvil, el menú de cuenta y el registro rápido.
- **`app/(app)/layout.tsx`** decide: sin membresías → `NoOrganizationNotice`; cookie inválida con varias → `/auth/select-org`; luego carga líneas, insumos y avisos de la organización activa y monta `AppSidebar` + `Header` + `MobileNav` + `RegisterButton`. `app/(fair)/layout.tsx` repite la resolución.
- **Nadie puede crear una organización con su sesión**: la política `INSERT` es `with check (is_owner(id))`, falsa para una fila nueva. Hoy solo la crean la semilla y los ayudantes e2e con el service role, y la configuración inicial la siembra la dueña con su sesión (`tests/e2e/helpers/fresh-org.ts:122-160`): el service role no tiene permiso de escribir en las tablas de configuración.
- **`auth.users` no es legible** por `authenticated`: *Usuarios y roles* muestra solo `display_name` (`types/index.ts:120-128`).
- **Service role**: solo en `app/api/notifications/`, `app/api/activity/retention/` y `services/notifications/`, vigilado por `services/notifications/service-role-boundary.test.ts`. El alta de cuentas está cerrada por el hook `before_user_created` salvo invitación vigente; `auth.admin.createUser` sí pasa (lo usan `createFreshOrganization` y `createAccountWithoutOrganization`).
- **La bitácora ya sabe mostrar un autor que no es miembro**: `log_activity()` (versión vigente en `20260903210000_offline_sync.sql:153`) guarda `actor_id`, y `actorOf()` en `lib/activity/describe.ts:121` pinta el nombre de la membresía si lo resuelve y, si no, `actor_label` (hoy `'sistema'`).
- **No hay `command` ni `popover`** en `components/ui/`; sí `dropdown-menu`, `sheet`, `dialog`, `table`, `select`, `checkbox`, `badge`, `input`.
- **Sesión hermana**: `kam-23-hardening-production` sigue abierta y agrega (no modifica) dos requisitos de `tenant-isolation` —*Every view declares security_invoker* y *The pre-production database checklist…*—. Este cambio modifica otros dos bloques de esa capacidad y no toca aquellos; la excepción de `platform_admins` en el catálogo se exige en la capacidad nueva.

## Goals / Non-Goals

**Goals:**
- Que el super admin herede el acceso de dueño **sin reescribir una sola política** y sin service role en ninguna acción de usuario.
- Que para quien no es super admin nada cambie: la suite de RLS existente pasa sin tocarse, con un super admin presente en la base.
- Un único punto de verdad para "¿es super admin?" (la base) y para "¿con qué rol actúa aquí?" (el contexto de sesión).
- Revocar tiene efecto en la siguiente petición.

**Non-Goals:**
- Un rol intermedio (soporte de solo lectura, super admin por organización).
- Auditoría de nivel plataforma más allá de la propia tabla `platform_admins`.
- Endurecer la cuenta del super admin con MFA (se anota como riesgo).

## Decisions

### D1 · El super admin es un atributo de la cuenta, en una tabla propia

`platform_admins (user_id uuid primary key references auth.users, granted_at timestamptz not null default now(), note text, archived_at timestamptz)`. RLS activo; política `select` `using (user_id = auth.uid())`; `revoke all` de `anon` y `authenticated` salvo ese `select`; `grant select, insert, update` a `service_role` (lo usa el script del operador, D10). Sin política `DELETE` ni disparador de auditoría: la bitácora exige `organization_id` y esta tabla vive por encima de las organizaciones; su historia son `granted_at`, `note` y `archived_at`.

`is_platform_admin()` — `language sql stable security definer set search_path = ''` — devuelve `exists (select 1 from public.platform_admins where user_id = auth.uid() and archived_at is null)`. `grant execute` a `authenticated` (la aplicación la consulta, D6).

`preproduction_checklist.test.sql` suma `platform_admins` a su lista de exclusiones explícitas de "toda tabla tiene `organization_id`", con el motivo escrito al lado, igual que `organizations`.

**Alternativas descartadas:**
- *Rol `platform_admin` en `memberships`*: una membresía exige una organización; justo lo que el super admin no tiene.
- *Claim en `app_metadata` del JWT*: el token vive hasta su renovación (una hora por defecto), así que revocar no surtiría efecto en la siguiente petición, y el claim habría que mantenerlo con un hook `custom_access_token` que hoy no existe.
- *Columna en una tabla de perfiles*: no hay tabla de perfiles, y crearla solo para esto mezcla identidad con autorización.

### D2 · `is_member` e `is_owner` reconocen al super admin; `has_active_membership` conserva la pertenencia estricta

Migración nueva que redefine (`create or replace`, misma firma, mismo `security definer`):

```sql
is_member(org) := exists(membresía activa de auth.uid() en org) or is_platform_admin()
is_owner(org)  := exists(membresía activa con role = 'owner')   or is_platform_admin()
```

y agrega `has_active_membership(org)` con el cuerpo que `is_member` tenía hasta hoy.

**Por qué:** el esquema lo dice de estas funciones —"se escriben una vez y se usan en todas partes"—. Tocar dos funciones cambia de golpe las ~84 políticas, las funciones internas que ya llaman a `is_member`/`is_owner` (alta de pedido, sincronización, disparador del catálogo, reportes, `record_export`) y Storage, y hace que **toda tabla futura** herede el comportamiento sin que nadie tenga que acordarse.

**Alternativa descartada — `or is_platform_admin()` en cada política:** una migración que reescribe ~84 políticas, y una trampa permanente: la tabla número treinta que la olvide deja al super admin ciego ahí sin que ninguna prueba lo note.

**Qué hay que revisar a mano:** todo lugar donde `is_member`/`is_owner` se usó para significar "pertenece" y no "puede". La revisión es una tarea (§ tareas 2) sobre el catálogo de funciones; las conocidas hoy no dependen de la pertenencia estricta, salvo el nuevo uso de D5, que por eso usa `has_active_membership`. `set_my_display_name` no cambia: busca la fila de membresía propia y, sin ella, no actualiza nada.

### D3 · Listar cuentas: una función `security definer` con compuerta, no el service role

`platform_list_users(p_organization_id, p_query, p_without_organization, p_limit, p_user_id)` —todos opcionales— `security definer`, `set search_path = ''`, `raise exception using errcode = 'insufficient_privilege'` si `not public.is_platform_admin()`. Devuelve por cuenta: `user_id`, `email`, `created_at`, `last_sign_in_at`, `is_platform_admin` y `memberships jsonb` (organización, nombre de la organización, rol, `display_name`, `archived_at`). Con `p_organization_id`, solo las cuentas con membresía (activa o archivada) en esa organización: es lo que alimenta la lista de miembros con correo del detalle de organización. `p_query` busca en el correo y en los nombres visibles, `p_without_organization` deja las cuentas sin membresía activa, `p_limit` acota y `p_user_id` trae una sola cuenta. `revoke execute` de `public` y `anon`; `grant` a `authenticated`.

**Listas acotadas (hallazgo de la implementación).** La spec vigente `performance-budget` → *No data view loads an entire table* alcanza también a estas vistas: la base local ya tiene más de 170 organizaciones creadas por las e2e. Por eso la búsqueda, el filtro y el límite se resuelven en la base y viajan en la dirección (`?q=`, `?sin=1`, `?limit=`), con el «Mostrar más» de siempre (`LoadMore`, `resolveLimit`, `takeWindow`). El selector del menú lateral y la lista de asignación del detalle de cuenta usan un tope (`OPEN_WORK_CAP`) y, si hay más, lo dicen y mandan a *Organizaciones*.

**Alternativas descartadas:** el service role en la acción (convención 2); una vista sobre `auth.users` (toda vista es `security_invoker`, y `authenticated` no lee `auth.users`).

### D4 · Crear una organización: una función `security invoker` que siembra lo mínimo en una sola transacción

`create_organization(p_name text, p_currency text, p_timezone text) returns uuid` — `security invoker`. Comprueba `is_platform_admin()` (mensaje claro en lugar de un rechazo de RLS genérico) y, **con la sesión del super admin y bajo RLS**, inserta la organización, su línea compartida *General* (`is_shared = true`, `zinc`, posición 1) y los estados mínimos: pedido *Registrado* (`initial`), *Entregado* (`final`), *Cancelado* (`cancelled`); tarea *Por hacer* (`initial`), *Hecho* (`final`) — el mismo juego que usan hoy los ayudantes e2e. Una llamada RPC es una transacción: si falla un paso no queda organización huérfana.

**Por qué `security invoker`:** con D2, RLS ya permite al super admin cada uno de esos `insert` (`is_owner(id)` es verdadero para él); que la función no tenga privilegios propios mantiene a RLS como la única puerta. Los disparadores de auditoría corren con el super admin como autor, así que la creación queda marcada (D5).

**Alternativa descartada — varias llamadas desde el servicio:** no es atómico; un fallo a mitad deja una organización sin línea compartida, que la spec de `org-configuration` prohíbe.

### D5 · La marca en la bitácora vive en `log_activity()`

Nueva versión de `log_activity()` (partiendo de la de `offline_sync.sql`, que es la vigente) que, antes del `insert`, fija:

```sql
v_label := case when is_platform_admin() and not has_active_membership(v_org)
                then 'Administrador de la plataforma' end;
```

y lo guarda en `actor_label`, con `actor_id` = el super admin como siempre. La fusión de ruido sigue agrupando por `actor_id`, sin cambios.

En la interfaz, `actorOf()` pasa a **preferir la etiqueta cuando el evento tiene autor y etiqueta a la vez**: hoy prefiere el nombre resuelto, y si el super admin se hiciera miembro más tarde, sus eventos viejos perderían la marca. Los eventos con `'sistema'` no tienen `actor_id`, así que no cambian. La cadena vive en SQL y en una constante de `lib/activity/` usada por las pruebas.

**Por qué en el disparador:** es el único lugar por el que pasa todo cambio de toda tabla auditable; marcarlo en la aplicación dejaría fuera lo que se escribe por RPC (alta de pedido, sincronización, `create_organization`).

### D6 · Un "acceso efectivo" reemplaza a `membership.role` como fuente del rol

`getSessionContext()` devuelve:

```ts
{ supabase, userId, organizationId, organization,
  role: Role,                          // 'owner' siempre que platformAdmin
  membership: MembershipWithOrganization | null,  // null si actúa sin membresía
  platformAdmin: boolean }
```

- Resolución de la organización: primero la membresía que coincide con la cookie; si no hay y la cuenta es super admin, la organización de la cookie si existe y no está archivada (leída bajo RLS, que el super admin ya ve); para quien no es super admin, la regla de hoy (una sola membresía sin cookie).
- `getRequestPlatformAdmin()` en `lib/auth/request-user.ts`, envuelta en `cache()` como sus hermanas: una llamada a `rpc('is_platform_admin')` por petición.
- `getOwnerContext()` compara `context.role`. Todas las lecturas de `context.membership.role` pasan a `context.role`; hacer `membership` anulable obliga a `tsc` a señalar cada sitio que la usa, que es precisamente la lista que hay que revisar.
- El cliente: `UserProvider` recibe `role`, `platformAdmin` y `membership | null`; `useUserStore` los expone y los componentes leen `role`, no `membership?.role`.

**Alternativa descartada — sintetizar una membresía falsa** (`{ id: "", role: "owner" }`): menos cambios, pero cualquier código que use `membership.id` (renombrarse, líneas asignadas) operaría sobre una fila que no existe, y el error aparecería lejos de su causa.

### D7 · Rutas de plataforma en un grupo `(platform)` propio, con el cascarón compartido

`app/(platform)/admin/organizations/page.tsx`, `…/organizations/[id]/page.tsx`, `app/(platform)/admin/users/page.tsx`, `…/users/[id]/page.tsx`, bajo `app/(platform)/layout.tsx`.

**Por qué no dentro de `(app)`:** el layout de `(app)` es quien manda al super admin sin organización a `/admin/organizations`; si esas páginas colgaran de él, la redirección se aplicaría a sí misma. Un layout no conoce la ruta que está envolviendo, así que la única salida limpia es otro grupo.

Para no duplicar el cascarón, su composición se extrae de `app/(app)/layout.tsx` a `components/layout/app-shell.tsx` (Server Component): recibe usuario, acceso efectivo y organización (o `null`), carga líneas, insumos y avisos solo si hay organización, y monta los providers, `AppSidebar`, `Header`, `MobileContextBar`, `RegisterButton` y `MobileNav`. Con `organization = null` monta el cascarón reducido que pide la spec: sin selector de línea, campana, registro ni barra de contexto. `(app)/layout.tsx` queda en "resolver acceso → aviso / redirección / `<AppShell>`"; `(platform)/layout.tsx` en "exigir super admin (si no, redirigir al aterrizaje) → `<AppShell>` con la organización activa si la hay".

**El perfil pasa a `app/(account)/profile/`** (hallazgo de la implementación): la spec pide que el super admin abra su perfil también sin organización activa, y bajo `(app)` la redirección a *Organizaciones* lo impedía por la misma razón de arriba. `(account)/layout.tsx` monta `<AppShell>` con la organización si la hay y el cascarón reducido si no; para el resto de cuentas se comporta como `(app)` (aviso sin organización, selección con varias). La URL no cambia.

Cada segmento nuevo lleva su `loading.tsx` y `error.tsx` (`app/route-states.test.tsx` lo exige desde KAM-23). `/admin` entra en `PROTECTED_PREFIXES` (`lib/auth/routes.ts`). El proxy no decide nada de super admin: seguiría costando una consulta por petición, y la doctrina del proyecto es "el proxy bloquea sin sesión, el render verifica".

La creación de organización es un `Dialog` en la lista (no una ruta propia): tres campos, y al terminar navega al detalle.

### D8 · Entrar y salir de una organización: una sola acción

`enterOrganization(organizationId: string | null)` en `actions/auth.ts`: para un super admin acepta cualquier organización existente y no archivada; con `null` borra `kamay-org` y va a `/admin/organizations`; con una organización fija la cookie y redirige al aterrizaje por dispositivo. La usan el selector del menú lateral y el botón "Entrar" de la lista. `selectOrganization` gana la misma rama, y `/auth/select-org` y `resolvePostAuthPath` mandan al super admin sin organización válida a `/admin/organizations`. `(fair)/layout.tsx` usa la misma resolución de acceso efectivo.

El selector (`features/platform/organization-switcher.tsx`) es un `DropdownMenu` con un campo de filtro arriba, la lista de organizaciones activas con la actual marcada y "Vista de plataforma" al final: sin dependencias nuevas (`command`/`popover` no están instalados, y una lista de decenas de organizaciones no necesita más). La lista la carga el cascarón en el servidor solo para el super admin. Va en el `SidebarHeader`, encima del selector de línea; con el menú plegado queda como icono con tooltip. Ya no es cierto que "la organización activa la dice la barra superior" solo para el super admin, y el comentario de `app-sidebar.tsx` se actualiza.

### D9 · El super admin gestiona membresías con RLS, no con privilegios

Con D2, `memberships` e `invitations` ya le permiten `insert`/`update` en cualquier organización. `services/platform/membership-admin-service.ts`:

- `assign(userId, [{ organizationId, role, displayName }])`: por cada organización busca la membresía `(organización, cuenta)`; activa → resultado `already_member`; archivada → `update` de `archived_at = null`, `role` y nombre; inexistente → `insert`. **Resultado por organización**, no todo-o-nada: la spec pide que un duplicado no oculte las demás.
- `setRole`, `setDisplayName`, `archive`, `restore` sobre una membresía: `update` bajo RLS. El disparador `guard_last_owner` sigue protegiendo al último dueño.
- El nombre visible por defecto al asignar es el que la cuenta ya tiene en otra membresía; si no tiene ninguna, la parte local del correo.
- **«Agregar usuario»** (pedido del usuario durante la implementación) es una sola acción, `addUserToOrganization`, y un solo diálogo (`features/platform/users/add-user-dialog.tsx`), en *Usuarios* —se elige la organización— y en el detalle de organización —viene dada—. Busca la cuenta **por su correo** con `platform_list_users(p_query)`, no en una lista de todas las cuentas. Si existe, la agrega (o reactiva, o dice que ya pertenecía); si no, crea la invitación de siempre y devuelve su enlace. Crear la cuenta en ese momento necesitaría el service role en una acción de usuario, que la convención nº 2 prohíbe: la cuenta nace al aceptar la invitación.

Invitar reutiliza `InvitationService.create` y el armado del enlace de `actions/members.ts`; nada nuevo en el flujo de aceptación. Las acciones de plataforma viven en `actions/platform.ts` detrás de `getPlatformAdminContext()` (`lib/auth/session-context.ts`), con Zod y `revalidatePath` como toda acción.

### D12 · Una tabla compartida, adaptada de katu-ui y sin paginar en el cliente

*Organizaciones*, *Usuarios* y el equipo del detalle de organización se muestran con `components/shared/data-table.tsx`, adaptada de `CustomTable` de katu-ui (pedido del usuario): columnas declaradas una vez, un menú «⋯» de acciones por fila (`row-actions-menu.tsx`, adaptado de `TableActionsDropdown`) y, en pantallas chicas, la misma información en tarjetas. Tabla y tarjetas están las dos en el documento y el CSS decide cuál se ve, porque el servidor no sabe el ancho de la pantalla; `display: none` las saca del árbol de accesibilidad.

**Qué no se trajo:** la búsqueda, el orden y la paginación del original, que usan `@tanstack/react-table` en el cliente. Filtrar y paginar en el navegador exige tener la tabla entera ahí, que es lo que la spec `performance-budget` prohíbe; aquí la ventana llega del servidor (`?q=`, `LoadMore`) y la tabla solo la presenta. Sin esa parte, la dependencia tampoco hace falta.

### D10 · El script del operador usa el service role fuera de la aplicación

`scripts/platform-admin.mjs`:
- `grant <email> [--note "…"]`: busca la cuenta; si no existe la crea con `auth.admin.createUser({ email, password, email_confirm: true })`, tomando la contraseña de `PLATFORM_ADMIN_PASSWORD` (nunca de un argumento, para que no quede en el historial de la shell); luego `upsert` en `platform_admins` con `archived_at = null`.
- `revoke <email>`: `archived_at = now()`.
- `list`: las cuentas con fila activa.

Lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno y construye su propio cliente: no importa `lib/supabase/admin.ts`, así que la frontera que vigila `service-role-boundary.test.ts` no se mueve. La regla de `ARCHITECTURE.md` §Supabase se amplía por escrito: "…y en herramientas del operador que corren fuera de la aplicación (`scripts/`)".

**Alternativa descartada — solo SQL por `psql`:** exige la cadena de conexión de producción en la máquina del operador, y crear la cuenta necesita la API de Auth de todos modos.

### D11 · Datos y pruebas

- `supabase/seed.sql`: `superadmin@kamay.test` (contraseña común) con su fila en `platform_admins` y **ninguna** membresía. Como toda la suite pgTAP e integración corre sobre la base sembrada, el escenario "la suite de aislamiento existente pasa sin tocarse con un super admin presente" se cumple por construcción.
- pgTAP nuevos: `platform_admins.test.sql` (tabla, RLS, privilegios, `is_platform_admin`, revocación), `platform_access.test.sql` (`is_member`/`is_owner`/`has_active_membership`, lectura y escritura cruzadas, reglas de dueño que siguen valiendo), `platform_functions.test.sql` (`platform_list_users`, `create_organization`), `platform_activity_mark.test.sql` (marca con y sin membresía).
- e2e nuevo `tests/e2e/platform-admin.spec.ts` con el super admin sembrado; la revocación usa una cuenta propia creada por un ayudante nuevo `createPlatformAdmin()` en `tests/e2e/helpers/fresh-org.ts`, para no revocar a la cuenta compartida mientras otras pruebas la usan. La lista de organizaciones crece con cada `createFreshOrganization()` de la suite, así que las pruebas buscan por nombre, nunca cuentan filas.

## Risks / Trade-offs

- [`is_member`/`is_owner` se evalúan por fila y ahora hacen una segunda consulta cuando no hay membresía] → Es una búsqueda por llave primaria en una tabla de una o dos filas; para los miembros la primera condición ya es verdadera. Se vuelve a medir el presupuesto del panel de KAM-23 (`performance-budget`) con una dueña normal antes de fusionar.
- [Una consulta de `services/` sin filtro de `organization_id` le mostraría al super admin filas de todas las organizaciones mezcladas] → La convención 2 ya exige el filtro; una tarea recorre `services/` buscando consultas a tablas con `organization_id` sin `.eq("organization_id", …)` y las corrige o documenta por qué no lo necesitan (p. ej. las que filtran por `user_id`).
- [Una cuenta super admin comprometida lee y edita todo] → Solo el operador la concede; revocar surte efecto en la siguiente petición; todo lo que hace dentro de una organización queda marcado en su bitácora. MFA para esta cuenta queda fuera de alcance y se anota en `docs/recuperacion.md` como recomendación.
- [La redefinición de `is_member` cambia su significado para cualquier uso futuro que quiera "pertenece"] → Queda escrito en el comentario de la migración y en el esquema §5, y `has_active_membership` existe para ese caso.
- [Cambiar el rol del último dueño a `assistant` no está protegido (`guard_last_owner` solo mira el archivado)] → Brecha preexistente que el super admin también podría pisar; se anota como fuera de alcance, no se agranda.
- [El super admin con registros pendientes de sincronizar cambia de organización] → Cada registro de la cola lleva su `organization_id` y el super admin tiene acceso a todas: se sincroniza en la organización correcta.
- [La cookie `kamay-org` de un super admin revocado apunta a una organización ajena] → La resolución de acceso la ignora (no hay membresía) y cae en la regla normal: su única membresía, la selección o el aviso "sin organización".

## Migration Plan

1. Actualizar los documentos de producto (convención 11) y fusionar la migración con sus pruebas pgTAP.
2. Desplegar la aplicación: sin ningún super admin concedido, el sistema se comporta exactamente como antes.
3. En producción, el operador ejecuta `PLATFORM_ADMIN_PASSWORD=… node scripts/platform-admin.mjs grant <correo>` y comprueba que la cuenta entra y aterriza en *Organizaciones*.

**Reversión:** `revoke` de todas las cuentas deja el comportamiento previo sin tocar código. Si hiciera falta retirar la migración, una migración nueva restaura los cuerpos originales de `is_member`, `is_owner` y `log_activity` (las demás piezas son aditivas y pueden quedarse).
