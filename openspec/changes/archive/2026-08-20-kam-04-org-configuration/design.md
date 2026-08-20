# KAM-04 · Diseño — Configuración de la organización y semilla

## Context

Existen `organizations` y `memberships` (`20260820100000_tenants.sql`) con RLS, `is_member()`/`is_owner()` y sin políticas `DELETE`, y la bitácora con su trigger genérico (`20260820120000_activity_log.sql`) más el procedimiento de `supabase/README.md`: **toda tabla auditable adjunta el trigger `audit` en su propia migración de creación**. El layout `(app)` ya resuelve la organización activa desde la cookie `kamay-org` (`constants/auth.ts`, `lib/auth/post-auth.ts`) e hidrata `UserProvider`/`OrganizationProvider`; la barra superior existe con navegación vacía. En local, `[auth] enable_signup = false` pero `[auth.email] enable_signup = true` y `enable_confirmations = false`: un alta por correo devuelve sesión de inmediato.

Motivación: ver `proposal.md` — Why. Requisitos: ver los delta specs `org-configuration`, `business-line-context`, `user-management` y `user-auth`.

## Goals / Non-Goals

**Goals:**
- Que las cuatro tablas de configuración queden con su RLS, su auditoría y sus invariantes garantizados **en la base de datos**, no en el código de aplicación.
- Que la línea activa sea contexto resuelto en el servidor: ninguna pantalla se renderiza primero sin línea y luego con ella.
- Que invitar a alguien no exija en ningún momento el cliente de service role (convención nº 2).
- Que las cuatro rebanadas de configuración compartan una sola implementación en vez de cuatro CRUD copiados.

**Non-Goals:**
- Envío de correo desde la aplicación: no hay SMTP configurado y las notificaciones son KAM-17. El enlace de invitación se entrega fuera de banda (D7).
- Restringir ayudantes por línea (`memberships_lines` del §16 del esquema): ningún criterio lo pide y añadiría un concepto nuevo.
- Reordenar líneas y canales por arrastre: `position` existe en el esquema y se llena al crear; la reordenación interactiva no está en los criterios.

## Decisions

### D1 · Dos migraciones nuevas, no una

`..._configuration.sql` (las cuatro tablas, índices, invariante de línea compartida, triggers `audit`, RLS y grants) y `..._invitations.sql` (tabla, `accept_invitation()`, guardia del último dueño, RLS y grants). Se separan porque son dos superficies de seguridad distintas y porque KAM-05 y KAM-06 dependen solo de la primera: si la segunda hubiera que revisarla, la configuración ya está firme. Alternativa descartada: una sola migración "003_configuration" como en el orden canónico §18 — este proyecto crea tablas por tarea, no por el orden del documento, y el propio §18 ya se desvió al instalar la bitácora en KAM-03.

Igual que en KAM-03, la RLS viaja **en la misma migración que la tabla** en vez de esperar a la "014_rls_policies" del canónico: el criterio 4 de KAM-04 es un requisito de permisos, no puede quedar pendiente. La revisión global de RLS sigue en KAM-23.

### D2 · El invariante de la línea compartida se garantiza con índice + trigger

- **Como máximo una activa:** `create unique index on business_lines (organization_id) where is_shared and archived_at is null`.
- **No archivable ni mutable:** trigger `before update` que lanza excepción si `old.is_shared` y `new.archived_at is not null`, y si `new.is_shared is distinct from old.is_shared` (la bandera es inmutable después de crear).
- **Al menos una:** la semilla y toda organización nueva crean su línea General/Compartido. No se fuerza con una restricción diferida — una organización recién insertada no puede tener aún su línea, y una restricción diferida obligaría a envolver cada alta en una transacción explícita.

Alternativa descartada: validar en la Server Action. Una regla que protege datos históricos no puede vivir donde un script de mantenimiento la evita.

