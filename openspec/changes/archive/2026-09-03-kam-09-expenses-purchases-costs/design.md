# Diseño · KAM-09 · Egresos: compras y gastos

## Context

Motivación en `proposal.md` (Why). Requisitos en `specs/expenses/spec.md`. Lo que este diseño hereda y no reinventa:

- **KAM-07 y KAM-08** dejaron el patrón completo de un documento con líneas: tabla + tabla de líneas con `organization_id` añadido, vista de total con `security_invoker`, `enforce_archive_rules()`, `audit`, privilegios explícitos, RLS sin `DELETE`, y una función `create_order(p_order jsonb, p_items jsonb)` `security invoker` que inserta encabezado y líneas en una transacción. En la aplicación: servicio con `list/getById/create/setArchived/history`, acciones que traducen errores de la base, página delgada y pantalla en `features/`. Este cambio copia esa forma en `expenses`.
- **KAM-06** dejó `attachments` con el bucket `receipts` ya creado y sus políticas de Storage, `AttachmentService` (subida, firma en lote, archivado), `FileDropzone` con `accept` y `maxSizeBytes` parametrizables, `ContactCombobox` con creación al vuelo y filtro por rol, `ItemService.list` con filtro por `kind` y línea, `IMAGE_ACCEPT` y `MAX_FILE_SIZE` en `lib/catalog/photos.ts`, y el trigger `enforce_archive_rules()`.
- **KAM-04** dejó `expense_categories` (solo lectura para el ayudante) y la línea compartida `is_shared = true`, única por organización; **KAM-05** el selector de línea global con su cookie y `resolveActiveLine()`.
- **KAM-10 ya está propuesto** (`openspec/changes/kam-10-payments-collections/`) y asume que este cambio deja `expenses`, `expense_items` y `expense_totals` **sin `paid`**; su migración crea `payments` y redefine `expense_totals` añadiendo `paid` al final con `create or replace view`.
- `next.config.ts` ya fija `serverActions.bodySizeLimit` en 6 MB; `getOwnerContext()` y el `layout.tsx` de configuración ya muestran cómo cerrar un árbol de rutas al ayudante.
- Restricciones que mandan: nada derivado se almacena (nº 4); toda consulta a Supabase en `services/` (nº 1); sin política `DELETE` (nº 3); UUID y `occurred_at` del cliente (nº 9); ningún concepto fuera del modelo 6.1 (nº 11).

## Goals / Non-Goals

**Goals:**

- Que un documento con líneas se guarde entero o no se guarde, en una base donde no se puede borrar.
- Que registrar un gasto desde el celular se sienta como anotar en un papel: monto, categoría, listo.
- Que el comprobante nunca frene el guardado, y que una foto de 8 MB no viaje nunca tal cual.
- Que el ayudante no pueda llegar a un costo por ningún camino: menú, dirección directa, tabla, vista ni bucket.
- Que KAM-10 encaje encima sin tocar nada de aquí: la vista con las columnas en el orden canónico y la bandeja con su hueco para la insignia de pago.

**Non-Goals:**

- Todo lo que depende de `payments`: la tabla, `expense_totals.paid`, el estado de pago, registrar un pago, "por pagar" (KAM-10).
- Edición de un egreso guardado. No hay ruta `/expenses/[id]/edit` en ARCHITECTURE.md: corregir es archivar y registrar de nuevo.
- Movimientos de inventario desde `expense_items` (KAM-18), etiquetas (KAM-15), V16 (KAM-13), modo sin conexión (KAM-11). El diseño no los implementa, pero no los estorba: los UUID los genera el cliente y la inserción atómica acepta ids dados.

## Decisions

### D1 · `expense_totals` nace sin `paid`; el estado de pago es de KAM-10

El backlog lista "estado de pago: pagado, pendiente, parcial" en KAM-09, pero ese estado es `paid` frente a `total`, y `paid` sale de `payments`. Se aplica el mismo criterio que KAM-07 D3 con `order_totals`: la vista se crea con `expense_id, organization_id, business_line_id, kind, occurred_at, total` —el orden canónico— y KAM-10 la amplía con `create or replace view` en una migración nueva, añadiendo `paid` al final. Ni una columna `payment_status`, ni un `paid = 0` fijo, ni un control en los formularios.

