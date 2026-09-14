## Context

Ver `proposal.md` — *Why* para la motivación. Piezas existentes relevantes:

- `memberships` tiene `display_name` por `(organization_id, user_id)`, con `UPDATE` restringido a `is_owner(organization_id)`:

```82:93:supabase/migrations/20260820100000_tenants.sql
create policy "memberships: editar solo el dueño"
  on memberships for update to authenticated
  using (is_owner(organization_id))
  with check (is_owner(organization_id));
```

  No hay política que permita a alguien tocar su propia fila. Este cambio no toca esa política.
- `supabase/config.toml` trae `secure_password_change = false`: `supabase.auth.updateUser({ password })` no exige la contraseña anterior. La única vía nativa de Supabase para "verificar sin cerrar sesión" es reautenticar contra el endpoint de contraseña con un cliente aparte, sin persistir esa sesión sobre la del usuario.
- No existe `signOut` en `actions/auth.ts` ni en ningún lugar del código; `docs/estado-de-la-plataforma.md` lo documenta como hueco conocido.
- El precedente para RPC de escritura restringida ya existe: `accept_invitation` se llama vía `.rpc()` desde `services/invitation-service.ts` y no reinterpreta el error de la base.
- El store del usuario (`stores/user-store.ts`) hoy no expone ningún nombre; el nombre visible viaja en `membership.displayName`, que ya llega al cliente vía `UserProvider`.

## Goals / Non-Goals

**Goals:**
- Un único punto en la base (`set_my_display_name`) por el que cualquier persona edita su propio nombre, sin ensanchar el alcance de la política `UPDATE` existente.
- Verificar la contraseña actual sin usar `supabase.auth.signOut()` sobre la sesión real y sin dejar sesiones huérfanas en el cliente desechable.
- Reutilizar el patrón ya establecido de acciones (`actions/*.ts` con Zod + `getSessionContext()` + `{ error } | undefined`) y de diálogos con formulario (`features/*/​*-dialog.tsx`).
- Una sola fuente para el bloque de cuenta (Perfil / Cerrar sesión) que alimente el `Header` de escritorio y el panel "Más" móvil, igual que `nav-entries.ts` alimenta la navegación.

**Non-Goals:**
- No se añade un nombre de usuario único global entre organizaciones ni se toca `auth.users` más allá de `updateUser({ password })`.
- No se implementa foto de avatar; el avatar son iniciales calculadas en el cliente.
- No se añade el menú de cuenta al layout de `(fair)` (modo feria): ese layout no tiene shell propio, es una pantalla dedicada de venta.
- No se cambia `secure_password_change` en `supabase/config.toml`: se resuelve en la capa de aplicación, no en la configuración de Auth.

## Decisions

### D1 — Autoedición del nombre vía función `security definer`, no vía nueva política `UPDATE`

Una política adicional `using (user_id = auth.uid())` en `memberships` habilitaría también `role` y `archived_at` para la propia fila — escalada de privilegios (un ayudante podría hacerse dueño). En vez de eso: una función SQL `set_my_display_name(p_organization_id uuid, p_display_name text)`, `security definer`, `search_path` fijo, que:
- localiza la fila por `(organization_id = p_organization_id, user_id = auth.uid())`,
- rechaza si no existe o está archivada,
- actualiza únicamente `display_name`.

`grant execute` a `authenticated`; se revoca a `anon`. El trigger `audit` ya existente sobre `memberships` sigue disparando porque la función hace un `UPDATE` normal internamente — no hace falta duplicar el registro de actividad.

Alternativa descartada: exponer `display_name` en una tabla `profiles` nueva, global entre organizaciones. Se descarta porque el nombre visible ya es por-organización (decisión de producto tomada al construir `user-management`), y crear `profiles` ahora introduciría dos fuentes de nombre.

### D2 — Verificación de contraseña con cliente Supabase desechable

