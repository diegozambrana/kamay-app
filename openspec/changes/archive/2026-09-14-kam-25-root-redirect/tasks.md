## 1. Regla de destino de la raíz

- [x] 1.1 Agregar a `lib/auth/routes.ts` la función pura `rootRedirectPath(hasSession: boolean, userAgent: string | null | undefined): string`: `LOGIN_PATH` sin sesión, `defaultLandingPath(userAgent)` con sesión (design D1). Sin `?next=` (D4).
- [x] 1.2 Casos en `lib/auth/routes.test.ts`: sin sesión devuelve `/auth/login` sin consulta, sea cual sea el user-agent; con sesión y user-agent de iPhone/Android devuelve `/quick`; con sesión y user-agent de escritorio o ausente devuelve `/dashboard`. Cubre los escenarios «Anonymous visitor at the root goes to login», «Signed-in user on desktop goes to the dashboard» y «Signed-in user on mobile goes to quick capture» a nivel unitario.

## 2. Proxy

- [x] 2.1 En `lib/supabase/proxy.ts`, extraer a un helper local la creación de una redirección que conserva las cookies refrescadas por Supabase (hoy en línea en la rama de rutas protegidas) y usarlo en esa rama sin cambiar su comportamiento.
- [x] 2.2 Agregar la rama de la raíz en `updateSession()`: si `pathname === "/"`, redirigir a `rootRedirectPath(Boolean(user), request.headers.get("user-agent"))` con `url.search = ""`, usando el helper de 2.1. Actualizar el comentario de cabecera de la función y el de `proxy.ts` para que digan que la raíz también se resuelve ahí.
- [x] 2.3 Actualizar la línea de `middleware.ts`/proxy en `specs/PRD/ARCHITECTURE.md` §Enrutado para mencionar que la raíz `/` redirige según la sesión.

## 3. Página raíz

- [x] 3.1 Reemplazar `app/page.tsx` por un Server Component sin contenido: `getRequestUser()` + `headers()` → `redirect(rootRedirectPath(...))`, con un comentario que explique que es la red de seguridad del proxy (design D2) y por qué no usa `resolvePostAuthPath` (D3). Se retira el `ThemeToggle` de la raíz.
- [x] 3.2 Actualizar en `app/route-states.test.tsx` el motivo de la exclusión `"."` («Solo redirige según la sesión (KAM-25): no consulta datos ni renderiza contenido.») y confirmar que la prueba sigue pasando.

## 4. Pruebas e2e

- [x] 4.1 En `tests/e2e/auth.spec.ts`, bloque «acceso sin sesión»: un anónimo que abre `/` termina en `/auth/login` y la URL no lleva `next` (escenario «Anonymous visitor at the root goes to login»).
- [x] 4.2 En `tests/e2e/auth.spec.ts`, bloque «aterrizaje por dispositivo y cascarón»: con sesión, abrir `/` lleva a `/dashboard` en el proyecto de escritorio y a `/quick` en el móvil (escenarios «Signed-in user on desktop goes to the dashboard» y «Signed-in user on mobile goes to quick capture»).
- [x] 4.3 En `tests/e2e/auth.spec.ts`, bloque «selección de organización»: una dueña con dos organizaciones entra, queda en `/auth/select-org` sin elegir, abre `/` y vuelve a ver la pantalla de selección, no una pantalla de `(app)` (escenario «The root does not skip organization selection»).
- [x] 4.4 En `tests/e2e/account.spec.ts`, prueba «cerrar sesión sin pendientes termina la sesión de inmediato»: tras cerrar sesión, además de `/dashboard`, abrir `/` redirige a `/auth/login` (escenario «A session that ended no longer reaches the app through the root»).
- [x] 4.5 Reescribir `tests/e2e/theme.spec.ts` (design D5): entrar con `createFreshOrganization()`, abrir `/dashboard`, alternar el tema desde el botón «Cambiar tema» de la barra superior, recargar y comprobar que persiste; `test.skip(isMobile, "solo escritorio")`. Cubre el escenario «Theme toggle in the top bar switches and persists» de `project-foundation`.
- [x] 4.6 Extender la prueba de 4.1: registrar `page.on("console")` y `page.on("pageerror")` antes de abrir `/`, y comprobar que la pantalla de entrada muestra el botón «Entrar» sin mensajes de nivel `error` ni excepciones de página (escenario «Dev server serves the sign-in screen» de `project-foundation`; el fixture de `helpers/test.ts` no recoge errores de consola, así que se escucha en la propia prueba).

## 5. Sin organización: cerrar sesión

- [x] 5.1 Crear `features/account/no-organization-notice.tsx` (Server Component, design D6): el mensaje actual («Tu cuenta no pertenece a ninguna organización. Pide a la persona dueña que te invite.») y un `<form action={signOut}>` con un botón «Cerrar sesión» (`data-testid="no-organization-sign-out"`).
- [x] 5.2 Usar `<NoOrganizationNotice />` en `app/(app)/layout.tsx` en lugar del bloque en línea de `memberships.length === 0`.
- [x] 5.3 `features/account/no-organization-notice.test.tsx`: muestra el mensaje y un único botón «Cerrar sesión» de tipo `submit`; activarlo invoca `signOut` (mockeado); no hay enlaces de navegación. Cubre a nivel unitario «The notice offers a way out».
- [x] 5.4 Agregar a `tests/e2e/helpers/fresh-org.ts` `createAccountWithoutOrganization()`: crea el usuario con el cliente de service role y la contraseña común, sin ninguna membresía.
- [x] 5.5 En `tests/e2e/account.spec.ts`, bloque nuevo «cuenta sin organización»: la cuenta entra, ve el aviso y el botón, sin `top-bar` ni `bottom-bar` (escenario «The notice offers a way out»); pulsa «Cerrar sesión» y llega a `/auth/login` (escenario «Signing out from the notice goes to login»); abre `/` y vuelve a `/auth/login` en lugar del aviso (escenario «After signing out, the notice is no longer reachable»). En escritorio y móvil.

## 6. Verificación

- [x] 6.1 `npm run lint`, `npm run typecheck` y `npm run test:unit` en verde.
- [x] 6.2 `npx playwright test tests/e2e/auth.spec.ts tests/e2e/account.spec.ts tests/e2e/theme.spec.ts` en verde en los proyectos `desktop` y `mobile`.
- [x] 6.3 Comprobar a mano en el navegador con el servidor de desarrollo: `/` sin sesión → `/auth/login`; con sesión → `/dashboard`; y con la emulación móvil → `/quick`.
- [x] 6.4 `openspec validate kam-25-root-redirect --strict` sin errores y `graphify update .` tras el último cambio de código.
