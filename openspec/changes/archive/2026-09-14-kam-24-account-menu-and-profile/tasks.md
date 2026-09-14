## 1. Base de datos

- [x] 1.1 Crear `supabase/migrations/<timestamp>_membership_self_display_name.sql` con la función `set_my_display_name(p_organization_id uuid, p_display_name text)` (`security definer`, `search_path` fijo, `language plpgsql`), que actualiza solo `display_name` de la fila `(organization_id = p_organization_id, user_id = auth.uid())`, no archivada, y lanza excepción si no existe.
- [x] 1.2 `grant execute on function set_my_display_name(uuid, text) to authenticated`; sin grant a `anon`.
- [x] 1.3 Escribir `supabase/tests/membership_self_profile.test.sql` (pgTAP): un ayudante se renombra a sí mismo; no puede renombrar a otro miembro; no cruza organizaciones (dos orgs, misma persona); `role` y `archived_at` no cambian tras la llamada; queda un evento en `activity_log` con el nombre anterior y el nuevo.
- [x] 1.4 Ejecutar `supabase test db` y confirmar que la prueba nueva pasa junto con las existentes de `memberships`.
- [x] 1.5 Regenerar el grafo (`graphify .`) tras la migración.

## 2. Servidor: sesión y contraseña

- [x] 2.1 Agregar `signOut()` a `actions/auth.ts`: `createClient()` → `supabase.auth.signOut()` → borrar la cookie `kamay-org` → `redirect("/auth/login")`.
- [x] 2.2 Crear `lib/supabase/verify-password.ts` (`server-only`): cliente `@supabase/supabase-js` con `persistSession: false, autoRefreshToken: false` y una función `verifyCurrentPassword(email, password)` que intenta `signInWithPassword` y devuelve `boolean`, sin exponer el cliente hacia afuera.
- [x] 2.3 Agregar `services/membership-service.ts`: método `setOwnDisplayName(displayName: string)` que llama `.rpc("set_my_display_name", { p_organization_id, p_display_name })` y traduce el error de la base a un mensaje de dominio.
- [x] 2.4 Crear `actions/profile.ts` con `"use server"`: `updateDisplayName({ displayName })` (Zod: no vacío, recorta espacios) usando `getSessionContext()` + `MembershipService`, y `changePassword({ currentPassword, newPassword })` (Zod: `newPassword` mínimo 6 caracteres, coincide con la sesión actual vía `verifyCurrentPassword`, luego `supabase.auth.updateUser({ password })`). Ambas devuelven `{ error: string } | undefined` y llaman `revalidatePath("/", "layout")` en éxito.
- [x] 2.5 Agregar `/profile` a `PROTECTED_PREFIXES` en `lib/auth/routes.ts`.

## 3. UI: acciones de cuenta compartidas

- [x] 3.1 Crear `lib/user/initials.ts` con la función `initialsOf(name: string | null): string | null` (misma lógica hoy local a `app/(app)/activity/page.tsx`) y actualizar esa página para importarla en vez de declararla.
- [x] 3.2 Crear `features/account/account-actions.ts` con la lista compartida `[{ label: "Perfil", href: "/profile" }, { label: "Cerrar sesión", ... }]` usada por el menú de escritorio y el bloque del panel "Más".
- [x] 3.3 Crear `features/account/use-sign-out.ts` (hook cliente): envuelve `signOut()` con `useTransition`, revisa `useSyncStore().counts.total`, y si es mayor que cero abre un `AlertDialog` de confirmación antes de ejecutar la acción; si es cero, ejecuta directo.
- [x] 3.4 Crear `features/account/user-menu.tsx` (desktop): `Avatar` con `initialsOf(membership?.displayName)` + `DropdownMenu` de `components/ui/dropdown-menu.tsx` con los dos ítems de `account-actions.ts`, "Cerrar sesión" disparando `use-sign-out.ts`.

## 4. UI: integrar el menú en el shell

- [x] 4.1 Insertar `<UserMenu />` al final del grupo derecho de `components/layout/header.tsx` (después de `ThemeToggle`).
- [x] 4.2 Actualizar `components/layout/mobile-nav.tsx`: agregar un bloque de cuenta al pie del `SheetContent` del panel "Más" (separado con `Separator` de las entradas de `moreEntriesFor(role)`), con los mismos dos ítems y el mismo hook de confirmación de `use-sign-out.ts`; cerrar el panel al elegir cualquiera de los dos, igual que las demás entradas.
- [x] 4.3 Actualizar `components/layout/header.test.tsx` y `components/layout/mobile-nav.test.tsx` para cubrir la presencia del menú/bloque de cuenta y sus dos ítems para ambos roles.

