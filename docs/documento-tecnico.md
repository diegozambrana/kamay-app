# Kamay · Documento técnico

> Guía para que una persona desarrolladora nueva entienda la plataforma y pueda empezar a trabajar en ella el primer día. Refleja el **estado real del código** a 2026-09-13; donde `specs/PRD/ARCHITECTURE.md` diga otra cosa, manda este documento y el código.
>
> Documentos relacionados: [Manual de uso](manual-de-uso.md) · [Manual de pruebas](manual-de-pruebas.md) · [Estado de la plataforma](estado-de-la-plataforma.md) · constitución del proyecto en `openspec/project.md`.

## Índice

1. [Qué es Kamay en una página](#1-qué-es-kamay-en-una-página)
2. [Stack y versiones](#2-stack-y-versiones)
3. [Puesta en marcha](#3-puesta-en-marcha)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Arquitectura por capas](#5-arquitectura-por-capas)
6. [Autenticación, sesión y multiorganización](#6-autenticación-sesión-y-multiorganización)
7. [Base de datos](#7-base-de-datos)
8. [Estados configurables](#8-estados-configurables)
9. [Interfaz: convenciones de frontend](#9-interfaz-convenciones-de-frontend)
10. [Modo sin conexión](#10-modo-sin-conexión)
11. [Notificaciones y trabajos programados](#11-notificaciones-y-trabajos-programados)
12. [Bitácora, retención y exportación](#12-bitácora-retención-y-exportación)
13. [Pruebas](#13-pruebas)
14. [Integración continua y despliegue](#14-integración-continua-y-despliegue)
15. [Flujo de trabajo: OpenSpec y Graphify](#15-flujo-de-trabajo-openspec-y-graphify)
16. [Cómo agregar una funcionalidad (receta)](#16-cómo-agregar-una-funcionalidad-receta)
17. [Trampas conocidas](#17-trampas-conocidas)

---

## 1. Qué es Kamay en una página

Aplicación web multiorganización para talleres de producción propia. Cada **organización** tiene **líneas de negocio**, **miembros** con rol `owner` o `assistant`, y registra pedidos, ventas de feria, egresos, cobros y pagos, catálogo con inventario, tareas, activos y una bitácora inmutable. Funciona en escritorio y móvil (PWA) y permite **capturar sin conexión**.

Reglas que atraviesan todo el código (constitución en `openspec/project.md`):

1. Capas: `app/` → `actions/` → `services/` → Supabase. Ninguna consulta fuera de `services/`; `"use server"` solo en `actions/`.
2. **RLS en toda tabla**, `organization_id` en toda consulta. Service role solo en trabajos programados y generación de avisos.
3. **No existen políticas `DELETE`**: se archiva con `archived_at`.
4. **Nada derivado se almacena**: saldos, totales y márgenes viven en vistas o funciones SQL con `security_invoker`.
5. Los estados se comparan por **`kind`**, nunca por nombre.
6. Migraciones solo como archivos nuevos, cada una con su prueba pgTAP.
7. Un solo historial: `activity_log`, alimentado por el trigger genérico `log_activity()`.
8. Identificadores en inglés; texto visible al usuario en español.
9. UUID generados en el cliente; `occurred_at` lo fija el cliente, `created_at` el servidor.
10. Pedidos y tareas no se sincronizan entre sí.
11. Ningún concepto nuevo fuera del modelo de la especificación funcional.
12. Ningún cambio sin OpenSpec.

---

## 2. Stack y versiones

| Capa | Tecnología | Versión (package.json) |
| --- | --- | --- |
| Framework | Next.js App Router, React | 16.3.1 / 19.2.8 |
| Lenguaje | TypeScript `strict` | 5 |
| Backend | Supabase (Postgres, Auth, Storage, RLS) vía `@supabase/ssr` | ssr 0.12 / supabase-js 2.109 |
| Supabase CLI | fijado en CI | 2.115.0 |
| Estado cliente | Zustand | 5 |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Lucide, next-themes | — |
| Formularios | react-hook-form + Zod | 7 / 4 |
| Tablero | dnd-kit | 6 |
| Gráficos | Recharts | 3 |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | — |
| Sin conexión | Serwist (service worker) + Dexie (IndexedDB) | 9 / 4 |
| Compresión ZIP | fflate | — |
| Imágenes | sharp (miniaturas WebP en servidor) | — |
| Pruebas | Vitest 4, Testing Library, pgTAP, Playwright 1.62, axe-core | — |
| Node | CI usa **24**; local funciona con 20.19 | sin `engines` declarado |

> **Next.js 16 no es el Next.js de la documentación antigua.** Antes de escribir código lee las guías en `node_modules/next/dist/docs/` (lo recuerda `AGENTS.md`). El middleware se llama `proxy.ts`; los params de ruta son promesas; `next typegen` genera tipos de rutas.

---

## 3. Puesta en marcha

### 3.1 Requisitos

- Docker (para Supabase local).
- Node.js 20 o superior (24 recomendado, es el de CI).
- Supabase CLI (`brew install supabase/tap/supabase`).
- Opcional: `graphify` (`pipx install graphifyy`) y `openspec`.

### 3.2 Pasos

```bash
npm ci
```

```bash
supabase start
```

Copia las llaves que imprime `supabase status` a `.env.local` (plantilla en `.env.example`):

```bash
cp .env.example .env.local
```

Variables mínimas en desarrollo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. En producción además `CRON_SECRET` (≥ 16 caracteres) y `APP_URL`; `RESEND_API_KEY` es opcional. `lib/env.ts` valida el conjunto **al compilar** y hace fallar el build nombrando la variable que falta (nunca su valor).

```bash
supabase db reset
```

Aplica migraciones y la semilla (`supabase/seed.sql`): organizaciones *Geeko Store*, *Taller Kamay*, *Kamay Feria* y *Kamay Histórico*, usuarios `*@kamay.test` con contraseña `kamay123`.

```bash
npm run dev
```

La aplicación queda en `http://localhost:3010`. Puertos del stack local (bloque 544xx para convivir con otro proyecto Supabase): API `54421`, Postgres `54422`, Studio `54423`, Mailpit `54424`. `supabase status -o env` es la fuente de verdad para scripts y CI.

### 3.3 Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, compilación, servidor de producción (puerto 3010). `postbuild` compila el service worker con Serwist. |
| `npm run lint` | ESLint (config en `eslint.config.mjs`, incluye reglas de React hooks y Next). |
| `npm run typecheck` | `next typegen && tsc --noEmit`. |
| `npm run test:unit` / `test:integration` / `test:e2e` / `test:e2e:ui` | Ver §13. |
| `npm run check:bundle` | Tras `build`, falla si la clave de service role aparece en algo servido al navegador. |
| `supabase test db` | Pruebas pgTAP. |

---

## 4. Estructura del repositorio

```
app/                 Rutas (App Router). Páginas delgadas + loading.tsx + error.tsx por segmento
  (app)/             Interfaz autenticada con cascarón (sidebar, header, barra móvil)
  (fair)/fair/       Modo feria: layout propio sin cascarón
  auth/              login, forgot-password, reset-password, select-org, invite/[token], callback, confirm
  api/               Trabajos programados: notifications/daily, activity/retention
  offline/           Página que sirve el service worker sin red
  sw.ts              Service worker (Serwist)
actions/             Server Actions ("use server"): sesión, rol, Zod, revalidatePath, delegan a services
services/            Acceso a Supabase. Clases con SupabaseClient inyectado. Único sitio con .from()
features/            Rebanadas verticales por dominio (pantallas, hooks, componentes de cliente)
components/          UI compartida: layout/, shared/ (estados vacío/error/carga), board/, ui/ (shadcn)
lib/                 Lógica pura y adaptadores: auth, supabase, offline, statuses, payments, export…
stores/              Zustand transversal: user, organization, business-line, board, sync
hooks/               Hooks transversales (use-online-status, use-filter-state, use-mobile…)
types/index.ts       Tipos de dominio
constants/, configs/ Constantes (cookies, conf del producto) y listas de opciones
supabase/
  migrations/        31 migraciones, solo se añaden
  tests/             64 archivos pgTAP
  seed.sql, seeds/   Semilla de desarrollo y semilla de rendimiento
  README.md          Cómo auditar una tabla, trabajos programados
tests/
  e2e/               34 specs Playwright + helpers/
  integration/       Vitest contra la base local
  factories/, setup/
openspec/            project.md (constitución), specs/ (consolidadas), changes/ (en curso y archive/)
specs/PRD/           Especificación funcional, esquema, mapa de navegación, backlog, ARCHITECTURE.md
graphify-out/        Grafo de conocimiento versionado
scripts/             check-client-bundle.mjs
docs/                Este documento, manuales, recuperación, verificación del anexo de BD, capturas/
```

Alias de importación: `@/*` apunta a la raíz.

---

## 5. Arquitectura por capas

### 5.1 Flujo de una escritura

Ejemplo: crear un pedido.

1. **`app/(app)/orders/new/page.tsx`** (Server Component) resuelve sesión y organización, carga líneas, canales y estados, y renderiza `features/orders/order-form.tsx`.
2. **`order-form.tsx`** (cliente) valida con el esquema Zod compartido (`lib/orders/schema.ts`), genera el `uuid` del pedido en el cliente y llama a `capture()` de `lib/offline/capture.ts`, que encola la operación `order.create` y espera hasta 2,5 s a que se envíe.
3. **`actions/orders.ts › createOrder`** (`"use server"`): `getSessionContext()`, vuelve a validar con Zod, instancia `OrderService` con el cliente Supabase **de la sesión** (RLS activo), llama al RPC `create_order(p_order, p_items)` y hace `revalidatePath`.
4. **Postgres**: `create_order` inserta pedido y líneas en una transacción, resuelve el **estado inicial** de la línea (`kind = 'initial'`), asigna el número correlativo (`assign_order_code`) y el trigger `log_activity()` escribe en `activity_log`. `on conflict (id) do nothing` hace idempotente el reenvío.
5. La página del detalle lee `order_totals` (vista) para el total; nada se almacena calculado.

### 5.2 Flujo de una lectura

Las páginas de `app/` llaman a servicios directamente en el servidor (no a Server Actions) con el cliente de `lib/supabase/server.ts`. Las lecturas por petición se deduplican con `cache()` de React (`lib/auth/request-user.ts`).

### 5.3 Contexto de sesión

- `lib/auth/session-context.ts`: `getSessionContext()` devuelve `{ supabase, user, organizationId, role, membership }`; `getOwnerContext()` devuelve `null` si el rol no es `owner`.
- Toda acción empieza por uno de los dos. Las secciones solo de dueño hacen `redirect("/dashboard")` en su `layout.tsx` (`expenses`, `activity`) o en cada `page.tsx` (`settings/*`, `reports`, `assets`).
- **RLS es la última línea de defensa, no la única.** Una acción que no verifica rol antes de mutar es un error de revisión.

### 5.4 Clientes Supabase (`lib/supabase/`)

| Módulo | Uso |
| --- | --- |
| `server.ts` | `createServerClient` con cookies de Next. Server Components, Server Actions, route handlers. |
| `client.ts` | `createBrowserClient`. Solo donde el cliente necesita acceso directo (subidas). |
| `admin.ts` | Service role. **Solo** `app/api/*` y `services/notifications/generator.ts`. Importa `server-only`; una prueba de arquitectura comprueba que `features/` no lo importa y `check:bundle` que no llega al navegador. |
| `proxy.ts` | Refresco de sesión para `proxy.ts` (middleware). |

---

## 6. Autenticación, sesión y multiorganización

- **Supabase Auth con cookies** (`@supabase/ssr`). `proxy.ts` (raíz) llama a `updateSession()` en cada petición no estática y redirige a `/auth/login?next=…` cuando no hay sesión y la ruta empieza por uno de `PROTECTED_PREFIXES` (`lib/auth/routes.ts`).
- **Sin registro público**: el hook `before user created` (`public.hook_before_user_created`, migración `20260911120000`) rechaza cualquier alta cuyo correo no tenga una invitación vigente. Hay que **registrar el hook** en el proyecto alojado (pendiente en KAM-23 10.6).
- **Invitaciones**: `lib/invitations/token.ts` genera 32 bytes aleatorios; la base guarda solo `sha256`; caducidad 7 días; `accept_invitation()` responde igual ante cualquier fallo. El enlace se muestra una sola vez; la aplicación no lo envía por correo.
- **Organización activa**: cookie `kamay-org` (httpOnly, 1 año). Con una sola membresía se fija sola; con varias, `/auth/select-org`. **Línea activa**: cookie `kamay-line-<orgId>`, escrita solo por la Server Action `actions/business-line-context.ts`, que valida que la línea sea de la organización. Nombres en `constants/auth.ts`.
- **Aterrizaje por dispositivo**: `defaultLandingPath()` detecta móvil por user-agent en el servidor: móvil → `/quick`, escritorio → `/dashboard`. `sanitizeNextPath()` evita open redirects.
- **Roles**: `owner` / `assistant`. Funciones SQL `is_member(org)` e `is_owner(org)` sostienen todas las políticas. La restricción por líneas del ayudante (`membership_lines`) solo afecta a **tareas**; lista vacía = todas.
- **Hoy no existe `signOut`** en `actions/auth.ts` ni botón en la interfaz (ver estado de la plataforma).

---

## 7. Base de datos

### 7.1 Dominios y tablas

| Dominio | Tablas | Vistas / funciones derivadas |
| --- | --- | --- |
| Organización | `organizations`, `memberships`, `membership_lines`, `invitations` | — |
| Configuración | `business_lines`, `sales_channels`, `expense_categories`, `units`, `statuses` | `resolve_statuses()` |
| Directorio | `contacts` | — |
| Catálogo | `items`, `item_variants`, `asset_details`, `attachments` | `item_balances`, `item_last_cost`, `best_selling_products`, `asset_recovery` |
| Ventas | `orders` (`kind` = `order` / `direct_sale`), `order_items`, `payments` | `order_totals`, `receivables_by_line`, `cash_flow_by_line_month` |
| Egresos | `expenses` (`kind` = `purchase` / `expense`), `expense_items` | `expense_totals` |
| Inventario | `inventory_movements` (inmutable: solo `select`/`insert`) | `item_balances` |
| Tareas | `tasks`, `tags`, `task_tags`, `task_links`, `task_deliverables` | — |
| Avisos | `notifications`, `notification_preferences` | — |
| Bitácora | `activity_log` (inmutable para `authenticated`) | `purge_activity_detail()`, `record_export()` |
| Reportes | — | `report_profitability`, `report_expense_breakdown`, `report_product_ranking`, `report_low_stock`, `report_line_comparison` (funciones con rango, `security invoker`, `is_owner` dentro) |

Storage: buckets privados (`attachments`, fotos de catálogo, comprobantes, `activity-exports`…). Toda ruta empieza por `organization_id/` y las políticas lo verifican con `storage.foldername(name)[1]`. Todo lo que se muestra se **firma** al leer; las miniaturas `.thumb.webp` se generan con `sharp` al subir.

### 7.2 Reglas que el catálogo verifica solo

`supabase/tests/preproduction_checklist.test.sql` recorre `pg_catalog` y falla si una tabla nueva incumple: `organization_id` + RLS activa, ninguna política `DELETE`/`ALL`, ningún `TRUNCATE` concedido a roles de la API, trigger de auditoría presente, ninguna columna `real`/`double`/`money`, ningún nombre de columna derivado (`total`, `balance`, `stock`…), toda vista con `security_invoker = true`, índices sobre los filtros reales de la interfaz. Resultado y hallazgos en `docs/anexo-bd-verificacion.md`.

### 7.3 Cómo agregar una tabla

1. Nueva migración `supabase/migrations/YYYYMMDDHHMMSS_<nombre>.sql` (nunca editar una existente).
2. Columnas base: `id uuid primary key`, `organization_id` referenciando `organizations`, `created_at`, `updated_at`, `archived_at`.
3. `alter table … enable row level security` + políticas `select`/`insert`/`update` con `is_member()` o `is_owner()`. **Sin `delete`.**
4. `create trigger audit after insert or update … execute function log_activity();` **en la misma migración** (una tabla que recibe filas antes del trigger pierde ese historial para siempre).
5. Si hay importes: `numeric`. Si hay algo calculable: vista con `security_invoker = true`, no columna.
6. Prueba pgTAP en `supabase/tests/` con al menos: aislamiento entre organizaciones, rol, `insert` auditado. Usa `throws_ok` con **cuatro argumentos** (sql, código, mensaje, descripción). Corre con `supabase test db`, no con `psql`.
7. Añade la tabla a `lib/export/tables.ts` (la prueba `tests/integration/export-manifest.test.ts` falla si el catálogo y el manifiesto de exportación divergen) y, si tiene `archived_at`, decide si entra en `lib/activity/unarchive.ts`.
8. `graphify update .` y regenerar tipos si aplica.

Detalle en `supabase/README.md`.

### 7.4 Funciones RPC de escritura

Las escrituras compuestas van por funciones `security invoker` con `on conflict (id) do nothing` para ser idempotentes desde la cola sin conexión: `create_order`, `update_order`, `create_direct_sale`, `archive_status`, `accept_invitation`, `record_export`. Los errores de la base se traducen a mensajes de usuario en `lib/<dominio>/errors.ts` por código o texto de la restricción.

---

## 8. Estados configurables

- Tabla `statuses` con `flow` (`order` / `task`), `business_line_id` (nulo = juego de la organización), `kind` ∈ `initial | in_progress | waiting | final | cancelled`, `position`, `color`, `is_queue` (solo si `kind = 'waiting'`).
- `resolve_statuses(org, line, flow)` devuelve el juego de la línea si tiene estados activos; si no, el de la organización. Es lo que pinta las columnas de ambos tableros: **no hay ninguna lista de estados en TypeScript.**
- Trigger `status_set_integrity` (diferido): todo juego con estados activos necesita al menos un `initial` y un `final`. Nombre único por juego (`unique nulls not distinct (organization_id, business_line_id, flow, name)`).
- Archivar un estado en uso exige destino (`archive_status(p_status_id, p_move_to)`).
- Juegos por defecto en `lib/statuses/default-sets.ts`; rótulos de tipo en `lib/statuses/kinds.ts`.
- **Toda lógica compara por `kind`**: retraso de pedidos (`lib/orders/overdue.ts`: solo `initial` / `in_progress`), cierre de tareas (`final`), avisos de revisión (`waiting`), cola (`is_queue`).

---

## 9. Interfaz: convenciones de frontend

- **shadcn/ui** en `components/ui/` (Radix). Estilos con Tailwind 4 y `cn()` de `lib/utils.ts`.
- **Estados de ruta obligatorios**: todo segmento con `page.tsx` y datos tiene `loading.tsx` (esqueleto con `RouteLoading` + skeletons, `role="status"`, sin spinner) y `error.tsx` (`RouteError` con reintentar). `app/route-states.test.tsx` lo exige recorriendo `app/` en disco.
- **Estados vacíos**: `components/shared/empty-state.tsx` (vacío inicial, con acción) y `filtered-empty-state.tsx` (*Sin resultados* + *Quitar filtros*). Nunca confundirlos.
- **Filtros en la URL**, no en stores (`hooks/use-filter-state.ts`): las vistas son enlazables y el botón atrás funciona. Excepción deliberada: la selección de contacto en `/contacts` es estado de UI.
- **Paginación por ventana** (`lib/pagination.ts`): todo lo abierto + N cerrados; `LoadMore` como navegación (`?closed=`, `?limit=`, cursor en bitácora).
- **Ocultar, no deshabilitar**: lo que un rol no puede usar no se rinde (`components/layout/nav-entries.ts` es la fuente única de navegación para escritorio y móvil, con `roles` por entrada).
- **Rutas de captura** (`isCaptureRoute`): en formularios de alta/edición no se rinden la barra inferior ni el botón *+ Registrar*.
- **Optimismo con reversión**: tableros (`stores/board-store.ts`), selector de línea, saldo de cobros.
- **Accesibilidad**: `aria-label` en controles sin texto, alternativa de teclado al arrastre (menú *Mover a*), diálogos de Radix. axe-core corre en e2e.
- **`data-testid`** estables para e2e (`line-selector`, `sync-indicator`, `quick-add-task`, `fair-product`…). No renombrarlos sin actualizar las specs.
- **Formato**: `lib/format/` para moneda (sin símbolo, dos decimales) y fechas en la zona de la organización (`organizations.timezone`).
- **Descripciones de la bitácora**: `lib/activity/describe.ts` genera las frases en español; se reutiliza en el panel, en los bloques *Historial* y en `/activity`.

---

## 10. Modo sin conexión

Lectura obligatoria: `lib/offline/README.md`.

- **Outbox en Dexie** (`kamay-outbox`, tabla `outbox`, clave `++seq`). Una entrada guarda la intención (`operation` + `payload` serializable), el `recordId` generado en el cliente, `organizationId`, `userId`, `occurredAt`, `dependsOn` y `schemaVersion`.
- **Operaciones registradas** (`features/sync/operations.ts`): `order.create`, `order.update`, `directSale.create`, `inventory.consumption`, `inventory.adjustment`. Egresos, cobros y adjuntos **no** están en la cola (decisión de KAM-11).
- **Captura** (`lib/offline/capture.ts`): encola y espera un plazo corto (2 500 ms en pedidos, 0 ms en feria). Resultado `sent` / `queued` / `failed`.
- **Vaciado** (`drain.ts`): secuencial por `seq`, con candado; fallo transitorio (promesa rechazada) detiene y reintenta con backoff exponencial (1 s → 5 min, jitter, máximo 8 intentos); fallo permanente (`{ error }`) bloquea solo a sus dependientes. **Retenciones** calculadas, nunca persistidas (`hold.ts`): otra organización, otro usuario, versión de esquema, dependencia fallida.
- **Disparadores** (`features/sync/sync-provider.tsx`): al arrancar, al recuperar conexión (`hooks/use-online-status.ts` combina `navigator.onLine` con el resultado del último envío) y cada 30 s con pendientes. **No hay Background Sync** (Safari iOS).
- **Indicador y bandeja**: `features/sync/sync-indicator.tsx` / `sync-tray.tsx`; `stores/sync-store.ts` refleja Dexie con `dexie-react-hooks`.
- **Service worker** (`app/sw.ts`, compilado por `serwist.config.mjs` en `postbuild` porque el proyecto usa Turbopack): `/_next/static/*` CacheFirst; `/fair` NetworkFirst (única ruta de negocio cacheada, solo el cascarón); el resto NetworkOnly con fallback a `/offline`. No reintenta escrituras ni cachea datos. `next dev` no sirve un service worker utilizable: esas pruebas corren solo con `next build`.
- **Snapshot de feria** (`lib/fair/snapshot.ts`): al abrir la feria con red se guarda en Dexie el catálogo de la línea con `capturedAt`, y se calienta la caché del cascarón.
- **Regla de oro**: cambiar la forma de un `payload` obliga a registrar una **clave de operación nueva**; una entrada encolada antes del despliegue sigue con el formato viejo.

---

## 11. Notificaciones y trabajos programados

- Tipos (`lib/notifications/types.ts`): `due_summary`, `task_overdue`, `task_stalled`, `task_assigned`, `task_review`, `stock_below_min` (sin generador todavía). La decisión es una función pura sin red ni reloj (`lib/notifications/plan.ts`); la deduplicación por tarea/día está en `dedupe.ts`.
- Eventos inmediatos (asignación, revisión) se emiten desde las acciones de tareas (`services/notifications/emit-task-events.ts`). Los programados los produce `GET /api/notifications/daily` con service role, cada hora, protegido con `Authorization: Bearer $CRON_SECRET` en tiempo constante (`lib/notifications/cron-auth.ts`). Sin secreto configurado rechaza todo.
- **Quién llama al endpoint**: `pg_cron` dentro de Postgres (job `kamay-daily-notifications`, `0 * * * *`), porque el Cron de Vercel en plan Hobby solo permite frecuencia diaria. La URL y el secreto se leen del **Vault de Supabase** (`kamay_app_url`, `kamay_cron_secret`); si faltan, el job no llama a nadie. En local es inerte por diseño. Para probar a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3010/api/notifications/daily
```

- **Retención de bitácora**: `GET /api/activity/retention`, mensual, desde `vercel.json` (`0 4 1 * *`).
- **Correo**: puerto `lib/email/port.ts`, plantillas en `lib/email/templates.ts`, `MemoryMailer` para pruebas. `lib/email/resolve.ts` devuelve `null` hasta que exista el adaptador de Resend (pendiente KAM-17 1.2/4.2). La bandeja in-app es la garantía; el correo, el refuerzo.
- La campana carga las últimas 50 en `app/(app)/layout.tsx` (sin realtime). Preferencias por persona en `notification_preferences` (RLS `user_id = auth.uid()`).

---

## 12. Bitácora, retención y exportación

- `activity_log`: `organization_id`, `table_name`, `record_id`, `action` (`created | updated | status_changed | archived | unarchived | exported`), `changes jsonb` (solo campos cambiados), `actor_id`, `business_line_id`, `occurred_at`. Ediciones seguidas del mismo actor se fusionan en 5 min. `authenticated` no puede `insert`/`update`/`delete`/`truncate`; solo lee el dueño.
- `lib/activity/describe.ts` y `diff.ts` producen frase y antes/después; `RECORD_KINDS` rotula los 24 tipos de registro.
- **Retención** (`services/activity/retention-service.ts`): por organización, lee el plazo (`organizations.settings.activity_retention`, por defecto 12 meses), exporta los eventos vencidos al bucket `activity-exports`, **vuelve a descargar y verifica** el archivo y solo entonces llama a `purge_activity_detail()` (solo `service_role`). Nunca borra filas.
- **Exportación completa** (`services/export/export-service.ts`, `lib/export/tables.ts`): ZIP con un CSV por tabla (RFC 4180, BOM, CRLF), leído con la sesión de quien pide (RLS decide qué sale), sin tope de filas, paginado de 1 000. El dueño recibe además `bitacora-purgada/`. Registra el hecho con `record_export()`.
- **Exportaciones de reportes y bitácora**: route handlers que **vuelven a ejecutar la lectura** con los parámetros de la URL en vez de serializar lo pintado; la bitácora devuelve 413 si el rango supera `MAX_EXPORT_ROWS`.

---

## 13. Pruebas

### 13.1 Niveles

| Nivel | Dónde | Comando | Notas |
| --- | --- | --- | --- |
| Unitarias | `*.test.ts(x)` junto al código | `npm run test:unit` | jsdom, Testing Library, `fake-indexeddb` para la cola. `server-only` se neutraliza con un alias (ver `vitest.config.ts`). |
| Integración (app) | `tests/integration/` | `npm run test:integration` | Contra Supabase local. Usa `seedOrganization`/helpers para crear su propia organización; algunas escriben en Geeko Store. |
| Integración (base) | `supabase/tests/*.test.sql` | `supabase test db` | pgTAP. `throws_ok` con 4 argumentos. No usar `psql` para correrlas. |
| End-to-end | `tests/e2e/*.spec.ts` | `npm run test:e2e` | Playwright, proyectos `desktop` y `mobile` (Pixel 7); `deployment` aparte. ~18 min. Levanta `npm run dev` solo (`reuseExistingServer`). |

**Una sola base local para todo**: los worktrees paralelos y los e2e comparten el mismo Supabase. Si aparece `502 upstream` es Kong/PostgREST saturado, no la prueba.

### 13.2 Convenciones e2e

- Helpers en `tests/e2e/helpers/`: `test.ts` (fixture con `geeko()` → dueña y ayudante), `fresh-org.ts` (`createFreshOrganization()` para vacíos iniciales), `seed-copies.ts`, `png.ts`. Contraseña `E2E_PASSWORD = "kamay123"`.
- **Toda prueba crea su propia organización** cuando necesita datos propios; `adminClient()` solo para preparar, nunca para afirmar.
- Lo que exige cargar sin red se salta fuera de CI: `test.skip(!process.env.CI, "necesita la compilación de producción")`.
- `@performance` solo en móvil, contra la semilla *Kamay Rendimiento* (`supabase/seeds/performance.sql`), con CPU ×4 y 4G lenta.
- `accessibility.spec.ts` corre axe-core en ambos temas y proyectos; falla ante *critical*/*serious*.

### 13.3 Cobertura

Objetivo 90 % en `lib/` y `services/` (`@vitest/coverage-v8`). No se persigue cobertura en componentes.

---

## 14. Integración continua y despliegue

### 14.1 CI (`.github/workflows/ci.yml`)

En cada PR y push a `main`: `npm ci` → lint → typecheck → unitarias → `supabase start` → derivar variables (`supabase status -o env`, tolera nombres antiguos y nuevos de llaves; genera `CRON_SECRET` por corrida) → integración app → `supabase test db` → build → `check:bundle` → e2e sin `@performance` → proyecto `deployment` con `E2E_DEPLOYMENT=1`. Sube `playwright-report/` si falla.

`.github/workflows/stability.yml` (push a `main` y manual): suite completa **sin reintentos y repetida 3 veces**, y después la medición `@performance`. Una prueba que pase en una vuelta y falle en otra rompe el trabajo con su nombre.

> Estado real: ambos workflows existen y están bien construidos, pero **nunca han corrido en GitHub** (KAM-23 13.1).

### 14.2 Despliegue (Vercel + Supabase alojado)

- `vercel.json` solo declara el cron de retención. `.vercelignore` excluye worktrees, `.next`, artefactos y **todo `.env*`**.
- `next.config.ts`: `poweredByHeader: false`, `X-Robots-Tag: noindex, nofollow` en todo, cabeceras de `sw.js` (`no-store`, CSP), `bodySizeLimit: 6mb` para fotos, `KAMAY_RELEASE` desde `VERCEL_GIT_COMMIT_SHA`, y `assertEnv()` **al compilar** (no en `instrumentation.ts`: el proxy no recibe variables de servidor en Vercel).
- Variables por ambiente en Vercel (Preview nunca con llaves de producción). Lista en `.env.example`.
- En Supabase alojado hay que: aplicar migraciones (`supabase db push`), registrar el hook `before user created`, cargar `kamay_app_url` y `kamay_cron_secret` en el Vault, y crear los buckets si la migración no los crea.
- Monitoreo: `lib/monitoring/` con `onRequestError` (`instrumentation.ts`) y scope de navegador; falta elegir proveedor y llamar a `setMonitoringTransport()`.
- Recuperación desde copia: procedimiento y bitácora de ensayos en `docs/recuperacion.md`.

---

## 15. Flujo de trabajo: OpenSpec y Graphify

- **Ningún cambio sin OpenSpec.** Cada funcionalidad entra por `openspec/changes/<id>/` con `proposal.md` (con *fuera de alcance* cerrado), `design.md`, `specs/` (delta) y `tasks.md`; cada escenario del delta tiene al menos una prueba referenciada. Al terminar se archiva (`openspec/changes/archive/`) y las specs se consolidan en `openspec/specs/`.
- Skills disponibles en el asistente: `/opsx:propose`, `/opsx:apply`, `/opsx:update`, `/opsx:sync`, `/opsx:archive`, `/opsx:explore`.
- Antes de diseñar esquema, **revisar los cambios hermanos** en `openspec/changes/` (sesiones paralelas pueden estar tocando las mismas tablas).
- **Graphify**: `graphify-out/` está versionado; el gancho post-commit lo actualiza. Tras cualquier migración: `graphify update .`. Consulta el radio de impacto antes de tocar `services/`, `lib/supabase/` o políticas RLS.
- Autoridad documental: `specs/PRD/kamay-especificacion-producto-v6.md` (qué) > `openspec/specs/` (cómo se verifica) > código. `ARCHITECTURE.md` está parcialmente desactualizado (ver estado de la plataforma).

---

## 16. Cómo agregar una funcionalidad (receta)

1. **Proponer**: `/opsx:propose <nombre>`; revisar `proposal.md`, copiar la sección *Fuera de alcance* del backlog si existe.
2. **Esquema** (si aplica): migración nueva + pgTAP + `lib/export/tables.ts` + `graphify update .` (§7.3).
3. **Servicio**: clase en `services/<dominio>/` con `SupabaseClient` inyectado; `organization_id` en toda consulta; mapeo a DTOs de `types/`.
4. **Esquema Zod** en `lib/<dominio>/schema.ts`, compartido entre formulario y acción; traducción de errores de la base en `lib/<dominio>/errors.ts`.
5. **Acción** en `actions/<dominio>.ts`: `getSessionContext()` u `getOwnerContext()`, validar, llamar al servicio, `revalidatePath`. Devolver `{ error }` para fallos de negocio (así la cola sin conexión los clasifica como permanentes).
6. **Pantalla** en `features/<dominio>/`; página en `app/(app)/…/page.tsx` con `loading.tsx` y `error.tsx`; estados vacío y filtrado; filtros en la URL; textos en español; `data-testid` para lo que el e2e necesite.
7. **Navegación**: entrada en `components/layout/nav-entries.ts` con sus `roles`; si es solo dueño, guardia en el layout o página.
8. **Si debe capturarse sin conexión**: registrar la operación en `features/sync/operations.ts`, RPC idempotente, `capture()` en vez de llamar a la acción.
9. **Pruebas**: unitarias de la lógica pura, pgTAP de la migración, e2e del recorrido (con organización propia), y referencia de cada escenario en `tasks.md`.
10. **Cerrar**: lint, typecheck, unitarias, integración, `supabase test db`, build, e2e; archivar el cambio.

---

## 17. Trampas conocidas

- **Next 16**: `params` y `searchParams` son promesas; el middleware es `proxy.ts`; `next typegen` corre dentro de `typecheck` y carga `next.config.ts` (por eso la validación de entorno se salta en `typegen`).
- **Turbopack + Serwist**: el service worker no se compila con el plugin de webpack; lo hace `postbuild`. Con `npm run dev` no hay service worker utilizable.
- **`server-only` en Vitest** se neutraliza por alias; la guardia real es `next build` y `check:bundle`.
- **Cookies httpOnly**: el store de línea de negocio no persiste nada; la cookie es la memoria y solo la escribe el servidor.
- **`activity_log` no se reconstruye**: el trigger va en la misma migración que crea la tabla.
- **Semilla de Geeko Store** es fixture de muchas pruebas; los doce meses de historia viven en *Kamay Histórico* a propósito. No añadas pedidos a Geeko en la semilla sin revisar los e2e de tablero.
- **`TRUNCATE`** está revocado a los roles de la API en todas las tablas y en los privilegios por defecto; no lo concedas al crear tablas.
- **Cambiar un `payload` de la cola** sin nueva clave de operación rompe entradas encoladas antes del despliegue.
- **Los cambios de estado nunca crean tareas.** Cualquier propuesta de sincronizar tableros se rechaza en revisión.
- **Zona horaria**: "hoy" se calcula con `organizations.timezone` en el servidor, no con la del navegador.
- **Intermitencia conocida**: `tests/integration/reports.test.ts` puede fallar cuando `task-deliverables.test.ts` escribe en Geeko en paralelo.
