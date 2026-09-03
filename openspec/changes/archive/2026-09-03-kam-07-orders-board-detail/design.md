# Diseño · KAM-07 · Pedidos: tablero y detalle

## Context

Motivación en `proposal.md` — *Why*. Requisitos en `specs/orders/spec.md`. Este documento resuelve las decisiones técnicas que esos dos dejan abiertas.

Lo que ya está construido y este cambio consume tal cual:

- `resolve_statuses(org, line, 'order')` y `StatusService.resolve()` (KAM-05) — la única vía de lectura del juego vigente. Las columnas del tablero salen de ahí.
- `is_queue` sobre estados de `kind = 'waiting'` (KAM-05), con la restricción `queue_only_when_waiting` ya en la base.
- `contacts`, `items`, `item_variants` y `attachments` con el bucket `attachments` (KAM-06, fusionada). **La precondición que `proposal.md` declaraba pendiente ya está satisfecha**; esa nota del apartado *Impact* quedó obsoleta.
- `enforce_archive_rules()` (KAM-06): trigger reutilizable que exige `is_owner()` para tocar `archived_at` y congela los registros archivados.
- `log_activity()` (KAM-03) y el patrón de RLS sin `DELETE` (KAM-02).
- `resolveActiveLine()` / `findActiveLine()` (KAM-04) y la cookie `httpOnly` de línea activa.
- `@dnd-kit/core` + `@dnd-kit/sortable`, ya en `package.json` y ya usados para reordenar estados en V22. **No hace falta ninguna dependencia nueva**; corrige lo que `proposal.md` anotaba como decisión pendiente en *Impact*.

## Goals / Non-Goals

**Goals:**

- Que el flujo de trabajo viva en datos, no en código: ninguna lista de estados escrita a mano, ninguna rama `if (línea === …)`.
- Que las tres garantías duras vivan en la base y no repartidas por servicios: numeración sin duplicados, total derivado, y quién puede archivar.
- Que arrastrar una tarjeta se sienta instantáneo y que un fallo del servidor sea visible y reversible, no silencioso.

**Non-Goals:**

- Alta y edición de pedidos, incluida la subida de adjuntos (KAM-08). Aquí se leen y se muestran los adjuntos que la semilla deja; el formulario de subida no entra.
- Todo lo que dependa de `payments` (KAM-10), `expenses` (KAM-20) o `tasks` (KAM-21).
- Sincronización sin conexión (KAM-11). El diseño no la implementa, pero no la estorba: los UUID los genera el cliente y `code` no es la llave primaria.

## Decisions

### D1 · Con la línea «Todas» activa, el kanban pide elegir una línea; lista y calendario sí cruzan

Un kanban necesita **un** juego de columnas, y con `ALL_LINES` no existe: Sublimación tiene seis estados y Alfarería tres, sin correspondencia entre ellos. Decisión: con «Todas» activa, la vista de tablero muestra un aviso invitando a elegir una línea (con los botones de las líneas vigentes a mano), mientras que **lista y calendario sí muestran los pedidos de todas las líneas**, porque no dependen de columnas. Al elegir una línea el tablero aparece; la preferencia de vista se conserva.

- *Alternativa: columnas fijas agrupadas por `kind`.* Rechazada: produce un tablero que nadie usa —mezcla líneas que no comparten flujo— y obliga a deshabilitar el arrastre, porque no hay un estado destino único al que mover la tarjeta.
- *Alternativa: caer al juego de la organización.* Rechazada: los pedidos de las líneas con juego propio desaparecerían del tablero sin explicación. Ocultar datos en silencio es peor que pedir una elección.

**Esta decisión no está en los criterios del backlog: se tomó por defecto para desbloquear el diseño y es la más barata de revertir** — vive en un solo componente de `features/orders/`.

### D2 · `code` lo asigna un trigger que bloquea la fila de la organización

`before insert` sobre `orders`: `select 1 from organizations where id = new.organization_id for update`, y luego `coalesce(max(code), 0) + 1` dentro de esa organización. El bloqueo de fila serializa solo a los que insertan en la misma organización; dos organizaciones distintas no se estorban. `unique (organization_id, code)` queda como red de seguridad, no como mecanismo.

