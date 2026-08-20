# KAM-02 · Autenticación, organizaciones y aislamiento

> Origen: `specs/PRD/kamay-backlog.md` — tarea **KAM-02**, Fase 0. Depende de KAM-01 (andamiaje, ya archivado). Vistas: V1.

## Why

Kamay es multi-organización desde su primera fila de datos: todo el backlog posterior (bitácora, pedidos, egresos, tareas) presupone que un usuario autenticado pertenece a una organización y que es **imposible** —verificado por prueba pgTAP— ver datos de otra. Instalar la identidad y el aislamiento antes de crear cualquier tabla de negocio evita reconstruir seguridad hacia atrás, que es exactamente el error que este proyecto se propuso no repetir.

## What Changes

- Migración con las tablas `organizations` y `memberships` (DDL canónico de `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §5) y las funciones auxiliares `is_member()` e `is_owner()` (`security definer`, base de todas las políticas futuras).
- RLS activo en ambas tablas con el patrón de políticas de ARCHITECTURE.md §16, **sin política `DELETE`** (la ausencia es deliberada: lo que no tiene política está prohibido).
- Clientes Supabase en `lib/supabase/` (`server.ts`, `client.ts`, `admin.ts`, `proxy.ts`) según ARCHITECTURE.md.
- `middleware.ts` con refresco de sesión en cada petición vía `proxy.ts` y bloqueo del grupo `(app)` sin sesión, preservando la ruta de destino para volver a ella tras entrar.
- Pantallas `app/auth/*`: inicio de sesión (V1), recuperación de contraseña y selección de organización cuando el usuario pertenece a más de una; manejadores `auth/callback` y `auth/confirm`.
- Redirección tras entrar: `/dashboard` en escritorio, `/quick` en móvil (ambas como páginas cascarón).
- `UserProvider` y `OrganizationProvider` en `providers/`; `UserStore` y `OrganizationStore` en `stores/` (Zustand).
- Cascarón de layout del grupo `(app)`: barra superior de escritorio y barra inferior móvil, con navegación vacía.
- Pruebas: pgTAP `rls_isolation` y `no_delete`; e2e `auth.spec.ts` completo, incluida la expiración de sesión.

## Capabilities

### New Capabilities

- `tenant-isolation`: el modelo de identidad multi-organización como capacidad verificable — tablas `organizations` y `memberships`, funciones `is_member()`/`is_owner()`, RLS activo con el patrón estándar, cero filas de otra organización en cualquier consulta y ausencia total de `DELETE` para usuarios autenticados.
- `user-auth`: acceso del usuario a la aplicación — inicio de sesión, recuperación de contraseña, selección de organización, refresco de sesión por petición, protección del grupo `(app)` con retorno a la ruta original, contextos de usuario/organización y cascarón de navegación.

### Modified Capabilities

_Ninguna. `project-foundation` no cambia sus requisitos; este cambio construye sobre él._

## Impact

- **Código afectado:** `supabase/migrations/` (primera migración de negocio + pruebas pgTAP en `supabase/tests/`), `lib/supabase/`, `middleware.ts`, `app/auth/*`, `app/(app)/` (layout con `AuthCheck`, páginas cascarón `/dashboard` y `/quick`), `providers/`, `stores/`, `components/layout/`, `tests/e2e/auth.spec.ts`.
- **Dependencias nuevas:** `@supabase/ssr` y `@supabase/supabase-js` (si no quedaron instaladas en KAM-01).
- **Variables de entorno:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Desbloquea:** KAM-03 (bitácora) y toda tabla de negocio posterior, que reutilizará `is_member()`/`is_owner()` y el patrón de políticas aquí establecido.

## Fuera de alcance

_Copiado literalmente del backlog:_

- Registro público de usuarios (las cuentas se crean por invitación).
- Gestión de usuarios y roles desde la interfaz (llega en KAM-04).
- Inicio de sesión con redes sociales.
