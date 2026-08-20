# KAM-02 · Diseño

## Context

KAM-01 dejó el andamiaje: Next.js 16 + TS `strict`, Supabase local con pgTAP habilitado (única migración: `enable_pgtap`), arnés de pruebas en tres niveles y CI. No existe todavía ninguna tabla de negocio, ningún cliente Supabase en `lib/supabase/`, ni `middleware.ts`, ni el directorio `providers/`. `@supabase/supabase-js` está en `devDependencies` (usado por el arnés e2e); falta `@supabase/ssr`. Motivación: ver `proposal.md` — Why. Requisitos: ver los deltas `tenant-isolation` y `user-auth`.

Restricciones que gobiernan el diseño (de `openspec/project.md`): RLS en toda tabla, sin políticas `DELETE`, migraciones solo como archivos nuevos con prueba pgTAP, service role jamás en acciones de usuario, identificadores en inglés / UI en español.

## Goals / Non-Goals

**Goals:**

- Instalar el patrón de seguridad que toda tabla posterior copiará: `organization_id` + `is_member()`/`is_owner()` + políticas sin `DELETE`, con sus pruebas pgTAP como plantilla.
- Dejar el flujo de sesión completo (login → selección de organización → cascarón) de modo que KAM-03+ solo agregue contenido dentro del cascarón.

**Non-Goals:**

- UI de gestión de usuarios/roles e invitaciones (KAM-04): los usuarios y membresías de prueba se crean por semilla/administración, no desde la interfaz.
- Navegación real en las barras del cascarón (cada feature agrega la suya).
- Modo sin conexión (KAM-11): aquí la sesión es siempre en línea.

## Decisions

### D1 · Una sola migración de tenant con sus dos pruebas pgTAP

`supabase/migrations/<timestamp>_tenants.sql` crea `organizations`, `memberships`, `is_member()`, `is_owner()` y todas las políticas, copiando el DDL canónico de `kamay-esquema-base-de-datos-supabase.md` §5. Las pruebas `supabase/tests/rls_isolation.test.sql` y `supabase/tests/no_delete.test.sql` simulan usuarios autenticados fijando `role authenticated` y `request.jwt.claims` (`sub` = uuid del usuario insertado en `auth.users`), el patrón estándar de pgTAP para RLS. Alternativa descartada: separar tablas/funciones/políticas en migraciones distintas — sin valor aquí y rompe la atomicidad del patrón.

### D2 · Escrituras en tablas de tenant: solo dueño

El backlog pide "el patrón de políticas de ARCHITECTURE.md", pero aplicar literalmente `insert/update si is_member()` a `memberships` permitiría a un ayudante insertar membresías (escalada de privilegios). La matriz de acceso del esquema canónico (§16) es más específica: en `organizations` y `memberships` el ayudante solo lee; escribe el dueño. Se sigue la matriz: `select` con `is_member(organization_id)`, `insert`/`update` con `is_owner(organization_id)`. La lectura de `memberships` queda con `is_member` (ver toda la organización), no "solo su propia fila": la fila propia es lo mínimo que la selección de organización necesita y la matriz completa del ayudante se refina en KAM-04, que es donde llega la gestión de roles.

### D3 · Sesión con `@supabase/ssr` y middleware mínimo

`lib/supabase/` según ARCHITECTURE.md: `server.ts` (cliente ligado a `cookies()`), `client.ts` (navegador), `admin.ts` (service role, solo servidor), `proxy.ts` (refresco para middleware). `middleware.ts` solo refresca la cookie y redirige a `/auth/login?next=<ruta>` si no hay usuario en rutas de `(app)`; la autorización fina vive en RLS. `@supabase/ssr` y `@supabase/supabase-js` pasan a `dependencies`.

### D4 · Retorno a la ruta original vía parámetro `next`