- *Alternativa: una secuencia por organización.* Rechazada: obliga a crear y destruir objetos de base por cada organización, y las secuencias no se reversan en un `rollback`, así que dejarían huecos.
- *Alternativa: `pg_advisory_xact_lock(hashtext(org))`.* Rechazada: colisiona entre organizaciones distintas por el hash y es invisible en el catálogo, lo que la hace difícil de diagnosticar.
- El número **no se reutiliza**: se toma de `max(code)`, incluidos los archivados. Un número que reaparece señalando otro pedido rompe la referencia humana ("el #142") que es justamente su razón de ser.

### D3 · `order_totals` nace sin `paid`

La definición canónica del esquema incluye `paid` sobre `payments`, tabla que llega en KAM-10. La vista se crea ahora con `order_id, organization_id, business_line_id, kind, occurred_at, total` y `security_invoker = true`; KAM-10 la amplía con un `create or replace view` **en una migración nueva**, sin tocar esta (convención nº 6).

- *Alternativa: adelantar `payments`.* Rechazada: es alcance de otra tarea.
- *Alternativa: exponer `paid` con literal `0`.* Rechazada: un cero que no significa "nada cobrado" sino "todavía no se sabe" es una mentira que algún reporte acabará sumando.

### D4 · `queued_at` lo mantiene un trigger; reordenar lo reescribe con el punto medio

Dos escrituras distintas sobre la misma columna, y conviene separarlas:

- **Entrar y salir de la cola** es consecuencia de cambiar de estado, y el cambio de estado llega desde el tablero, desde el detalle y mañana desde KAM-08. Un trigger `before update` sobre `orders` que actúa **solo cuando `status_id` cambió** pone `queued_at = now()` al entrar a un estado con `is_queue = true` y `null` al salir. Vive en un solo sitio y ninguna ruta puede saltárselo.
- **Reordenar dentro de la cola** es una intención explícita del usuario, y la acción escribe `queued_at` directamente. Como el trigger solo mira los cambios de `status_id`, no pisa esa escritura.

La posición visible (1, 2, 3…) **se deriva del orden, no se almacena**: es el índice en la consulta ordenada por `queued_at asc`, con `code asc` como desempate estable. Por eso "renumerar el resto" no requiere ninguna escritura extra — mover uno cambia el orden y las demás posiciones se recalculan solas, que es exactamente lo que pide el criterio 7 del backlog.

Al soltar una tarjeta entre dos vecinas se le asigna el punto medio de sus `queued_at`. Si la distancia entre vecinas baja de 2 ms, la acción renormaliza la columna entera espaciando los valores un segundo y reintenta una vez. El límite es el milisegundo y no el microsegundo de `timestamptz` porque las cadenas ISO que viajan entre el cliente y PostgREST solo llevan milisegundos: esa es la resolución con la que de verdad se puede colocar una tarjeta.

- *Alternativa: una columna `queue_position int`.* Rechazada por dos motivos: almacenaría un derivado (convención nº 4) y añadiría una columna que el esquema canónico no tiene, obligando a mantener la consistencia de N filas en cada movimiento.

### D5 · La alerta de retraso es una función pura, no una columna

`lib/orders/overdue.ts` exporta `isOverdue({ dueDate, statusKind, today })`, que devuelve `true` solo si hay `due_date`, ya pasó, y `statusKind` es `initial` o `in_progress`. Es la única definición de "retrasado" del proyecto.

El "hoy" se calcula en la **zona horaria de la organización** (`organizations.timezone`, que ya existe), no en la del navegador: un taller en La Paz no debe ver un pedido en rojo porque el portátil está en otro huso.

- *Alternativa: una columna calculada o una vista.* Rechazada: depende de "hoy", así que ninguna fila almacenada es correcta más de 24 horas y ninguna respuesta sería cacheable.
- La función recibe `statusKind`, nunca el nombre del estado (convención nº 5). El escenario "renombrar el estado no cambia el comportamiento" se prueba contra ella.

### D6 · Actualización optimista con un store de Zustand y reversión explícita

