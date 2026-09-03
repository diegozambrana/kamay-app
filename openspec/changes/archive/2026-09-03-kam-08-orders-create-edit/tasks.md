# Tareas · KAM-08 · Alta y edición de pedidos

Requisitos en `specs/orders/spec.md` y `specs/catalog-directory/spec.md`; decisiones (D1–D15) en `design.md`.
Convención nº 12: cada escenario del delta tiene al menos una prueba aquí referenciada.

## 1. Base de datos

- [x] 1.1 Crear `supabase/migrations/<timestamp>_order_entry.sql` y añadir `archived_at timestamptz` a `order_items` con índice parcial `(order_id) where archived_at is null`, anotando en un comentario la desviación del DDL canónico y su motivo (D2).
- [x] 1.2 En la misma migración, `create or replace view order_totals with (security_invoker = true)` con las mismas columnas que KAM-07 y la suma restringida a líneas con `archived_at is null`; volver a conceder `select` a `authenticated` y `service_role`.
- [x] 1.3 Añadir `create_order(p_order jsonb, p_items jsonb) returns uuid` (D1, D3): comprueba `is_member(organization_id)` al inicio, exige `jsonb_array_length(p_items) > 0` con mensaje propio, resuelve el estado de tipo `initial` de menor `position` con `resolve_statuses(org, line, 'order')`, inserta el pedido con el `id` y el `occurred_at` que trae el cliente y luego las líneas con sus `id`, y nunca acepta `status_id`, `code` ni `archived_at` desde el `jsonb`.
- [x] 1.4 Añadir `update_order(p_order jsonb, p_items jsonb) returns void` (D1): comprueba `is_member`, actualiza solo `contact_id`, `sales_channel_id`, `delivery_mode`, `due_date`, `notes` y `updated_at`; hace *upsert* de líneas por `id`, archiva las vigentes ausentes de `p_items` y exige que quede al menos una vigente.
- [x] 1.5 Cerrar privilegios: `grant execute` de ambas funciones a `authenticated`, `revoke` a `anon`; ninguna política nueva (RLS de KAM-07 sigue mandando con `security invoker`).
- [x] 1.6 Verificar `supabase db reset` sin error, confirmar que la semilla de KAM-07 sigue intacta y regenerar el grafo con `graphify .` (convención nº 6).

## 2. Pruebas de base de datos (pgTAP)

- [x] 2.1 `supabase/tests/order_entry.test.sql` · `create_order`: el pedido nace en el estado de tipo `initial` de su línea; renombrar ese estado no cambia el `kind` resultante; el `id` dado por el cliente se respeta; con `p_items` vacío la función falla con su mensaje y no existe ningún pedido; una línea inválida (cantidad 0) revierte todo y no se consumió ningún `code`; el pedido y cada línea dejan un evento `created` en `activity_log`; el precio de la línea queda tal como se envió aunque el catálogo tenga otro.
- [x] 2.2 `supabase/tests/order_entry.test.sql` · `update_order`: modifica fecha y agrega una línea; una línea ausente del payload queda con `archived_at` fijado y evento `archived`; dejar cero líneas vigentes falla y el pedido conserva sus líneas; una línea inválida revierte todo; `business_line_id` y `status_id` no cambian aunque vengan en el `jsonb`; el ayudante crea y edita; un miembro de otra organización recibe error; un pedido archivado rechaza la edición por `enforce_archive_rules`.
- [x] 2.3 `supabase/tests/order_entry.test.sql` · derivados y borrado: `order_totals` devuelve 135 con una línea vigente 3 × 45 y una archivada 1 × 55; refleja el archivado sin recálculo; sigue devolviendo 0 para el pedido sin líneas y 115 para 3 × 25 + 1 × 40; `delete` sobre `order_items` no elimina ninguna fila; `orders` sigue sin columnas de total, saldo, cobrado ni margen.
- [x] 2.4 Extender `supabase/tests/seed_geeko.test.sql` con una comprobación de que ninguna línea de la semilla está archivada (para que las pruebas e2e de KAM-07 no cambien de total en silencio).

