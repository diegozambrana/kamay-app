## Why

La raíz `/` sigue sirviendo la página vacía del andamiaje de KAM-01: un botón de tema en medio de la pantalla, sin ninguna salida. Es además la dirección que se abre al escribir el dominio y el `start_url` de la PWA instalada, así que hoy quien abre Kamay desde el ícono del teléfono aterriza en una página que no lleva a ningún lado. `/` tiene que decidir por la persona: a entrar si no tiene sesión, a su pantalla de inicio si ya la tiene.

## What Changes

- `/` deja de renderizar contenido propio y pasa a ser **solo una redirección** resuelta por sesión:
  - Sin sesión → `/auth/login`, sin `?next=` (la raíz no es un destino que valga la pena recordar).
  - Con sesión → el mismo aterrizaje por dispositivo que tras entrar: `/dashboard` en escritorio, `/quick` en móvil.
- La selección de organización no se salta: si la persona tiene varias organizaciones y ninguna activa válida, llegar por `/` la lleva a elegir antes de ver cualquier pantalla de `(app)`, igual que hoy al entrar a cualquier ruta del cascarón.
- Se retira la página del andamiaje (`app/page.tsx` con `ThemeToggle`). **BREAKING** para el requisito de `project-foundation` que exigía una "página vacía con selector de tema" en la raíz: el selector de tema ya vive en la barra superior del cascarón (`components/layout/header.tsx`), y es ahí donde se sigue exigiendo y probando.
- La prueba e2e del tema (`tests/e2e/theme.spec.ts`) deja de visitar `/` y pasa a comprobar el selector en la barra superior con sesión iniciada.
- La pantalla "sin organización" deja de ser un callejón sin salida. Quien tiene sesión pero ninguna membresía activa (nunca fue invitado a una organización, o lo quitaron del equipo) aterriza ahí al entrar por `/`, y hoy solo ve un texto: no hay cascarón, así que tampoco hay menú de cuenta desde donde salir. Esa pantalla pasa a ofrecer un botón **Cerrar sesión** que termina la sesión igual que el menú de cuenta y lleva a `/auth/login`, para poder entrar con otra cuenta.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `user-auth`: se agrega el requisito de que la raíz `/` redirija según la sesión — a `/auth/login` sin sesión y al aterrizaje por dispositivo con sesión, sin saltarse la selección de organización —, y el de que una cuenta sin organización pueda cerrar su sesión desde la pantalla que se lo informa.
- `project-foundation`: se retira el requisito "Application shell boots with theme switching" (página vacía con selector de tema en la raíz) y se reemplaza por uno donde el arranque se verifica llegando a la pantalla de entrada y el selector de tema se exige en la barra superior del cascarón.

## Impact

- Servidor: `lib/supabase/proxy.ts` (la decisión de la raíz se toma donde ya se valida la sesión), `lib/auth/routes.ts` (helper puro para el destino de la raíz), `app/page.tsx` (queda como red de seguridad que redirige igual; sin contenido).
- UI: `features/account/no-organization-notice.tsx` (nuevo: el aviso con su botón de cierre de sesión, que reutiliza la acción `signOut` de KAM-24) y `app/(app)/layout.tsx` (lo usa en lugar del texto en línea).
- Pruebas: `features/account/no-organization-notice.test.tsx` (nuevo), `tests/e2e/helpers/fresh-org.ts` (una cuenta sin organización), `lib/auth/routes.test.ts` (helper), `tests/e2e/auth.spec.ts` (la raíz con y sin sesión, escritorio y móvil, varias organizaciones), `tests/e2e/theme.spec.ts` (el tema desde la barra superior), `app/route-states.test.tsx` (motivo de la exclusión de `.`).
- Sin cambios de base de datos, de dependencias ni de `app/manifest.ts`: el `start_url` sigue siendo `/`, que ahora sí resuelve.
- Fuera de alcance: un selector de tema en móvil (hoy no existe fuera de la barra superior de escritorio y este cambio no lo agrega), una página pública de presentación en `/`, reenviar a `/auth/callback` enlaces de correo que caigan en `/?code=…` por una URL de redirección no permitida, y cambiar el comportamiento sin conexión de la PWA (una navegación a `/` sin red sigue sirviendo `/offline`).