### D3 · RLS de configuración: lectura de miembro, escritura de dueño, más grants explícitos

Patrón idéntico en las cuatro tablas: `select` con `is_member(organization_id)`, `insert`/`update` con `is_owner(organization_id)`, sin política `DELETE`. Como ya se descubrió en KAM-02 y KAM-03, las imágenes recientes de Supabase no conceden DML por defecto en `public`: hay que añadir `grant select, insert, update on <tabla> to authenticated` y `grant select on <tabla> to service_role`. No se concede `delete` a nadie, de modo que la prohibición está en el privilegio **y** en la ausencia de política.

### D4 · La línea activa viaja en una cookie por organización, fijada desde una Server Action

Cookie `kamay-line-<organizationId>` con el uuid de la línea o el literal `all`, `httpOnly`, `sameSite: lax`, `path: /`, `maxAge` de un año — mismos atributos y misma constante de duración que `kamay-org`, cuyo helper ya existe en `lib/auth/post-auth.ts`. Se fija desde `actions/business-line-context.ts`, que además llama a `revalidatePath("/", "layout")` para que los Server Components vuelvan a renderizar con la nueva línea.

Por qué la cookie y no `localStorage`: el layout debe conocer la línea **antes** del primer render (requisito "resolved on the server before the first render"); `localStorage` solo existe en el cliente y produciría un render inicial sin contexto. Por qué `httpOnly` y no escritura desde el cliente: obliga a pasar por la acción, que es también el único punto que revalida; una cookie escrita en el cliente dejaría el servidor renderizando con el valor viejo.

Por qué una cookie **por organización** y no un mapa JSON en una sola: el escenario "cada organización conserva su propia selección" se cumple sin parsear ni migrar formato, y borrar la cookie de una organización no toca las demás.

### D5 · Resolución y saneamiento en el layout de `(app)`

`app/(app)/layout.tsx` ya carga la organización activa; se le añade la carga de las líneas activas (`BusinessLineService.listActive`) y la resolución de la línea:

```
resolveActiveLine(cookieValue, activeLines) → { id: string, ... } | "all"
```

Si la cookie está ausente, vale `all`, apunta a una línea archivada o a una que no pertenece a la organización, el resultado es `all`. **La cookie obsoleta no se reescribe durante el render**: Next.js no permite fijar cookies en el render de un Server Component; queda ignorada y se sobrescribe la próxima vez que el usuario elija una línea. Por eso el escenario del spec dice "ignora el valor obsoleto", no "lo reemplaza".

Un `BusinessLineProvider` hidrata `stores/business-line-store.ts` con `{ lines, activeLineId }` igual que hace hoy `OrganizationProvider`, para que el selector y los formularios lean del store sin volver a consultar.

### D6 · Una sola implementación para las cuatro tablas de configuración

Las cuatro comparten forma (`organization_id`, nombre, `archived_at`, único por organización) y las cuatro operaciones: listar activas, crear, renombrar, archivar/desarchivar. Se implementa `services/configuration/config-table-service.ts` con la tabla y el mapeo de columnas inyectados, y cuatro subclases delgadas (`BusinessLineService` añade `color`, `icon`, `is_shared`, `position`; `UnitService` usa `code` como clave visible). Los esquemas Zod y las Server Actions sí son cuatro, uno por entidad, porque los campos y los mensajes al usuario difieren.

Alternativa descartada: cuatro servicios independientes copiados — cuatro sitios donde olvidar el filtro `archived_at is null` o el `organization_id` explícito que exige la convención nº 2.

### D7 · Invitación: token con hash en la base, enlace entregado fuera de banda

Tabla `invitations` con `token_hash` (sha256 vía `pgcrypto`), no el token en claro. La acción `createInvitation` genera el token en el servidor, guarda su hash y **devuelve el enlace una sola vez** para que el dueño lo copie y lo envíe por su medio habitual (WhatsApp, en la práctica de Geeko Store). No hay envío de correo: no hay SMTP configurado y las notificaciones son KAM-17; inventar un envío aquí sería alcance que nadie pidió.