El tablero mantiene en `features/orders/board-store.ts` el mapa `orderId → statusId` de los movimientos en vuelo. Al soltar, el store aplica el cambio y la tarjeta se pinta ya en la columna destino; la Server Action corre después. Si devuelve error, el store revierte esa entrada y se muestra el mensaje. El store guarda ubicación en vuelo, no datos derivados: la convención nº 4 prohíbe almacenar totales y saldos, no el estado transitorio de la interfaz.

- *Alternativa: `useOptimistic`.* Rechazada: su estado se reinicia con cada transición, y el arrastre de dnd-kit atraviesa varios componentes de columna; conciliar ambos ciclos de vida sale más caro que un store explícito, que además hace la reversión legible.
- El destino se valida en el servidor contra `resolve_statuses` de la línea del pedido antes de escribir: la interfaz solo ofrece columnas válidas, pero la acción no confía en la interfaz.

### D7 · Archivar reutiliza `enforce_archive_rules()`; los adjuntos reutilizan `attachments`

Se adjunta a `orders` el mismo trigger `before update` que ya gobierna `contacts` e `items`. Eso da gratis y verificado que solo el dueño toque `archived_at` y que un pedido archivado no se edite. No se escribe ninguna comprobación de rol en TypeScript para esto.

Las imágenes de referencia son filas de `attachments` con `entity_type = 'order'` —valor que el `check` de la tabla ya admite— en el bucket `attachments`. Se reutiliza `AttachmentService`. En este cambio solo se leen y se muestran; el formulario de subida es de KAM-08.

`order_items` **no** lleva `enforce_archive`: no tiene `archived_at`. Su protección es la ausencia de política `DELETE` y el archivado del pedido padre.

### D8 · Reparto por capas

Siguiendo la convención nº 1, sin inventar estructura nueva:

| Capa | Archivos |
|---|---|
| `lib/orders/` | `overdue.ts` (D5), `queue.ts` (posiciones y punto medio, D4), `schema.ts` (Zod de las acciones) |
| `services/orders/` | `order-service.ts`, `order-item-service.ts` |
| `actions/orders.ts` | `moveOrderToStatus`, `reorderQueue`, `archiveOrder`, `unarchiveOrder` |
| `features/orders/` | `orders-screen.tsx` (contenedor y conmutador de vista), `board-view.tsx`, `board-column.tsx`, `order-card.tsx`, `list-view.tsx`, `calendar-view.tsx`, `order-filters.tsx`, `order-detail.tsx`, `board-store.ts` |
| `app/(app)/orders/` | `page.tsx` y `[id]/page.tsx`, delgadas |

## Risks / Trade-offs

- **El bloqueo de fila de D2 serializa las altas de una misma organización** → Es el precio de un número consecutivo sin huecos, y la ventana es de microsegundos. A la escala de un taller no se nota; si alguna vez estorba, la salida es un contador por organización, no quitar el bloqueo.
- **La renormalización de D4 escribe varias filas y dispara la bitácora** → Solo ocurre tras muchísimos reordenamientos sobre las mismas dos vecinas. Se acepta el ruido en el historial a cambio de no añadir una columna de posición.
- **La actualización optimista puede mostrar durante un instante un estado que el servidor rechazará** → La reversión es visible y va acompañada de mensaje; nunca queda un estado inconsistente en silencio.
- **D1 se tomó sin confirmación del usuario** → Está aislada en un componente y anotada aquí como reversible; cambiar a otra de las alternativas no toca base de datos, servicios ni acciones.
- **La semilla se convierte en la única fuente de datos de las pruebas e2e** hasta KAM-08 → Se siembran explícitamente los casos límite que los criterios exigen (tres en cola, vencido en `waiting`, vencido en `in_progress`), con una prueba pgTAP que verifica que la semilla los contiene, para que un cambio futuro en la semilla no vacíe las pruebas sin avisar.

## Migration Plan

Una migración nueva, `supabase/migrations/<timestamp>_orders.sql`, en este orden: tablas e índices → trigger de numeración → trigger de `queued_at` → vista `order_totals` → `enforce_archive` → `audit` → privilegios y RLS. Ninguna migración existente se toca.

`supabase/seed.sql` se amplía con los pedidos de Geeko Store. Reversión: `supabase db reset` reconstruye desde cero; en un entorno ya desplegado, revertir es una migración nueva que archiva lo sembrado, nunca un `drop`.

Tras la migración, `graphify .` (convención nº 6).