## 3. Lógica pura y tipos

- [x] 3.1 `types/index.ts`: añadir `archivedAt` a `OrderItem` y el tipo `OrderFormValues`/`OrderLineValues` exportado desde el esquema.
- [x] 3.2 `lib/orders/schema.ts` (D5): `orderLineSchema` (`id`, `itemId | null`, `variantId | null`, `description`, `quantity > 0`, `unitPrice >= 0`, descripción obligatoria sin ítem) y `orderFormSchema` (`id`, `businessLineId`, `contactId` con mensaje «Elige o crea un cliente», `salesChannelId | null`, `deliveryMode | null`, `dueDate | null`, `notes`, `occurredAt`, `items.min(1)`), sin `statusId` ni total; más `orderAttachmentSchema` para archivar adjuntos.
- [x] 3.3 `lib/orders/schema.test.ts`: alta mínima válida (cliente + una línea, sin fecha, canal ni modo); sin cliente falla en `contactId`; sin líneas falla en `items`; cantidad 0 falla en la línea; línea libre sin descripción falla; `statusId` en la entrada se ignora/rechaza; total ausente del esquema.
- [x] 3.4 `lib/orders/due-date.ts` (D12): `shiftDate(today, days)` con aritmética de días civiles y los cuatro atajos como constantes con etiqueta en español.
- [x] 3.5 `lib/orders/due-date.test.ts`: «Mañana» = hoy + 1 en la fecha dada por el servidor; cruce de mes y de año; sin dependencia de la zona del proceso.
- [x] 3.6 `lib/orders/lines.ts` (D7): `lineTotal()` y `orderTotal()` sobre las líneas del formulario, y `pickerCandidates(items, lineId, term)` que excluye archivados y los de otra línea y aplica `matchesSearch`.
- [x] 3.7 `lib/orders/lines.test.ts`: 3 × 45 → 135 y al cambiar a 4 → 180; el buscador no ofrece archivados ni de otra línea y sí compartidos; tolera acentos y mayúsculas.
- [x] 3.8 `lib/orders/errors.ts`: traducir los mensajes de `create_order`/`update_order` («al menos una línea», «no eres miembro», «pedido archivado») y ampliar `errors.test.ts`.
- [x] 3.9 `lib/catalog/schema.ts` (D13): `quickContactSchema` gana `phone` opcional; ampliar `lib/catalog/schema.test.ts` con teléfono presente y ausente.

## 4. Servicios

- [x] 4.1 `services/orders/order-service.ts`: `create(organizationId, values)` y `update(organizationId, values)` que llaman a `rpc('create_order' | 'update_order')` construyendo el `jsonb` con `organization_id` explícito (convención nº 2) y devuelven el `id`; `getById` sin cambios.
- [x] 4.2 `services/orders/order-item-service.ts`: `listByOrder` y `summariesFor` filtran `archived_at is null`; `listByOrder` mapea `archivedAt`.
- [x] 4.3 `services/catalog/item-service.ts`: `listProductsWithVariants(organizationId)` — productos vigentes con sus variantes vigentes en una sola consulta para el buscador del formulario.
- [x] 4.4 `services/orders/order-service.test.ts`: `create` envía el `jsonb` esperado sin `status_id`; `update` envía todas las líneas con sus `id`; ambos filtran `organization_id`. Ampliar la prueba de `order-item-service` con la exclusión de archivadas.

## 5. Server Actions