Aceptación: `/auth/invite/<token>`. Si no hay sesión, la página ofrece crear la cuenta con el correo invitado precargado (`supabase.auth.signUp`, clave anónima — permitido, `[auth.email] enable_signup = true`); con sesión ya establecida, llama directamente a la acción de aceptar.

`accept_invitation(p_token text)` es `security definer` con `set search_path = public` y hace, en una sola transacción: buscar por `digest(p_token,'sha256')`, verificar `archived_at is null`, `accepted_at is null`, `expires_at > now()` y `lower(email) = lower(auth.email())`; insertar la membresía (o desarchivar la existente); marcar `accepted_at`. Devuelve el `organization_id` para redirigir. Cualquier fallo lanza excepción con mensaje genérico — **la misma respuesta para token inexistente, caducado o ajeno**, para no convertir la ruta en un oráculo de invitaciones válidas.

Por qué `security definer`: el invitado todavía no es miembro, así que ninguna política de `memberships` lo dejaría insertarse a sí mismo, y la alternativa —una política que permita "insertar tu propia membresía si existe una invitación válida"— pondría la lógica de caducidad y de coincidencia de correo dentro de una expresión de RLS, donde no se puede probar por partes ni devolver un error legible.

Alternativa descartada: `auth.admin.inviteUserByEmail` con service role (rompe la convención nº 2 en una acción disparada por el usuario, decisión confirmada con el usuario al proponer el cambio).

**Concepto nuevo:** `invitations` no está en `specs/PRD/kamay-esquema-base-de-datos-supabase.md`. La convención nº 11 exige incorporarlo al modelo antes de implementarlo, así que la primera tarea del cambio es anotarlo en §6 del esquema canónico.

### D8 · Guardia del último dueño en la base

Trigger `before update on memberships`: si el `UPDATE` fija `archived_at` sobre una membresía `owner` y no queda ninguna otra membresía `owner` activa en esa organización, lanza excepción. Vive en la base y no en la acción por la misma razón que D2: una organización sin dueño es irrecuperable desde la interfaz. Se limita al archivado, que es lo que pide el spec; la degradación de rol del último dueño no está entre los criterios y no se añade.

### D9 · `/settings` con una ruta por sección

`app/(app)/settings/layout.tsx` verifica el rol (`owner`, leído de la membresía que el layout de `(app)` ya resolvió) y redirige con `defaultLandingPath` si no lo es; `/settings` redirige a `/settings/general`, y cada sección es su propio segmento (`general`, `lines`, `channels`, `categories`, `units`, `members`). Enlaces profundos, y KAM-05 añade `/settings/statuses` (V22) sin tocar lo existente. `PROTECTED_PREFIXES` de `lib/auth/routes.ts` incorpora `/settings`.

La comprobación de rol en el layout es interfaz, no seguridad: la seguridad real es la RLS de D3 y D8: un ayudante que llegara a la página igual no podría escribir nada.

### D10 · El color es un token, no una clase de Tailwind

`color` guarda `blue | violet | orange | zinc | …`. Tailwind 4 no puede generar clases por interpolación, así que `lib/business-lines/colors.ts` mapea cada token a clases literales, con `zinc` como respaldo ante un token desconocido. La lista permitida se valida con un enum de Zod en la acción; **no** se añade un `check` en la base: los colores son presentación y una restricción de base obligaría a una migración cada vez que se sume un color.

### D11 · La semilla añade Geeko Store; no reemplaza las organizaciones de prueba

`supabase/seed.sql` incorpora Geeko Store (uuid fijo) con su dueño, sus cuatro líneas y sus cuatro canales, más un juego mínimo de categorías de gasto y unidades. Las organizaciones `Taller Kamay` y `Kamay Feria` se conservan intactas: las pruebas e2e de KAM-02 dependen de ellas. Las filas de la semilla corren después de las migraciones, de modo que el trigger `audit` ya está activo y sus eventos quedan con `actor_id` nulo — comportamiento correcto para una carga sin sesión.

