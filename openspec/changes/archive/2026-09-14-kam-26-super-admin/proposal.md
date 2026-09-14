# KAM-26 · Administrador de la plataforma (super admin)

## Why

Hoy Kamay no tiene a nadie por encima de las organizaciones. Crear un taller nuevo exige insertar filas con el service role desde un script (la política `INSERT` de `organizations` es `is_owner(id)`, imposible para una fila que aún no existe), no hay forma de ver qué cuentas existen ni a qué organización pertenece cada una —`auth.users` no es legible por `authenticated`, así que ni el dueño ve correos—, y cuando alguien queda fuera de su equipo o hay que moverlo entre talleres, la única salida es pedirle a un dueño que lo invite o tocar la base a mano. Con más de un taller en marcha (Geeko Store, Kamay Feria, Kamay Histórico…) hace falta una persona que administre la plataforma entera **sin** convertirse en dueña de cada taller ni saltarse RLS.

## What Changes

- **Nuevo papel: administrador de la plataforma** ("super admin"). Es una propiedad de la **cuenta**, no una membresía: no necesita pertenecer a ninguna organización. Se registra en una tabla nueva `platform_admins` y lo decide una función `is_platform_admin()`.
- **Solo lo concede el operador.** Ninguna pantalla nombra ni retira administradores: un script del operador (`scripts/platform-admin.mjs grant|revoke <email>`) lo hace, y retirar es archivar la fila. Una cuenta super admin comprometida no puede fabricar más.
- **Actúa como dueño en toda organización.** `is_member()` e `is_owner()` —la base de las ~84 políticas del sistema— pasan a devolver verdadero también para un administrador de la plataforma activo. Ninguna política se reescribe y ninguna acción de usuario usa el service role: el acceso sigue pasando por RLS.
- **Vista nueva *Organizaciones*** (`/admin/organizations`): todas las organizaciones con sus dueños y cantidad de miembros; crear una organización (nombre, moneda, zona horaria) que nace con su línea compartida *General* y un juego mínimo de estados; editar sus datos; ver y gestionar su equipo con correos: agregar una cuenta existente con un rol, invitar por correo, cambiar rol, quitar y reactivar el acceso.
- **Vista nueva *Usuarios*** (`/admin/users`): todas las cuentas con su correo, sus organizaciones y rol en cada una, y su último acceso; asignar **una o varias** organizaciones a una cuenta en un solo paso, cambiar el rol o el nombre visible por organización y quitar el acceso.
- **Selector de organización en el menú lateral, solo para el super admin.** Elegir una organización lo pone dentro de ella con la vista de un dueño —todas las demás pantallas (panel, pedidos, egresos, reportes, bitácora, configuración…) funcionan igual que para su dueño—, y una opción *Vista de plataforma* lo saca. El resto de usuarios no ve el selector (el cambio entre organizaciones de un usuario con varias sigue siendo `/auth/select-org`).
- **Sin organización elegida, el super admin no ve el aviso "sin organización"**: aterriza en *Organizaciones* con un cascarón reducido (menú con Organizaciones y Usuarios, selector y menú de cuenta).
- **Queda marcado en la bitácora.** Todo lo que el super admin haga dentro de una organización a la que no pertenece queda en la bitácora de esa organización a su nombre con la marca *Administrador de la plataforma*, para que el dueño sepa que no fue alguien de su equipo.
- **No forma parte del equipo.** No aparece en *Usuarios y roles* de la organización, no se le asignan tareas ni recibe avisos de talleres ajenos.
- **BREAKING (semántica de base de datos):** `is_member(org)` e `is_owner(org)` dejan de significar "tiene membresía activa". Donde se necesite la pertenencia estricta existe `has_active_membership(org)`.

## Capabilities

### New Capabilities

- `platform-administration`: el registro de administradores de la plataforma y cómo se conceden; su acceso de dueño a toda organización a través de las funciones auxiliares; las vistas *Organizaciones* y *Usuarios* (crear y editar organizaciones, listar cuentas, asignar organizaciones, invitar, cambiar rol, quitar y reactivar acceso); el selector de organización del menú lateral; el cascarón sin organización elegida; la marca en la bitácora; el perfil de un super admin y su ausencia del equipo de cada organización.

### Modified Capabilities

- `tenant-isolation`: las funciones auxiliares `is_member`/`is_owner` también reconocen a un administrador de la plataforma activo (y existe `has_active_membership` para la pertenencia estricta); el aislamiento completo entre organizaciones se exige para toda cuenta que no sea administradora de la plataforma.
- `user-auth`: el aterrizaje tras entrar, la selección de organización y el aviso "sin organización" contemplan al administrador de la plataforma (aterriza en *Organizaciones* si no tiene una elegida, no pasa por `/auth/select-org` y nunca ve el aviso).

## Impact

- **Base de datos:** migración nueva con `platform_admins`, `is_platform_admin()`, `has_active_membership()`, nuevas definiciones de `is_member`/`is_owner`, `log_activity()` con la marca del actor, y las funciones `platform_list_users()` y `create_organization()`. Pruebas pgTAP nuevas y una excepción justificada en `preproduction_checklist.test.sql` (la única tabla sin `organization_id` además de `organizations`).
- **Servidor:** `lib/auth/session-context.ts` y `app/(app)/layout.tsx` (rol efectivo y organización activa para el super admin), `lib/auth/post-auth.ts`, `actions/auth.ts` (`selectOrganization`), `app/(fair)/layout.tsx`, `lib/auth/routes.ts` (`/admin` protegido), nuevo grupo de rutas `app/(platform)/admin/…`, `actions/platform.ts`, `services/platform/*`.
- **UI:** `components/layout/app-sidebar.tsx` (selector), `components/layout/nav-entries.ts` (entradas de plataforma), el panel "Más", `features/platform/*`, perfil y bitácora (rótulo del actor).
- **Operación:** `scripts/platform-admin.mjs` (usa el service role **fuera** de la aplicación, como herramienta del operador); `supabase/seed.sql` agrega `superadmin@kamay.test`.
- **Documentos de producto** (convención 11, antes que el código): especificación §3 (nuevo público), esquema §5 y §16 (tabla, funciones, matriz), `ARCHITECTURE.md` (grupo `(platform)` y el script del operador), mapa de navegación (dos vistas nuevas).
- **Sin dependencias nuevas.** Sin cambios en el aislamiento de quien no es super admin: toda prueba de RLS existente debe seguir pasando sin tocarse.
- **Fuera de alcance:** conceder o retirar super admin desde la interfaz; archivar o restaurar organizaciones; cambiar correo o contraseña de otra cuenta, o borrar cuentas; suplantar a un usuario concreto (el super admin ve como dueño, no como una persona específica); enviar la invitación por correo (se sigue mostrando el enlace para copiar, como hoy); selector de organización en móvil (en móvil se cambia desde la vista *Organizaciones*); bitácora de nivel plataforma para las altas y bajas de super admin (la propia tabla guarda cuándo y quién).