## 5. UI: vista de perfil

- [x] 5.1 Crear `app/(app)/profile/page.tsx` (server component): lee sesión, membresía y organización activa vía `getSessionContext()`; redirige a `/auth/login` sin sesión (ya cubierto por el proxy, pero se verifica explícitamente); pasa correo, nombre de organización, rol y `displayName` actual a los componentes de cliente.
- [x] 5.2 Crear `features/account/profile-form.tsx`: campo de nombre visible con `react-hook-form` + Zod (no vacío), llama `updateDisplayName`, muestra el error o el éxito sin recargar, siguiendo el patrón de `features/auth/reset-password-form.tsx`.
- [x] 5.3 Crear `features/account/change-password-dialog.tsx`: `Dialog` con tres campos (contraseña actual, nueva, confirmar), Zod con `refine` para que nueva y confirmación coincidan y nueva tenga mínimo 6 caracteres, llama `changePassword`, muestra el error del servidor (contraseña actual incorrecta) sin cerrar el modal.
- [x] 5.4 Componer `app/(app)/profile/page.tsx` con una sección de datos de solo lectura (correo, organización, rol), `ProfileForm` y el botón "Cambiar contraseña" que abre `ChangePasswordDialog`.

## 6. Pruebas unitarias

- [x] 6.1 `lib/user/initials.test.ts` (mover/ampliar los casos existentes del helper).
- [x] 6.2 `actions/profile.test.ts`: `updateDisplayName` (vacío rechazado, éxito llama al servicio y revalida) y `changePassword` (contraseña actual incorrecta rechaza sin llamar `updateUser`, confirmación no coincide rechaza antes de tocar el servidor, éxito llama `updateUser`).
- [x] 6.3 `features/account/user-menu.test.tsx`: muestra iniciales correctas, abre el menú, dos ítems presentes.
- [x] 6.4 `features/account/change-password-dialog.test.tsx`: validación de confirmación no coincidente y de longitud mínima antes de enviar.
- [x] 6.5 `features/account/use-sign-out.test.ts`: con `counts.total > 0` pide confirmación; con `0` no la pide.

## 7. Pruebas end-to-end

- [x] 7.1 Crear `tests/e2e/account.spec.ts` (usa `tests/e2e/helpers/fresh-org.ts` para no romper las credenciales de la semilla compartida):
  - abrir el menú de cuenta desde el avatar y navegar a `/profile`;
  - cambiar el nombre visible y verificar que el nuevo nombre aparece en el shell (p. ej. en `features/settings/members-section.tsx` si el actor es dueño, o en el propio menú de cuenta);
  - cambiar la contraseña con la contraseña actual correcta y volver a iniciar sesión con la nueva;
  - intentar cambiar la contraseña con la contraseña actual incorrecta y ver el error sin perder la sesión;
  - cerrar sesión y confirmar que `/dashboard` vuelve a pedir login;
  - repetir la apertura del menú de cuenta y el cierre de sesión en el proyecto `mobile`, desde el bloque de cuenta del panel "Más".
- [x] 7.2 Añadir un caso con un registro pendiente de sincronizar (captura offline) que confirme que "Cerrar sesión" pide confirmación antes de proceder.
- [x] 7.3 Ejecutar `npm run test:e2e` en los proyectos `desktop` y `mobile` y confirmar que pasan.

## 8. Cierre

- [x] 8.1 Ejecutar `npm run lint`, `typecheck`, `test:unit`, `test:integration` y `build` de punta a punta.
- [x] 8.2 Actualizar `docs/estado-de-la-plataforma.md` para quitar el hueco de "no hay forma de salir" y `docs/manual-de-uso.md` con la nueva pantalla de perfil, si el manual documenta pantalla por pantalla.
- [x] 8.3 Confirmar que cada escenario de los deltas de spec (`user-auth`, `user-management`, `account-profile`) tiene al menos una prueba referenciada en este archivo, antes de archivar el cambio.