### D12 · Pruebas

- pgTAP `rls_roles.test.sql` (exigido por el backlog): en las cuatro tablas — ayudante lee y no escribe, dueño escribe, cero filas cruzando organización, `DELETE` rechazado para todos.
- pgTAP `shared_line.test.sql`: segunda línea compartida rechazada, archivado de la compartida rechazado, `is_shared` inmutable.
- pgTAP `invitations.test.sql`: RLS solo-dueño, aceptación válida crea membresía, token reutilizado / caducado / de otro correo rechazados con el mismo error, guardia del último dueño.
- Unitarias: `resolveActiveLine` (cookie ausente, `all`, línea archivada, línea de otra organización, línea válida) y el nombre/serialización de la cookie; mapa de colores con token desconocido.
- e2e `settings.spec.ts`: el dueño crea una línea → aparece en el selector con su color → navega a otra sección → sigue seleccionada; y el ayudante que abre `/settings` termina fuera y sin la entrada en el menú.

## Risks / Trade-offs

- [El enlace de invitación se entrega fuera de banda: si el dueño lo pega en un canal equivocado, cualquiera con el enlace lo abre] → el token caduca, es de un solo uso y `accept_invitation()` exige que el correo de la sesión coincida con el invitado; sin esa cuenta, el enlace no sirve.
- [`[auth.email] enable_signup = true` permite crear cuentas sin invitación] → una cuenta sin membresía es inerte: la RLS no le devuelve una sola fila y el layout de `(app)` ya muestra el estado "sin organización". KAM-23 decidirá si se cierra el alta pública en producción.
- [`invitations` es un concepto ausente del esquema canónico] → se anota en `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §6 antes de escribir la migración (convención nº 11); si esa anotación no se hace, la tarea no está terminada.
- [La cookie de línea es por navegador: quien usa el celular y la computadora tendrá dos selecciones distintas] → es lo que pide el criterio ("vuelve al día siguiente"), y una preferencia en base exigiría una columna que el esquema canónico no contempla. Si más adelante hace falta que siga al usuario, se migra a `memberships` sin cambiar el contrato de `resolveActiveLine`.
- [Una cookie por organización multiplica cookies en usuarios multi-organización] → son dos o tres organizaciones en la práctica y cada cookie pesa ~50 bytes.
- [El servicio genérico de configuración esconde diferencias reales entre las cuatro tablas] → las diferencias que importan (columnas propias, validación, mensajes) quedan en las subclases y en las acciones; el genérico solo aporta el filtro por organización y por `archived_at`.
- [El layout de `(app)` suma una consulta de líneas por navegación] → es una tabla pequeña, filtrada por organización e índice; si llegara a pesar, se memoriza por petición sin cambiar la resolución.

## Migration Plan

1. Anotar `invitations` en el esquema canónico (§6) — requisito de la convención nº 11 antes de tocar SQL.
2. Migración `YYYYMMDDHHMMSS_configuration.sql`: cuatro tablas, índices, invariante de línea compartida, triggers `audit`, RLS y grants.
3. Migración `YYYYMMDDHHMMSS_invitations.sql`: tabla, `accept_invitation()`, guardia del último dueño, RLS y grants.
4. Ampliar `supabase/seed.sql` con Geeko Store; `supabase db reset` y `supabase test db`.
5. Capa de aplicación: servicios → acciones → selector y providers → `/settings`.
6. Regenerar el grafo (`graphify .`) tras las migraciones (convención nº 6).
7. Rollback: migración inversa nueva, nunca editar las existentes. Antes de datos reales el costo es nulo; Geeko Store todavía no ha cargado nada.
