## Context

- `proxy.ts` (el middleware de Next.js 16) ya corre en **toda** petición no estática, incluida `/`, y llama a `updateSession()` en `lib/supabase/proxy.ts`. Esa función ya obtiene `user` con `getUser()` (validado contra Auth) y ya redirige a `/auth/login` las rutas de `PROTECTED_PREFIXES` sin sesión. `/` no está en esa lista, así que hoy pasa de largo y renderiza `app/page.tsx`: el andamiaje de KAM-01 con un `ThemeToggle`.
- El aterrizaje por dispositivo ya existe como función pura: `defaultLandingPath(userAgent)` en `lib/auth/routes.ts` (`/quick` para user-agents móviles, `/dashboard` para el resto).
- La selección de organización ya la garantiza el layout de `(app)`: con varias membresías y la cookie `kamay-org` ausente o inválida redirige a `/auth/select-org`; con una sola, la usa sin preguntar; sin ninguna, muestra el estado "sin organización".
- `resolvePostAuthPath()` (`lib/auth/post-auth.ts`) resuelve lo mismo pero **escribe la cookie de organización**, y Next.js no permite escribir cookies durante el render de un Server Component (solo en Server Functions y Route Handlers).
- `app/route-states.test.tsx` falla si una exclusión apunta a un segmento que ya no tiene página: la exclusión `"."` existe hoy con el motivo "página del andamiaje".

## Goals / Non-Goals

**Goals:**
- Que `/` nunca renderice: responde con una redirección en la misma petición, antes de cualquier render.
- Una sola fuente para "a dónde se aterriza": la raíz reutiliza `defaultLandingPath` y no declara su propia regla de dispositivo.
- La selección de organización sigue viviendo en un único lugar (el layout de `(app)`); la raíz no la reimplementa.

**Non-Goals:**
- Tocar el flujo de entrada (`/auth/login`, `/auth/select-org`, `resolvePostAuthPath`).
- Cambiar la cobertura de `PROTECTED_PREFIXES` o el `matcher` del proxy.

## Decisions

### D1 · La decisión se toma en el proxy, no en la página

`updateSession()` gana una rama para `pathname === "/"`: sin `user` redirige a `LOGIN_PATH`; con `user`, a `defaultLandingPath(request.headers.get("user-agent"))`. El destino lo calcula un helper puro nuevo en `lib/auth/routes.ts` —`rootRedirectPath(hasSession, userAgent)`— para que la regla se pruebe con Vitest sin montar un `NextRequest`.

**Por qué:** el proxy ya tiene `user` en la mano; decidir ahí cuesta cero idas y vueltas a Auth adicionales y ningún render. Es además donde el proyecto ya declara "qué ruta exige sesión" (ARCHITECTURE.md §Enrutado), así que la regla de la raíz queda junto a su hermana.

**Alternativa descartada — solo en `app/page.tsx`:** funciona, pero suma una segunda validación contra Auth por petición (la del proxy más la de la página) para una ruta que no muestra nada, y hace pasar la decisión por el render de React.

### D2 · `app/page.tsx` queda como red de seguridad, sin contenido

La página se reduce a un Server Component que obtiene el usuario con `getRequestUser()` y llama a `redirect(rootRedirectPath(...))` con el user-agent de `headers()`. En la práctica no se alcanza —el proxy responde antes—, igual que la guardia del layout de `(app)` no se alcanza cuando el proxy ya bloqueó: es la misma doctrina de "el proxy bloquea, el render verifica" que el proyecto ya aplica.

**Por qué no borrarla:** sin página, un fallo del `matcher` convertiría `/` en un 404, y `app/not-found.tsx` enlaza precisamente a `/` como "Ir al inicio": un ciclo sin salida. Con la página, el peor caso sigue siendo la redirección correcta. Además la exclusión `"."` de `route-states.test.tsx` sigue apuntando a una página real; solo cambia su motivo ("solo redirige").

