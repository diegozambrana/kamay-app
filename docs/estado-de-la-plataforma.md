# Kamay · Estado de la plataforma

> Punto de entrada para el siguiente sprint. Revisa cada vista, cada ticket del backlog (KAM-01 a KAM-23) y resume qué está implementado, qué falta y qué se recomienda hacer a continuación.
>
> Fecha de la revisión: **2026-09-13** · rama `docs` · último commit `ca26f8c` (KAM-23).
>
> Documentos relacionados: [Manual de uso](manual-de-uso.md) · [Manual de pruebas](manual-de-pruebas.md) · [Documento técnico](documento-tecnico.md) · backlog original en `specs/PRD/kamay-backlog.md`.

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estado por vista](#2-estado-por-vista)
3. [Estado por ticket](#3-estado-por-ticket)
4. [Hallazgos y huecos](#4-hallazgos-y-huecos)
5. [Calidad y verificación](#5-calidad-y-verificación)
6. [Decisiones fuera de alcance (no son deuda)](#6-decisiones-fuera-de-alcance-no-son-deuda)
7. [Propuesta para el siguiente sprint](#7-propuesta-para-el-siguiente-sprint)

---

## 1. Resumen ejecutivo

- **Las 23 vistas del mapa de navegación (V1–V23) están implementadas** y se pueden recorrer de punta a punta en escritorio y móvil, con los dos roles.
- **Los 23 tickets del backlog tienen su cambio de OpenSpec.** 22 están archivados (completos). **KAM-23 sigue abierto**: lo que le falta no es código sino **operación de producción** (variables en Vercel, dominio, monitoreo con proveedor, copias de seguridad fuera del proveedor, ensayo de restauración con copia real, primera corrida de CI). **KAM-24** (menú de cuenta y perfil, fuera del backlog original, nacido del hallazgo F1) también está completo.
- De 1 296 tareas de OpenSpec, quedan **18 sin marcar**: 14 de KAM-23, 2 de KAM-17 (correo transaccional), 1 de KAM-10 y 1 de KAM-04 (ambas de verificación).
- **No hay un solo `TODO`, `FIXME` ni `@ts-ignore` en el código de producción.** Toda excepción de lint lleva su motivo escrito.
- **El pipeline de CI existe pero nunca ha corrido en GitHub.** Todo el verde (unitarias, pgTAP, e2e) está demostrado solo en local.
- **Huecos funcionales reales** (detalle en §4): no se envían correos; no hay botón para archivar pedidos ni tareas desde la interfaz; el aviso *Insumo bajo mínimo* y el campo *Recordatorio* de tareas no disparan nada; no existe el buscador global que el mapa de navegación describe; cambiar de organización sigue siendo solo por URL directa; el trabajo horario de avisos es inerte hasta cargar dos secretos en el Vault de Supabase.

Nivel de madurez: **funcionalmente completo para las fases 0 a 4; pendiente de puesta en producción y de un sprint de cierre de huecos de interfaz.**

---

## 2. Estado por vista

Leyenda: ✅ implementada y verificada por e2e · ⚠️ implementada con observación · ❌ no existe.

| Vista | Ruta | Estado | Observaciones |
| --- | --- | --- | --- |
| V1 Inicio de sesión / selección de organización | `/auth/login`, `/auth/select-org`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/invite/[token]` | ✅ | Sin registro público (hook en base). ⚠️ Cambiar de organización solo por URL directa (no hay conmutador desde el menú de cuenta). |
| V2 Panel | `/dashboard` | ⚠️ | Dos composiciones por rol, presupuesto de carga medido. **Las tarjetas de indicadores y el comparativo no enlazan a Reportes** (prop `reportsHref` nunca se pasa desde `app/(app)/dashboard/page.tsx`), pese a que el mapa §6 lo declara. |
| V3 Tablero de pedidos | `/orders` (tablero, lista, calendario) | ✅ | Columnas por juego de estados; cola; teclado; ventana abiertos + 50 cerrados. ⚠️ **Sin botón Archivar** en ninguna pantalla de pedidos (solo restaurar desde la bitácora). |
| V4 Detalle de pedido | `/orders/[id]` | ✅ | Estado, cancelar, cobros, imágenes, tareas relacionadas, historial. |
| V5 Alta / edición de pedido | `/orders/new`, `/orders/[id]/edit` | ✅ | Captura sin conexión, guardia de descarte, guardar y crear otro. Personalización estructurada quedó como nota + foto (decisión del backlog). |
| V6 Modo feria | `/fair` | ✅ | Cascarón propio, snapshot del catálogo, cola idempotente. |
| V7 Bandeja de egresos | `/expenses` | ⚠️ | Solo dueño. **El badge de estado de pago reutiliza los rótulos de cobro** (*Sin cobrar* en lugar de *Sin pagar*) en la tabla de egresos. |
| V8 Nueva compra | `/expenses/purchases/new` | ✅ | Genera entradas de inventario por trigger; ofrece declarar activo. |
| V9 Nuevo gasto | `/expenses/costs/new` | ✅ | 5 interacciones o menos; General por defecto. |
| V10 Catálogo | `/catalog` | ✅ | Tres tipos, búsqueda sin tildes, miniaturas WebP, paginación. |
| V11 Detalle de ítem | `/catalog/[id]` | ✅ | Variantes, foto, inventario, precios de compra, declarar activo. |
| V12 Activos | `/assets` | ✅ | Recuperación acotada 0–100 %. Activo compartido sin barra (esperaba la regla de reparto; hoy existe en Reportes pero no se aplica aquí). |
| V13 Contactos | `/contacts` | ✅ | Dos paneles, creación al vuelo. |
| V14 Reportes | `/reports` | ⚠️ | Cinco informes, CSV. **Rentabilidad rotula los pedidos con el UUID truncado** (*Pedido a0000000*) en lugar del número visible (#1). El CSV lleva el UUID completo. |
| V15 Configuración | `/settings/*` (10 secciones) | ✅ | General, líneas, canales, categorías, unidades, estados, usuarios, retención, notificaciones, exportar. ⚠️ Membresías archivadas (*Sin acceso*) sin restauración desde la interfaz. |
| V16 Registro rápido | `/quick` | ✅ | Seis destinos; *Registrado hoy* mezcla servidor y cola. |
| V17 Tablero de tareas | `/tasks` | ⚠️ | Alta rápida en 3 interacciones. **`archiveTask` existe sin ningún llamador**: no se puede archivar una tarea desde la interfaz aunque el filtro *Ver archivadas* y los textos de tarea archivada existan. |
| V18 Detalle de tarea | `/tasks/[id]` | ⚠️ | Markdown, adjuntos, vínculos, entregables. **El campo Recordatorio se guarda pero ningún generador lo lee.** |
| V19 Asistente de cierre | diálogo en `/tasks/[id]?close=` | ✅ | Tres salidas con igual jerarquía; nunca bloquea. |
| V20 Mis pendientes | `/my-tasks` | ✅ | Grupos por fecha, gesto de posponer. |
| V21 Notificaciones | campana + `/settings/notifications` | ⚠️ | Cinco tipos generados; **`stock_below_min` anunciado y no generado**; **sin correo** (ver KAM-17). |
| V22 Estados configurables | `/settings/statuses` | ✅ | Por organización y por línea, tipos, cola, archivado con destino. |
| V23 Bitácora | `/activity` | ✅ | Filtros en URL, exportación, retención mensual, desarchivar desde el evento. |
| Perfil de cuenta (KAM-24) | `/profile` | ✅ | Menú de avatar (barra superior y panel "Más" móvil) con **Perfil** y **Cerrar sesión**; cambiar nombre visible y contraseña (con verificación de la actual). Cerrar sesión con registros sin sincronizar pide confirmación. |
| Página sin conexión | `/offline` | ✅ | Servida por el service worker. |
| Elementos "siempre disponibles" del mapa §4.1 | barra superior | ⚠️ | El **menú de avatar** ya existe (KAM-24: perfil, cerrar sesión). Sigue sin **buscador global** ni conmutador de organización desde el menú (F11, F14). |

Rutas descritas en `specs/PRD/ARCHITECTURE.md` que **no** existen (el documento está desactualizado frente al código): `/catalog/new`, `/catalog/[id]/edit`, `/assets/new`, `/assets/[id]`, `/contacts/new`, `/contacts/[id]`, `/reports/[tab]`, `/tasks/mine`, `/settings/users`, `/settings/data`. Sus equivalentes reales son diálogos, paneles laterales o rutas con otro nombre (`/my-tasks`, `/settings/members`, `/settings/export`).

---

## 3. Estado por ticket

Fuente: `specs/PRD/kamay-backlog.md` y `openspec/changes/archive/*/tasks.md`.

| Ticket | Título | Cambio OpenSpec | Tareas pendientes | Estado |
| --- | --- | --- | --- | --- |
| KAM-01 | Andamiaje y disciplina de trabajo | archivado | 0 | ✅ Completo. CI definido; ⚠️ nunca ejecutado en GitHub (ver KAM-23 13.1). |
| KAM-02 | Autenticación, organizaciones y aislamiento | archivado | 0 | ✅ Completo. |
| KAM-03 | Bitácora desde el primer día | archivado | 0 | ✅ Completo. |
| KAM-04 | Configuración de la organización y semilla | archivado | 1 | ✅ Funcional. Pendiente 9.3: confirmar cobertura ≥ 90 % en `lib/` y `services/` (verificación, no funcionalidad). |
| KAM-05 | Estados configurables por línea | archivado | 0 | ✅ Completo. Semilla de *Impresión 3D* marcada como provisional, a confirmar con el negocio. |
| KAM-06 | Catálogo y directorio | archivado | 0 | ✅ Completo. |
| KAM-07 | Pedidos: tablero y detalle | archivado | 0 | ✅ Completo. Sin UI de archivar (ver §4). |
| KAM-08 | Alta y edición de pedidos | archivado | 0 | ✅ Completo. Personalización estructurada: decisión pendiente del negocio (nota + foto por ahora). |
| KAM-09 | Egresos: compras y gastos | archivado | 0 | ✅ Completo. |
| KAM-10 | Cobros y pagos | archivado | 1 | ✅ Funcional. Pendiente 8.3: e2e en verde de una sola pasada (resuelto de hecho por el trabajo de estabilidad de KAM-23). |
| KAM-11 | Infraestructura sin conexión | archivado | 0 | ✅ Completo. Adjuntos y cobros fuera de la cola por decisión. |
| KAM-12 | Modo feria y venta rápida | archivado | 0 | ✅ Completo. |
| KAM-13 | Registro rápido y navegación móvil | archivado | 0 | ✅ Completo. |
| KAM-14 | Panel principal y variante del ayudante | archivado | 0 | ✅ Completo. Enlaces a Reportes no cableados (§4). |
| KAM-15 | Tareas: modelo y tablero | archivado | 0 | ✅ Completo. Sin UI de archivar (§4). |
| KAM-16 | Detalle de tarea, Markdown y adjuntos | archivado | 0 | ✅ Completo. |
| KAM-17 | Mis pendientes, recordatorios y avisos | archivado | 2 | ⚠️ Funcional sin correo. Pendientes 1.2 (provisionar Resend) y 4.2 (adaptador `lib/email/resend.ts`). `lib/email/resolve.ts` devuelve `null` siempre. `stock_below_min` y `remind_at` sin generador. |
| KAM-18 | Inventario suave | archivado | 0 | ✅ Completo. |
| KAM-19 | Activos y recuperación de inversión | archivado | 0 | ✅ Completo. |
| KAM-20 | Reportes | archivado | 0 | ✅ Completo. Rótulo de pedido con UUID (§4). |
| KAM-21 | Vínculos y entregables de tareas | archivado | 0 | ✅ Completo. |
| KAM-22 | Bitácora: pantalla, filtros y retención | archivado | 0 | ✅ Completo. |
| KAM-23 | Endurecimiento y puesta en producción | **abierto** | 14 | ⚠️ Código terminado; **operación pendiente** (detalle abajo). |
| KAM-24 | Menú de cuenta y perfil | pendiente de archivar | 0 | ✅ Completo. Cierra F1 en su parte de cerrar sesión y perfil; el conmutador de organización (F14) sigue sin resolverse. |

### KAM-23 · lo que falta, punto por punto

Fuente: `openspec/changes/kam-23-hardening-production/tasks.md`.

| Tarea | Qué falta | Bloqueo |
| --- | --- | --- |
| 9.6 | Comprobar la primera ejecución de cada cron en producción | Requiere despliegue |
| 10.1 | Cargar las variables por ambiente (Preview / Production) en Vercel | El proyecto no está vinculado; `.env.example` ya está completo |
| 10.5 | Dominio propio con HTTPS y redirección | Requiere despliegue |
| 10.6 | Registrar el hook *before user created* en el proyecto alojado y verificarlo | Requiere despliegue |
| 11.1 | Elegir proveedor de monitoreo y llamar a `setMonitoringTransport()` | Decisión pendiente; el resto del cableado existe (`lib/monitoring`, `KAMAY_RELEASE`, `onRequestError`) |
| 12.1–12.3 | Destino de copias fuera del proveedor, flujo programado, periodicidad documentada | Sin empezar |
| 12.5–12.7 | Restauración desde una copia **real** de producción, comparar conteos, firmar el ensayo | El ensayo local del 2026-09-11 (`docs/recuperacion.md`) no cuenta para el criterio 4 |
| 13.1 | Toda la suite en verde **en CI** | CI nunca ha corrido |
| 13.3 | Repaso final de la definición de terminado | Se repite al cerrar |
| 13.4 | Archivar el cambio | Último paso |

Criterios de aceptación de KAM-23 con pregunta abierta:

- **Criterio 7** (*el panel carga en menos de 2 s en móvil de gama media con 12 meses*): se cumple en visita repetida (~350 ms) pero la **primera visita en frío mide ~2,4 s**. Queda registrado en `design.md` como pregunta abierta. Hay que decidir si el criterio aplica a la visita en frío.
- Prueba de integración intermitente `tests/integration/reports.test.ts` por escrituras paralelas de `task-deliverables.test.ts` sobre Geeko Store.

---

## 4. Hallazgos y huecos

Clasificados por severidad para priorizar. **Alta** = afecta el uso diario o la seguridad; **Media** = funcionalidad anunciada que no opera; **Baja** = pulido.

### 4.1 Funcionales

| # | Sev. | Hallazgo | Dónde | Recomendación |
| --- | --- | --- | --- | --- |
| F1 | ~~Alta~~ Baja | ~~No hay forma de cerrar sesión...~~ **Resuelto por KAM-24**: menú de avatar (barra superior y panel "Más" móvil) con **Perfil** y **Cerrar sesión**, y vista `/profile` para cambiar nombre visible y contraseña. Queda solo el **conmutador de organización** desde ese menú (sigue por URL directa, ver F14). | `features/account/`, `app/(app)/profile/` | Añadir "Cambiar de organización" al menú de cuenta, hacia `/auth/select-org`. Cambio pequeño. |
| F2 | Alta | **Ningún correo se envía**: recuperación de contraseña sí (la manda Supabase Auth), pero avisos de tareas no. `resolveMailer()` devuelve `null`. | `lib/email/resolve.ts:22` | Cerrar KAM-17 1.2 y 4.2: provisionar Resend y escribir el adaptador. Plantillas y puerto ya existen y están probados. |
| F3 | Media | **Pedidos: no se pueden archivar desde la UI.** `archiveOrder` / `unarchiveOrder` existen sin botón. La única restauración es desde la bitácora. | `actions/orders.ts`, `features/orders/order-detail.tsx` | Botón *Archivar* (solo dueño) en el detalle, con `ArchiveWarning` como en catálogo. |
| F4 | Media | **Tareas: no se pueden archivar desde la UI.** `archiveTask` sin llamador; filtro *Ver archivadas* sin contenido posible. | `actions/tasks.ts:204`, `tests/e2e/task-detail.spec.ts:245` | Botón *Archivar* en el detalle de tarea. |
| F5 | Media | Aviso **Insumo bajo mínimo** tiene interruptor en preferencias pero ningún generador lo emite. | `services/notifications/generator.ts`, `features/settings/notifications-section.tsx` | Añadir al plan horario una lectura de `item_balances.below_min` con deduplicación por ítem. |
| F6 | Media | Campo **Recordatorio** (`remind_at`) de tareas se guarda y valida pero no dispara nada. | `features/tasks/detail/task-fields.tsx`, `lib/notifications/plan.ts` | Nuevo tipo de aviso `task_reminder` en el plan horario, o retirar el campo hasta implementarlo. |
| F7 | Media | El **trabajo horario de avisos no llama a nadie** hasta que existan `kamay_app_url` y `kamay_cron_secret` en el Vault de Supabase. En local es inerte por diseño. | `supabase/migrations/20260913143843_daily_notifications_url_from_vault.sql` | Documentado en el [documento técnico](documento-tecnico.md#11-notificaciones-y-trabajos-programados); cargar los secretos al desplegar (KAM-23 9.6). |
| F8 | Media | **Panel no enlaza a Reportes**: `reportsHref` nunca se pasa; el comentario dice *ausente mientras V14 no exista* pero V14 existe. | `app/(app)/dashboard/page.tsx`, `features/dashboard/indicator-cards.tsx`, `line-comparison.tsx` | Pasar `reportsHref="/reports"` desde la página del dueño. Cambio de una línea. |
| F9 | Baja | Reporte de **Rentabilidad rotula pedidos con el UUID truncado** (*Pedido a0000000*) en vez de *#1*. | `app/(app)/reports/page.tsx` (`orderLabels`) | Devolver `code` desde `report_profitability` o resolverlo en la página. |
| F10 | Baja | Tabla de **egresos muestra *Sin cobrar*** (rótulo de pedidos) donde correspondería *Sin pagar*. | `features/payments/payment-status-badge.tsx` usado desde `features/expenses/` | Parametrizar el badge por dirección (`in` / `out`). |
| F11 | Baja | **Buscador global** descrito en el mapa de navegación §4.1 no existe; ningún ticket lo cubre. El menú de avatar sí existe desde KAM-24. | `specs/PRD/kamay-mapa-navegacion-ui.md` | Decidir si entra o se retira del mapa. |
| F12 | Baja | Membresías archivadas (**Sin acceso**) no se pueden restaurar desde la interfaz. | `features/settings/members-section.tsx` | Botón *Restaurar* o documentar que se reinvita. |
| F13 | Baja | Activo de línea **Compartido** no calcula recuperación aunque la regla de reparto de KAM-20 ya existe. | `features/assets/`, `lib/assets/recovery.ts` | Aplicar la regla de reparto al margen atribuible. |
| F14 | Baja | Selección de organización solo por URL; no hay conmutador. | — | Se resuelve con F1. |

### 4.2 Técnicos y de repositorio

| # | Sev. | Hallazgo | Recomendación |
| --- | --- | --- | --- |
| T1 | **Alta** | El remoto `origin` de git tiene un **token personal de GitHub incrustado en la URL** (`https://ghp_…@github.com/...`). Cualquiera con acceso a la máquina o a un volcado de `.git/config` obtiene el token. | Revocar ese token en GitHub y reconfigurar el remoto con SSH o con el gestor de credenciales. |
| T2 | Media | `.claude/worktrees/` contiene tres copias completas del repositorio con código desfasado (varios GB). No afectan el build (están en `.vercelignore`) pero duplican cualquier búsqueda. | Borrar los worktrees terminados. |
| T3 | Media | `specs/PRD/ARCHITECTURE.md` lista rutas, carpetas de acciones y suites e2e con nombres que no coinciden con el código (ver §2). | Actualizar el documento o marcarlo como histórico; el [documento técnico](documento-tecnico.md) refleja el estado real. |
| T4 | Media | CI define Node 24, pero la máquina de desarrollo usa Node 20.19 y `package.json` no declara `engines`. | Añadir `engines.node` y un `.nvmrc`. |
| T5 | Baja | `README.md` es la plantilla de `create-next-app`. | Sustituir por un índice que apunte a `docs/`. |
| T6 | Baja | `playwright.zz-prod.config.ts` está sin versionar en la raíz. | Decidir si se versiona (con documentación) o se elimina. |
| T7 | Baja | Existe `.env.production copy.local` junto a `.env.production.local`. Ambos están ignorados por git, pero contienen la clave de service role de producción en disco. | Eliminar la copia. |
| T8 | Baja | La semilla de estados de *Impresión 3D* está marcada como provisional (`supabase/seed.sql:189`). | Confirmar con el negocio. |

---

## 5. Calidad y verificación

Cifras tomadas del repaso de KAM-23 del 2026-09-11 (local):

| Nivel | Cantidad | Estado |
| --- | --- | --- |
| Pruebas unitarias | ~2 075 | En verde en local |
| pgTAP | 64 archivos, ~924 aserciones | En verde en local; recorren el catálogo de la base (toda tabla nueva queda sujeta a las reglas) |
| Integración (app) | 15 archivos | En verde; una intermitente conocida (`reports.test.ts`) |
| End-to-end | 34 archivos × 2 proyectos (escritorio y móvil) ≈ 624 casos | En verde dos veces seguidas sin reintentos, en local |
| Accesibilidad | axe-core WCAG 2.1 AA en las vistas principales, ambos temas | Sin violaciones críticas ni serias |
| Rendimiento | Panel con 12 meses, móvil gama media | ~350 ms visita repetida; ~2,4 s en frío |
| Cobertura | Objetivo 90 % en `lib/` y `services/` | No confirmada (KAM-04 9.3) |
| CI en GitHub | `ci.yml` + `stability.yml` | **Nunca ejecutados** |

Verificación del anexo de base de datos (§20 del esquema): **12 de 12 puntos** en verde, con tres hallazgos corregidos por migración (`TRUNCATE` revocado, índice de `tasks` por línea, política de lectura del bucket de exportaciones). Detalle en `docs/anexo-bd-verificacion.md`.

---

## 6. Decisiones fuera de alcance (no son deuda)

Registradas en los `proposal.md` y en el backlog; no deben "arreglarse" sin una decisión de producto:

- **Lectura sin conexión**: solo se garantiza la captura; las pantallas no se cachean (KAM-11).
- **Adjuntos y cobros fuera de la cola sin conexión** (KAM-11).
- **Feria sin descuentos, impuestos ni cliente obligatorio** (KAM-12).
- **Un pedido nunca genera una tarea automáticamente**; tableros independientes (convención 10).
- **Encadenar entregables** (KAM-21).
- **Personalización estructurada del pedido**: nota + foto hasta que el negocio decida (KAM-08).
- **`tasks`, `item_variants` y `asset_details` no se desarchivan desde la bitácora** (KAM-22).
- **Fases 5 y 6** del producto (recetas, lotes con merma, cotizaciones, seguimiento público, plataformas externas) no entran hasta que las fases 0–4 estén en uso real.

---

## 7. Propuesta para el siguiente sprint

Ordenada por valor y riesgo. Cada punto debe entrar como un cambio de OpenSpec.

### P0 · Poner en producción (cerrar KAM-23)

1. Revocar y reemplazar el token del remoto git (T1). Media hora.
2. Vincular el proyecto en Vercel, cargar variables por ambiente, dominio con HTTPS (10.1, 10.5).
3. Registrar el hook de alta y los dos secretos del Vault en el Supabase alojado; comprobar la primera corrida de los crons (9.6, 10.6, F7).
4. Abrir un PR de prueba para que **CI corra por primera vez** y corregir lo que aparezca (13.1).
5. Elegir proveedor de monitoreo y conectarlo (11.1).
6. Copias de seguridad fuera del proveedor + ensayo de restauración con copia real, firmado en `docs/recuperacion.md` (12.1–12.7).
7. Decidir el criterio 7 (carga en frío) y archivar el cambio (13.3, 13.4).

### P1 · Cerrar los huecos de interfaz que el usuario nota

8. **Cambiar de organización** desde el menú de cuenta (F1 remanente, F14); el resto del menú —perfil, cerrar sesión— ya lo cierra KAM-24.
9. **Correo transaccional** con Resend (F2, KAM-17 1.2/4.2).
10. Botón **Archivar** en pedidos y tareas (F3, F4).
11. Enlaces del panel a Reportes (F8) y rótulo *#N* en rentabilidad (F9). Cambios pequeños, alto retorno.

### P2 · Completar lo anunciado

12. Aviso **Insumo bajo mínimo** (F5) y **recordatorios** de tareas (F6).
13. *Sin pagar* en egresos (F10), restaurar membresías (F12), recuperación de activos compartidos (F13).
14. Decidir buscador global (F11) y actualizar `ARCHITECTURE.md` (T3).

### Higiene

15. `engines` + `.nvmrc` (T4), README real (T5), limpiar worktrees y archivos sueltos (T2, T6, T7), confirmar cobertura ≥ 90 % (KAM-04 9.3).

### Cómo retomar el trabajo

1. Leer `openspec/project.md` (constitución) y el [documento técnico](documento-tecnico.md).
2. Abrir `openspec/changes/kam-23-hardening-production/tasks.md` y trabajar las tareas sin marcar en el orden de arriba.
3. Para cada hueco de §4, crear el cambio con `/opsx:propose`, copiando la sección *Fuera de alcance* del backlog cuando exista.
4. Antes de tocar el esquema: migración nueva + pgTAP + `graphify update .`.