- *Alternativa: adelantar `payments` desde aquí y derivar el estado ya.* Fue la primera versión de este diseño. Rechazada al descubrir que KAM-10 ya está propuesto con esa tabla, su RLS, su semilla y la insignia de estado en la bandeja de egresos (sus tareas 1.1, 1.6 y 6.2): dos migraciones creando `payments` es un choque seguro, y KAM-10 además prohíbe cualquier campo editable de estado de pago.
- *Alternativa: columna `payment_status` declarada en `expenses`.* Rechazada: derivado almacenado en cuanto exista `payments`, y "parcial" sin monto no dice cuánto falta.

La bandeja y el detalle dejan la columna de estado de pago fuera; KAM-10 la monta con su propio componente.

### D2 · El egreso y sus líneas se insertan con una función de base de datos, en una transacción

`create_expense(p_expense jsonb, p_items jsonb) returns uuid`, `language plpgsql security invoker` (RLS sigue decidiendo: el ayudante recibe el mismo rechazo que insertando a mano), calcada de `create_order`. Inserta el encabezado y, si `kind = 'purchase'`, las líneas; una compra sin líneas lanza `raise exception 'Una compra necesita al menos una línea' using errcode = 'check_violation'`; un gasto con líneas también se rechaza. Acepta los `id` que traiga el cliente (convención nº 9) y `occurred_at` del cliente. `ExpenseService.create()` la invoca con `.rpc()`; ninguna consulta sale de `services/`.

- *Alternativa: inserciones en secuencia desde el servicio.* Rechazada: sin política `DELETE`, un fallo en la tercera línea deja un encabezado huérfano que solo se puede archivar, y la bandeja mostraría una compra vacía durante un instante.
- *Alternativa: inserción anidada de PostgREST.* No existe para `insert`.

### D3 · `item_last_cost` se crea ahora, y la pista se lee una vez por formulario

La vista canónica §11 (`distinct on (item_id)` ordenado por `occurred_at desc`, excluyendo egresos archivados, con `last_supplier_id` y `last_purchase_at`) nace en esta migración: es la fuente de la pista de V8 y, sin cambios, del último costo de V11 en KAM-18. La página de V8 la carga entera para la organización (`ItemLastCostService.mapFor(org)` → `Map<itemId, { lastCost, lastPurchaseAt, supplierName }>`) y la pasa como dato; la tabla de insumos muestra la pista junto al precio. El campo de precio nace vacío y ninguna rama del código lo rellena desde la pista: el escenario "la pista no cambia el valor" se prueba contra el componente.

- *Alternativa: consulta por insumo al elegirlo.* Rechazada: una petición por fila añadida, y el catálogo de un taller cabe en una sola.
- *Alternativa: guardar `last_cost` en `items`.* Es exactamente lo que `catalog.test.sql` vigila que no exista.

### D4 · El comprobante se comprime en el navegador sin dependencia nueva y sube después de guardar

`lib/attachments/compress-image.ts` exporta `compressImage(file, { maxEdge: 1600, maxBytes: MAX_FILE_SIZE })`: decodifica con `createImageBitmap`, redimensiona en un `canvas` al lado mayor de 1600 px y codifica con `toBlob` en WebP —JPEG si el navegador no lo soporta— bajando la calidad de 0,85 en pasos de 0,1 hasta caber en 5 MB. Sin dependencia nueva (misma política que KAM-07). `FileDropzone` se usa con `IMAGE_ACCEPT` y `maxSizeBytes` de 20 MB: el límite de entrada es de la foto original; el de 5 MB lo garantiza la compresión y lo vuelve a comprobar la acción.

El orden es **guardar primero, subir después**: `createExpense`/`createPurchase` devuelven el `id`; el formulario vuelve a la bandeja de inmediato y encola la subida en `features/expenses/receipt-upload-store.ts` (Zustand: `expenseId → pending | failed`), que comprime y llama a `attachReceipt(formData)` —`FormData` porque un `File` no sobrevive a la serialización de una Server Action, igual que `uploadItemPhoto`—. La bandeja consulta el store para pintar "comprobante subiendo…" en la fila; al fallar, aviso y el detalle ofrece "Adjuntar comprobante" con la misma acción. Un `beforeunload` avisa si hay subidas en vuelo. El store guarda estado transitorio de interfaz, no datos derivados.

- *Alternativa: subir antes de guardar.* Rechazada: es el bloqueo que el criterio 6 prohíbe, y con mala señal el gasto no se registraría nunca.
- *Alternativa: subir desde el navegador directo a Storage con el cliente de Supabase.* Rechazada: una consulta a Supabase fuera de `services/` (convención nº 1) y una segunda ruta de escritura de `attachments` que mantener.
- *Alternativa: `browser-image-compression`.* Rechazada: 30 líneas con la API del navegador hacen lo mismo y no añaden un paquete.
- HEIC (iPhone por defecto): el navegador no lo decodifica; el `accept` no lo incluye y el mensaje nombra los formatos válidos. Registrarlo como caso conocido, no como error.