### D3 · La raíz no llama a `resolvePostAuthPath`

Ni el proxy ni la página usan `resolvePostAuthPath`: en la página, escribir la cookie de organización durante el render lanza un error; en el proxy, arrastraría una consulta de membresías a cada visita a `/`. En su lugar, la raíz redirige al aterrizaje por dispositivo y deja que el layout de `(app)` haga lo que ya hace: con una organización la toma sin cookie, con varias y sin cookie válida manda a `/auth/select-org`. El resultado observable es el mismo que el requisito pide, sin duplicar lógica.

### D4 · Sin `?next=` y sin conservar la consulta

La redirección de la raíz descarta la cadena de consulta y no añade `next`. `next=/` solo produciría un rebote extra (`/auth/login` → `/` → aterrizaje), y `/` no recibe hoy ningún parámetro legítimo. Las cookies refrescadas por Supabase se copian a la respuesta de redirección igual que en la redirección existente; esa copia se extrae a un helper local de `lib/supabase/proxy.ts` para que ambas ramas la compartan.

### D5 · El tema se prueba donde vive

`tests/e2e/theme.spec.ts` entra con una organización propia (`createFreshOrganization`, como el resto de la suite desde KAM-23) y alterna el tema desde la barra superior en `/dashboard`. Se marca "solo escritorio": en móvil la barra superior no se muestra y no hay selector de tema, lo cual ya es cierto hoy y queda fuera de alcance.

### D6 · El aviso "sin organización" cierra sesión con un formulario, sin confirmación

El texto que hoy vive en línea en `app/(app)/layout.tsx` pasa a `features/account/no-organization-notice.tsx`, un Server Component con el mensaje y un `<form action={signOut}>` con el botón "Cerrar sesión". Reutiliza la acción `signOut` de KAM-24 tal cual —cerrar la sesión de Supabase, borrar `kamay-org`, redirigir a `/auth/login`—, así que no hay un segundo camino de salida que mantener.

**Por qué un formulario y no `useSignOut()`:** ese hook existe para pedir confirmación cuando hay registros pendientes, y el recuento lo publica el `SyncProvider`, que este aviso no monta: la cola se drena contra una organización y aquí no hay ninguna. Montar el hook sin su proveedor leería siempre cero y aparentaría una comprobación que no ocurre. El formulario, en cambio, funciona incluso antes de hidratar. Cerrar sesión no borra la cola del dispositivo (la confirmación de KAM-24 lo dice: "seguirán guardados aquí"), así que ningún registro se pierde por no preguntar.

**Por qué en `features/account/`:** es donde viven las demás acciones de cuenta (menú, confirmación, perfil); el layout sigue siendo delgado y solo decide cuándo mostrarlo.

## Risks / Trade-offs

- [El user-agent decide el aterrizaje; una ventana estrecha de escritorio recibe `/dashboard`] → Es la misma imperfección aceptada en `defaultLandingPath` (D5 de KAM-02); ambas rutas quedan a un toque.
- [Un enlace de correo que Supabase haga caer en `/?code=…` pierde el código] → Hoy ya se pierde (la página del andamiaje lo ignora); los correos del proyecto apuntan a `/auth/confirm`. Queda fuera de alcance, anotado en la propuesta.
- [Una visita a `/` con sesión pasa por dos redirecciones cuando hay varias organizaciones sin elegir (`/` → `/dashboard` → `/auth/select-org`)] → Coste de un salto extra en un caso poco frecuente, a cambio de no duplicar la regla de selección en la raíz.
- [La PWA sin red abre en `/` y recibe `/offline`, no `/quick`] → Sin cambio respecto de hoy: el service worker manda toda navegación a red y responde `/offline` sin ella. Cachear la raíz rompería la regla de "no servir estado viejo".

## Migration Plan

Despliegue normal, sin migraciones ni variables nuevas. Revertir el commit devuelve la página del andamiaje; no deja estado que limpiar.