El middleware adjunta la ruta solicitada como `?next=`; el login redirige allí tras autenticar, validando que sea una ruta interna (empieza con `/`, sin `//` ni esquema) para evitar open redirects. Alternativa descartada: cookie de destino — más estado y el parámetro sobrevive el ciclo completo del formulario.

### D5 · Aterrizaje por dispositivo con user-agent en el servidor

Tras login (y selección de organización), el servidor decide `/dashboard` o `/quick` inspeccionando el user-agent (heurística móvil simple). Es imperfecto pero barato, sin parpadeo de cliente, y el usuario puede navegar libremente después. Alternativa descartada: detección por viewport en cliente — requiere render intermedio y JavaScript antes de la primera navegación.

### D6 · Organización activa en cookie + `OrganizationProvider`

La organización elegida se guarda en una cookie (`kamay-org`) legible por Server Components y Server Actions. `AuthCheck` en el layout de `(app)` carga usuario y membresías activas con el cliente de servidor; si no hay cookie válida (o la membresía ya no existe/está archivada) y hay más de una organización, redirige a `/auth/select-org`; con exactamente una, la fija automáticamente. `UserProvider`/`OrganizationProvider` reciben esos datos del servidor e hidratan `UserStore`/`OrganizationStore` (Zustand) para los componentes de cliente. Alternativa descartada: organización solo en el store de cliente — las Server Actions no podrían resolverla sin round-trip extra.

### D7 · Sin registro público, cuentas por semilla

`enable_signup = false` en la configuración de auth de Supabase local (y del proyecto remoto cuando exista). Los usuarios de prueba (e2e y desarrollo) se crean vía `supabase/seed.sql` / cliente admin en el setup de pruebas — nunca desde la UI. La pantalla V1 solo ofrece correo + contraseña y "¿Olvidaste tu contraseña?".

### D8 · Recuperación de contraseña con los manejadores estándar

`app/auth/*`: `login`, `forgot-password`, `reset-password`, `select-org`, más los route handlers `auth/confirm` (verificación del enlace de correo, `verifyOtp`) y `auth/callback` (intercambio de código). En local, el correo se captura con el servidor de correo de pruebas de Supabase (Mailpit/Inbucket), que es también como el e2e verifica el flujo.

## Risks / Trade-offs

- [La detección por user-agent clasifica mal algunos dispositivos] → Es solo el aterrizaje inicial; ambas rutas quedan accesibles y el criterio de aceptación se prueba con los UA estándar de Playwright (proyectos desktop y mobile).
- [Simular `auth.uid()` en pgTAP depende de `request.jwt.claims`] → Es el mecanismo documentado de Supabase; las pruebas fijan y limpian los claims por caso para no contaminarse entre sí.
- [El e2e de expiración de sesión no puede esperar a que caduque un JWT real] → Se invalida/borra la cookie de sesión desde la prueba y se verifica la redirección con `next` y el retorno a la ruta original.
- [Cookie `kamay-org` desincronizada (membresía archivada después de elegir)] → `AuthCheck` revalida la membresía en cada carga de layout; cookie inválida ⇒ se borra y se vuelve a la selección.
- [`is_member`/`is_owner` son `security definer`] → Superficie mínima y `set search_path = public` fijado en la definición canónica; sus pruebas pgTAP cubren membresías archivadas y roles.

## Migration Plan

1. Migración `_tenants.sql` + pruebas pgTAP (`supabase db reset` + `supabase test db` en verde).
2. Clientes `lib/supabase/` + `middleware.ts` (la app sigue arrancando sin sesión → redirige a login).
3. Pantallas `app/auth/*`, cascarón `(app)` con `AuthCheck`, providers y stores.
4. e2e `auth.spec.ts` al final, cuando el flujo completo existe.

Reversión: revertir el commit de código; la migración no se edita — si hiciera falta deshacerla, se crea una migración nueva que lo haga (convención del proyecto).

## Open Questions

- Textos definitivos de V1 (etiquetas, mensajes de error): se toman provisionales en español y se ajustan cuando exista guía de contenido; no cambian specs ni tareas.