`updateUser({ password })` no pide la contraseña anterior (`secure_password_change = false`). Para verificarla sin arriesgar la sesión real:
- `lib/supabase/verify-password.ts` (`server-only`) crea un `createClient` de `@supabase/supabase-js` (no el de `@supabase/ssr`) con la mismas `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `{ auth: { persistSession: false, autoRefreshToken: false } }` — igual patrón de "cliente sin cookies" que ya usa `lib/supabase/admin.ts`, pero con la clave anónima, no la de service role.
- Llama `signInWithPassword({ email, password: current })` en ese cliente aislado. Si tiene éxito, la contraseña era correcta; el cliente se descarta sin llamar `signOut()` en él (no hay nada que cerrar: nunca tocó las cookies del navegador).
- Solo entonces la acción usa el cliente de sesión real (`lib/supabase/server.ts`) para `updateUser({ password: nueva })`.

Alternativa descartada: pedirle a Supabase Auth que exija reautenticación (`secure_password_change = true`) y usar el flujo nativo de "nonce". Se descarta porque ese flujo envía un correo y no calza con "un modal, tres campos, sin salir de la pantalla" que pide la propuesta.

### D3 — Acción `signOut` y limpieza de la cookie de organización

`actions/auth.ts` gana `signOut()`: `createClient()` (sesión real) → `supabase.auth.signOut()` → borra la cookie `kamay-org` (mismo nombre que usa `setActiveOrganizationCookie` en `lib/auth/post-auth.ts`) → `redirect("/auth/login")`. El proxy (`lib/supabase/proxy.ts`) ya redirige cualquier ruta protegida sin sesión a `/auth/login`, así que no hace falta tocarlo.

La confirmación cuando hay registros pendientes (`useSyncStore().counts.total > 0`) vive en el componente cliente que dispara `signOut()` (el menú de cuenta / bloque del panel "Más"), con `AlertDialog` — mismo componente que ya usa el resto de la aplicación para confirmaciones destructivas — no en la acción de servidor, que no tiene acceso al store de Zustand.

### D4 — Un único componente de "acciones de cuenta", no una entrada de navegación

Perfil y Cerrar sesión no son secciones filtradas por rol como las de `nav-entries.ts` (ambas están disponibles para `owner` y `assistant` por igual), así que no se modelan como `NavEntry`. Se crea `features/account/account-actions.tsx` con la lista `[{ label: "Perfil", href: "/profile" }, { label: "Cerrar sesión", action: signOut }]`, consumida por:
- `features/account/user-menu.tsx` (desktop): `Avatar` + `DropdownMenu` de `components/ui/dropdown-menu.tsx`.
- `components/layout/mobile-nav.tsx`: el mismo bloque renderizado al pie del `SheetContent` del panel "Más", separado visualmente de `moreEntriesFor(role)` con un `Separator`.

Esto cumple design D2 de `user-auth` en espíritu (una sola declaración por concepto transversal) sin forzar Perfil/Cerrar sesión dentro de `NavEntry`, que está tipado por `roles` y por ranura de navegación — dos conceptos que no aplican aquí.

### D5 — Iniciales compartidas

`lib/user/initials.ts` extrae la función `initialsOf` hoy duplicada de hecho solo en `app/(app)/activity/page.tsx`, y la usa también `UserMenu`. `app/(app)/activity/page.tsx` se actualiza para importar el helper en vez de mantener su copia local.

## Risks / Trade-offs

- [Riesgo] Un cliente Supabase adicional por cada verificación de contraseña añade una llamada de red extra al flujo → Mitigación: es una acción de baja frecuencia (cambio de contraseña, no cada request), y evita el costo mayor de exigir reautenticación por correo.
- [Riesgo] Si `signOut()` se dispara sin comprobar `counts.total`, se pierden registros capturados sin conexión → Mitigación: el requisito de confirmación queda en el spec (`user-auth` ADDED) y en `tasks.md` con su prueba dedicada.
- [Riesgo] Una función `security definer` mal acotada podría reintroducir la escalada que se quiere evitar → Mitigación: la prueba pgTAP cubre explícitamente que `role` y `archived_at` no cambian y que no cruza organizaciones ni membresías ajenas.

## Migration Plan

1. Migración `supabase/migrations/<timestamp>_membership_self_display_name.sql` con `set_my_display_name` + su prueba pgTAP; se aplica antes que cualquier código de cliente la invoque (orden de `tasks.md`).
2. El resto es aditivo: nueva ruta, nuevas acciones, nuevos componentes. No hay paso de datos que migrar ni bandera de despliegue — revertir es quitar la migración nueva (archivo nuevo, nunca se edita una existente) y los archivos de código añadidos.