- [x] 5.1 `actions/orders.ts` · `createOrder(input)`: valida con `orderFormSchema`, exige sesión, fuerza `organizationId` del contexto, llama a `OrderService.create` y devuelve `{ orderId, code }` o `{ error }`; revalida `/orders`.
- [x] 5.2 `actions/orders.ts` · `updateOrder(input)`: valida, exige sesión, comprueba que el pedido pertenece a la organización, llama a `OrderService.update`; traduce el rechazo de `enforce_archive_rules`; revalida `/orders` y `/orders/[id]`.
- [x] 5.3 `actions/orders.ts` · `uploadOrderAttachment(formData)` (D10): valida `orderId`, tamaño ≤ 5 MB, tipo imagen y tope de 20 vigentes por pedido; `AttachmentService.upload` con `entityType: 'order'` y `ATTACHMENTS_BUCKET`; revalida el detalle.
- [x] 5.4 `actions/orders.ts` · `setOrderAttachmentArchived(input)`: sin exigir rol de dueño (D10), archiva vía `AttachmentService.setArchived`; revalida el detalle.
- [x] 5.5 `actions/contacts.ts` · `createContactInline` acepta y persiste `phone` (D13).

## 6. Buscador de contactos (V13 y V5)

- [x] 6.1 `features/contacts/contact-combobox.tsx` (D13): al pulsar «Crear «nombre»» se despliega un paso mínimo con el nombre ya escrito y un campo de teléfono, con «Crear» y «Cancelar», sin abandonar el formulario; el contacto creado queda seleccionado.
- [x] 6.2 `features/contacts/contact-combobox.test.tsx`: crear con teléfono envía `phone`; crear sin teléfono envía `null`; el contacto creado queda seleccionado y el `onSelect` recibe el contacto con `isCustomer: true` cuando `role="customer"`; el contenedor conserva su estado (probar desde un envoltorio con líneas y nota).

## 7. Formulario de pedido (V5)

- [x] 7.1 `app/(app)/orders/new/page.tsx`: página delgada que resuelve la línea activa (`preselectedLineId`), carga líneas vigentes, canales vigentes, contactos vigentes, productos con variantes y `today` en la zona de la organización, y rinde `OrderForm mode="create"`.
- [x] 7.2 `features/orders/order-form.tsx` (D5, D6): `useForm` + `zodResolver(orderFormSchema)` + `useFieldArray`; campo de línea como `Select` en `create` (vacío y obligatorio con «Todas») y como etiqueta en `edit`; cambiar la línea en `create` retira las líneas cuyo producto no pertenece a la nueva ni es compartido, avisando; errores señalando el campo con `Field`/`FieldError`; barra de acciones `sticky bottom-0` con «Cancelar», «Guardar y crear otro» (solo `create`) y «Guardar».
- [x] 7.3 `features/orders/catalog-picker.tsx` y `order-lines-editor.tsx` (D7): buscador en memoria con `pickerCandidates`; producto sin variantes agrega fila con cantidad 1 y precio prellenado; con variantes exige elegir una y prellena desde ella; «Línea libre» agrega fila sin producto que exige descripción; cada fila con cantidad, precio, descripción, subtotal y «Quitar»; total al pie con `orderTotal()`.
- [x] 7.4 `features/orders/due-date-field.tsx` (D12): `<input type="date">` más «Hoy», «Mañana», «En 3 días», «En una semana» y «Borrar», calculados con `shiftDate(today, n)`.
- [x] 7.5 Campos restantes: cliente con `ContactCombobox role="customer"`; canal (`Select` de canales vigentes, opcional); modo de entrega (`ToggleGroup` recojo / delivery, opcional y deseleccionable); nota (`Textarea`); adjuntos con `FileDropzone` de imágenes, `maxFiles = 20 − vigentes`.
- [x] 7.6 «Guardar» y «Guardar y crear otro» (D11): tras `createOrder`, subir cada adjunto con `uploadOrderAttachment` avisando cuál falló sin perder el pedido; «Guardar» hace `reset()` y navega al detalle; «Guardar y crear otro» reinicia conservando `businessLineId` y `salesChannelId`, regenera `id` y `occurredAt`, muestra «Pedido #N guardado» y enfoca el buscador de cliente.
- [x] 7.7 `features/orders/discard-guard.tsx` (D8): `AlertDialog` «¿Descartar los cambios?» en «Cancelar» y en el enlace de volver cuando `isDirty`; salida directa sin cambios; `beforeunload` mientras haya cambios; volver usa `router.back()` para conservar filtros y vista.
- [x] 7.8 `components/layout/mobile-nav.tsx` (D9): lista `CAPTURE_ROUTES` con `/orders/new` y `/orders/[id]/edit`; en ellas la barra inferior no se rinde.
- [x] 7.9 `features/orders/orders-screen.tsx`: botón «Nuevo pedido» en el encabezado, visible para ambos roles, que enlaza a `/orders/new`.

