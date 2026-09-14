## Why

Hoy no existe ninguna forma de cerrar sesión: no hay acción `signOut`, ni ruta, ni botón en ningún lugar de la aplicación. Tampoco existe una vista de perfil, así que nadie puede corregir su propio nombre visible ni cambiar su contraseña sin pasar por "olvidé mi contraseña". Quien entra a Kamay queda atrapado en su sesión hasta que la cookie expira sola.

## What Changes

- Se agrega un menú de cuenta con avatar (iniciales) en la esquina superior derecha del `Header` de escritorio, con dos ítems: **Perfil** y **Cerrar sesión**.
- En el celular, donde no hay `Header`, el mismo bloque de cuenta (Perfil / Cerrar sesión) aparece al pie del panel "Más" de la barra inferior.
- Se crea la acción `signOut`: cierra la sesión de Supabase, limpia la cookie de organización activa y redirige a `/auth/login`. Si hay registros pendientes de sincronizar, pide confirmación antes de continuar.
- Se agrega la vista `/profile`: muestra correo, organización y rol (solo lectura) y permite editar el nombre visible de la persona en la organización activa.
- La vista de perfil incluye un botón **Cambiar contraseña** que abre un modal con tres campos — contraseña actual, nueva contraseña, confirmar nueva contraseña — y verifica la contraseña actual antes de aplicar el cambio (Supabase no lo exige por configuración del proyecto).
- Se agrega una función de base de datos `security definer` para que cualquier persona edite su propio `display_name` en `memberships`, sin abrir una política `UPDATE` que permitiera tocar `role` o `archived_at` de su propia fila (la política existente solo lo permite al dueño).

## Capabilities

### New Capabilities

- `account-profile`: la vista de perfil, la edición del nombre visible y el cambio de contraseña con verificación de la contraseña actual.

### Modified Capabilities

- `user-auth`: se agrega el requisito de cierre de sesión y se modifica el requisito del cascarón de aplicación para incluir el menú de cuenta (avatar) en la barra superior y el bloque de cuenta en el panel "Más" del celular.
- `user-management`: se agrega el requisito de que un miembro edite su propio nombre visible, distinto de que el dueño edite el de cualquiera.

## Impact

- Base de datos: migración nueva con la función `set_my_display_name` (`security definer`) y su prueba pgTAP; sin cambios a las políticas existentes de `memberships`.
- Servidor: `actions/auth.ts` (nueva `signOut`), `actions/profile.ts` (nuevo), `services/membership-service.ts` (nuevo método), `lib/supabase/verify-password.ts` (nuevo), `lib/auth/routes.ts` (agrega `/profile` a las rutas protegidas).
- UI: `components/layout/header.tsx`, `components/layout/mobile-nav.tsx`, `features/account/*` (nuevo), `app/(app)/profile/page.tsx` (nuevo).
- Fuera de alcance: foto de avatar, nombre único global entre organizaciones, cambio de correo, menú de cuenta en el modo feria (`app/(fair)/layout.tsx`).