### D5 · V9 en cuatro interacciones: monto con foco, chips, línea heredada

Desde la bandeja: (1) "Nuevo gasto", (2) escribir el monto —el campo ya tiene el foco, `inputMode="decimal"`, tamaño de titular—, (3) tocar una categoría (`ToggleGroup` de shadcn con las `expense_categories` vigentes, en su orden), (4) "Guardar". La línea viene de la línea activa; con "Todas" se preselecciona la compartida, porque un gasto que no es de una línea es, por definición, de General (§6.1). La fecha es hoy y se puede cambiar; "Asignar a un pedido" es un desplegable plegado con los pedidos vigentes de la organización, que no cuesta ninguna interacción si no se abre. La prueba e2e cuenta las interacciones con un contador explícito, no a ojo.

### D6 · V7 lleva los filtros en la dirección, calcula los totales al leer y abre el detalle en un panel

`/expenses?kind=&contact=&category=&from=&to=&archived=&selected=`; la línea la da el selector global (cookie), como en `/orders`. El periodo por defecto es el mes en curso **en la zona horaria de la organización** (se reutiliza `todayInTimezone`). `ExpenseService.list()` lee `expenses` y los totales de `expense_totals` en lote; `summarize(rows)` en `lib/expenses/totals.ts` suma compras, gastos y total del conjunto filtrado, al vuelo, en la respuesta del servidor: derivado en lectura, nunca en columna ni en store. `?selected=<id>` abre `ExpenseDetail` en un `Sheet` sin salir de la bandeja; `/expenses/[id]` renderiza el mismo componente a página completa para los enlaces que vendrán de V13, V14 y V18. En móvil, `ExpensesScreen` cambia la tabla por tarjetas apiladas con `useIsMobile()` de `hooks/use-mobile.ts`, ya presente.

- *Alternativa: agregar en SQL con una vista de totales por periodo.* Rechazada: el periodo es un filtro libre, y una vista por combinación de filtros no existe; sumar cientos de filas en el servidor de la aplicación es trivial.

### D7 · Acceso: guardia de dueño en el layout y RLS solo dueño

`app/(app)/expenses/layout.tsx` copia la guardia de configuración: `getOwnerContext()` y, si no alcanza, `redirect(defaultLandingPath(...))`. Cubre `/expenses`, `/purchases/new`, `/costs/new` y `/[id]` de una vez. `lib/auth/routes.ts` añade `/expenses` a `PROTECTED_PREFIXES`; `nav-entries.ts` añade "Egresos" con `roles: ["owner"]`, entre Pedidos y Catálogo (grupo Dinero del mapa §4.1).

En la base, `expenses` y `expense_items` llevan políticas de leer, crear y editar con `is_owner(organization_id)` —no `is_member`—: es la matriz §16 tal cual, y es lo que hace que `expense_totals` e `item_last_cost` devuelvan cero filas al ayudante sin una línea de código. Archivar lo decide `enforce_archive_rules()` en `expenses`; `expense_items` no tiene `archived_at`, igual que nació `order_items`.

- *Alternativa: comprobar el rol en cada acción y dejar RLS de miembro.* Rechazada: es la capa equivocada; RLS es la última línea de defensa y aquí también la primera.

### D8 · `expense_items` lleva `organization_id`

Misma desviación del DDL canónico y mismo motivo que `order_items` e `item_variants` (convención nº 2, `log_activity()` lee la organización de la propia fila, la política no salta a la tabla padre). La función de D2 lo rellena desde el encabezado; las pruebas lo dan por hecho.

### D9 · Archivar reutiliza lo que ya existe; no hay edición

`enforce_archive_rules()` sobre `expenses`: solo el dueño toca `archived_at`, un archivado no se edita. `archiveExpense`/`unarchiveExpense` piden la operación y traducen `insufficient_privilege`, como en pedidos. Sin ruta de edición (ver Non-Goals): el error humano se corrige archivando y registrando de nuevo, y la bitácora conserva ambos.

### D10 · Reparto por capas