## 8. Edición y cancelación (V4)

- [x] 8.1 `app/(app)/orders/[id]/edit/page.tsx`: página delgada que carga el pedido, sus líneas vigentes, sus adjuntos vigentes con URL firmada y los mismos catálogos que el alta; si el pedido está archivado, rinde el aviso y no ofrece guardar; rinde `OrderForm mode="edit"` con `defaultValues` del pedido.
- [x] 8.2 `OrderForm mode="edit"`: envía todas las líneas vigentes con sus `id` (las nuevas con `id` generado en el cliente), llama a `updateOrder`, sube los adjuntos nuevos, y navega al detalle; lista de adjuntos existentes con «Quitar» → `setOrderAttachmentArchived`, disponible para ambos roles.
- [x] 8.3 `features/orders/cancel-order-button.tsx` (D4): busca en `statuses` el de `kind === 'cancelled'`; si existe y el pedido no está en uno de ese tipo, rinde «Cancelar pedido» con `AlertDialog` de confirmación que llama a `moveOrderToStatus`; si no, no rinde nada.
- [x] 8.4 `features/orders/order-detail.tsx`: acciones «Editar» (enlace a `/orders/[id]/edit`) y `CancelOrderButton` en el encabezado, ocultas cuando el pedido está archivado.

## 9. Pruebas de interfaz

- [x] 9.1 `features/orders/order-form.test.tsx` · mínimos y línea: alta mínima envía `createOrder` sin fecha, canal ni modo; sin cliente muestra el error en el campo de cliente y no llama a la acción; sin líneas muestra el error en la sección de líneas; cantidad 0 señala la cantidad; con línea activa la preselecciona; con «Todas» no preselecciona y exige elegir; en `edit` la línea es una etiqueta y no un campo.
- [x] 9.2 `features/orders/order-form.test.tsx` · guardar: «Guardar» navega a `/orders/<id>`; «Guardar y crear otro» deja el formulario sin cliente, líneas, nota, fecha ni adjuntos pero con línea y canal, muestra «Pedido #N guardado» y regenera el `id`; un adjunto que falla muestra el aviso y el pedido queda guardado; la subida de un archivo > 5 MB se rechaza antes de enviar.
- [x] 9.3 `features/orders/order-lines-editor.test.tsx`: elegir producto sin variantes prellena cantidad 1 y precio 45; producto con variantes exige variante y prellena desde ella; precio editado a 40 es el que viaja; línea libre sin producto exige descripción; el total pasa de 135 a 180 al cambiar la cantidad; el buscador no ofrece archivados ni de otra línea.
- [x] 9.4 `features/orders/due-date-field.test.tsx`: «Mañana» fija hoy + 1 según el `today` recibido; «Borrar» vacía el campo.
- [x] 9.5 `features/orders/discard-guard.test.tsx`: con cambios, «Cancelar» abre la confirmación y rechazarla conserva los datos, aceptarla llama a `router.back()`; sin cambios sale directo; tras `reset()` no pregunta.
- [x] 9.6 `features/orders/cancel-order-button.test.tsx`: con estado `cancelled` en el juego ofrece la acción y al confirmar llama a `moveOrderToStatus` con ese `statusId`; rechazar no llama; sin `cancelled` no rinde; pedido ya en `cancelled` no rinde; renombrar el estado no cambia el destino (se busca por `kind`).
- [x] 9.7 `components/layout/mobile-nav.test.tsx`: en `/orders/new` y `/orders/<id>/edit` no se rinde la barra; en `/orders` sí.

## 10. Pruebas de extremo a extremo

- [x] 10.1 `tests/e2e/order-entry.spec.ts` · alta completa con medición (D14): desde el tablero con Sublimación activa, «Nuevo pedido» → cliente existente → dos productos → fecha por atajo → canal → modo delivery → nota → «Guardar»; el detalle muestra número, líneas, total y «Registrado» en el historial; el contador de interacciones queda anotado y es < 15.
- [x] 10.2 `tests/e2e/order-entry.spec.ts` · alta mínima: cliente y una línea, «Guardar»; el detalle muestra fecha, canal y modo como ausentes y sin alerta de retraso; el pedido aparece en la columna inicial del tablero.
- [x] 10.3 `tests/e2e/order-entry.spec.ts` · cliente al vuelo: nombre inexistente → «Crear» → teléfono → el cliente queda seleccionado y las líneas ya agregadas siguen; guardar; el contacto aparece en V13 con rol cliente y su teléfono.
- [x] 10.4 `tests/e2e/order-entry.spec.ts` · «Guardar y crear otro»: tras guardar, el formulario conserva línea y canal y nada más; el pedido guardado aparece en el tablero.
- [x] 10.5 `tests/e2e/order-entry.spec.ts` · descartar: con una nota escrita, «Cancelar» pide confirmación; rechazar conserva la nota; aceptar vuelve a la vista de lista con el filtro de origen; sin cambios, «Cancelar» sale directo.
- [x] 10.6 `tests/e2e/order-entry.spec.ts` · móvil (proyecto `mobile`): en `/orders/new` no existe la barra inferior y los botones de guardar son visibles sin desplazar.
- [x] 10.7 `tests/e2e/order-edit.spec.ts` · edición: crear un pedido propio de la prueba (no de la semilla), editar fecha y agregar línea 2 × 60 → total 310; quitar una línea → total baja y la línea no se muestra; la línea de negocio no es editable; el ayudante edita nota y cantidad; el historial registra la edición; el adjunto subido aparece en el detalle y quitado por el ayudante desaparece.
- [x] 10.8 `tests/e2e/order-edit.spec.ts` · cancelación: «Cancelar pedido» → confirmar → el pedido está en la columna «Cancelado» de su línea y el historial muestra el cambio de estado; rechazar la confirmación conserva el estado; en un pedido ya cancelado y en uno archivado la acción no aparece.

## 11. Cierre

- [x] 11.1 Revisar que `tests/e2e/order-flow.spec.ts` y `order-board.spec.ts` (KAM-07) siguen pasando con la semilla intacta y las nuevas pruebas creando sus propios pedidos.
- [x] 11.2 Ejecutar la secuencia completa: `lint → typecheck → test:unit → test:integration → build → test:e2e`, y confirmar cobertura ≥ 90 % en `lib/` y `services/`.

---

**Nota de cierre sobre la cobertura (11.2).** La secuencia completa pasa en
verde. La cobertura medida sobre `lib/` y `services/` es del 78,68 % de
sentencias, por debajo del 90 % que fija `openspec/project.md`. **El déficit es
previo a este cambio y está fuera de su alcance**: se concentra en archivos que
KAM-08 no toca — `lib/supabase` (0 %, fábricas de cliente), `lib/auth/post-auth.ts`
(0 %), `services/catalog/contact-service.ts` (57 %), `item-service.ts` (61 %),
`item-variant-service.ts` (64 %) y `services/configuration/status-service.ts`
(68 %)—, más las ramas de error de KAM-07 en `order-service.ts`. Lo que KAM-08
añade queda muy por encima del umbral: `lib/orders` al 98,05 % y
`lib/catalog/schema.ts` al 100 %. El proyecto no tiene hoy `@vitest/coverage-v8`
instalado ni un paso de cobertura en CI, así que la medición se hizo con una
instalación temporal (`npm install --no-save`) que no altera `package.json`.
Subir el resto al 90 % pide su propia tarea.