| Capa | Archivos |
|---|---|
| `supabase/migrations/` | `<timestamp>_expenses.sql` (tablas, `create_expense`, vistas, triggers, privilegios, RLS) |
| `supabase/tests/` | `expense_integrity`, `expense_access`, `derived_values`, ampliación de `seed_geeko` |
| `types/index.ts` | `EXPENSE_KINDS`, `Expense`, `ExpenseKind`, `ExpenseItem`, `ExpenseTotals`, `RECEIPTS_BUCKET` |
| `lib/expenses/` | `schema.ts` (Zod de gasto, compra, adjuntar, archivar), `totals.ts` (total de compra y resumen del periodo, D6), `period.ts` (mes en curso), `errors.ts` |
| `lib/attachments/` | `compress-image.ts` (D4) |
| `services/expenses/` | `expense-service.ts` (`list`, `getById`, `create` vía `create_expense`, `setArchived`, `history`), `expense-item-service.ts`, `item-last-cost-service.ts` (D3) |
| `actions/expenses.ts` | `createExpense`, `createPurchase`, `attachReceipt`, `archiveExpense`, `unarchiveExpense` |
| `features/expenses/` | `expenses-screen.tsx`, `expense-filters.tsx`, `expense-row.tsx` / `expense-card.tsx`, `expense-detail.tsx`, `purchase-form.tsx`, `purchase-lines-table.tsx`, `cost-form.tsx`, `category-chips.tsx`, `receipt-field.tsx`, `receipt-upload-store.ts` |
| `app/(app)/expenses/` | `layout.tsx` (guardia), `page.tsx`, `purchases/new/page.tsx`, `costs/new/page.tsx`, `[id]/page.tsx` |
| Transversal | `components/layout/nav-entries.ts`, `lib/auth/routes.ts`, `supabase/seed.sql` |

## Risks / Trade-offs

- **El estado de pago que el backlog pone en KAM-09 llega con KAM-10** → Es un traslado, no una pérdida: KAM-10 lo deriva y lo muestra en la bandeja y el detalle de egresos. Está anotado en `proposal.md` para que quien revise el backlog lo vea.
- **`create_expense` concentra lógica en plpgsql, menos cómodo de probar que TypeScript** → Es exactamente lo que pgTAP cubre; la función es corta y tiene un solo motivo para cambiar (aparece un campo nuevo).
- **La compresión en un celular modesto puede tardar segundos** → Ocurre después de guardar y fuera del camino crítico; la fila ya está en la bandeja con su indicador.
- **Una recarga dura durante la subida pierde el comprobante** → El egreso ya está guardado; `beforeunload` avisa, y el detalle permite volver a adjuntar. Es el precio de no bloquear el guardado, y es reversible.
- **El mapa de navegación dice que V8 y V9 son de ambos roles; aquí son del dueño** → Resuelto a favor de la matriz de acceso y del criterio 5 del backlog; anotado en `proposal.md` para corregir el documento. Si se decide que el ayudante registre gastos, es un cambio de RLS y de menú, no de pantallas.
- **La semilla es la única fuente de datos para las pruebas e2e de V7 hasta que se registren datos por V8/V9 en la misma prueba** → Las pruebas que crean egresos los nombran con marca de tiempo y no afirman sobre las filas sembradas que otra prueba pueda archivar; `seed_geeko.test.sql` vigila que los casos sembrados sigan ahí.
- **El periodo por defecto depende de la zona horaria de la organización** → Se calcula en el servidor con `todayInTimezone`, nunca con la hora del navegador; probado en unitarias.

## Migration Plan

Una migración nueva, `supabase/migrations/<timestamp>_expenses.sql`, en este orden: `expenses` e índices → `expense_items` (+ `organization_id`) e índices → `create_expense()` → vistas `expense_totals` e `item_last_cost` → `enforce_archive` en `expenses` → `audit` en las dos tablas → privilegios (`grant select, insert, update` a `authenticated`, `revoke delete` a todos, `grant select` en las vistas, `revoke execute ... from public` y `grant execute` a `authenticated` en la función) → RLS. Ninguna migración existente se toca.

`supabase/seed.sql` se amplía con los egresos de Geeko Store (D5 de KAM-07: los casos límite se siembran explícitamente y `seed_geeko.test.sql` los vigila). Reversión: `supabase db reset` en local; en un entorno desplegado, una migración nueva que archive lo sembrado. Tras la migración, `graphify .`.

## Open Questions

- **Límite de entrada de 20 MB para la foto original**: es un tope de cordura para no intentar decodificar un archivo enorme en el navegador. Si las fotos reales de los celulares del taller lo superan, se sube el número sin tocar nada más.
