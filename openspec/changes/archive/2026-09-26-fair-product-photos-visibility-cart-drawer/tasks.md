## 1. Esquema: `items.show_in_fair`

- [x] 1.1 Revisar `.claude/worktrees/*/supabase/migrations` y confirmar que `20260926100000` no choca con ninguna sesión hermana (ajustar el timestamp si hace falta)
- [x] 1.2 Escribir primero `supabase/tests/items_show_in_fair.test.sql` (pgTAP, `throws_ok` de 4 argumentos): columna existe, `not null`, `default true`, un ítem existente queda en `true`, guardar `null` falla y la migración no añade filas a `activity_log` — escenarios «Los ítems existentes quedan visibles en la venta rápida» y «El ajuste de venta rápida no admite nulo»
- [x] 1.3 Crear `supabase/migrations/20260926100000_items_show_in_fair.sql` (`alter table items add column show_in_fair boolean not null default true`) y aplicarla a la base local compartida con `psql`
- [x] 1.4 Añadir `show_in_fair` **al final** de las columnas de `items` en `lib/export/tables.ts` y su etiqueta «Mostrar en venta rápida» en `lib/activity/fields.ts` (y `describe.ts` si hace falta)
- [x] 1.5 Correr `supabase test db` y `npm run test:integration` (`export-manifest`, `activity-fields-coverage`) en verde

## 2. Catálogo: el ajuste por producto

- [x] 2.1 Pruebas primero en `lib/catalog/fields.test.ts`: `showInFair` solo aplica a `product`; para `supply` y `asset` se fuerza a `true` — escenario «El servidor ignora el ajuste en un insumo»
- [x] 2.2 Extender `lib/catalog/fields.ts` con `showInFair` en la tabla de campos por tipo y en la función que limpia la entrada según el tipo
- [x] 2.3 `services/catalog/item-service.ts`: `show_in_fair` en `COLUMNS` (un solo literal), en el mapeo a `showInFair` y en `create`/`update`; ajustar `services/catalog/catalog-service.test.ts`
- [x] 2.4 `actions/catalog.ts`: aceptar `showInFair` en los esquemas Zod de alta y edición y aplicar la regla de 2.2 antes de llamar al servicio
- [x] 2.5 Pruebas en `features/catalog/item-form-dialog.test.tsx`: el interruptor aparece en producto y no en insumo ni activo; activado por omisión en el alta; desactivarlo envía `showInFair: false`; aviso «no aparecerá en la venta rápida hasta que tenga precio» con el precio vacío — escenarios «Un producto nuevo se muestra por omisión», «Ocultar un producto de la venta rápida», «Volver a mostrarlo», «Insumos y activos no ofrecen el ajuste», «Aviso de producto sin precio»
- [x] 2.6 Implementar el interruptor en `features/catalog/item-form-dialog.tsx` (componente `Switch` de shadcn; añadirlo a `components/ui` con el CLI si no existe)
- [x] 2.7 Prueba en `features/catalog/item-detail.test.tsx` y cambio en `item-detail.tsx`: el detalle de un producto muestra «Mostrar en venta rápida: Sí/No»; el de un insumo no lo muestra — escenario «Ocultar un producto de la venta rápida» (parte del detalle)
- [x] 2.8 Prueba de integración que confirma que la bitácora registra el cambio del ajuste y que un producto oculto sigue saliendo en el listado del catálogo y en el buscador de productos de pedidos — escenarios «Ocultar un producto de la venta rápida» (bitácora) y «Oculto en la feria, presente en el resto»

## 3. Feria, servidor: filtro y foto

- [x] 3.1 Pruebas primero en `services/fair/fair-sale-service.test.ts`: excluye productos con `show_in_fair = false`; devuelve `photoUrl` de la foto más reciente, o `null` sin foto; conserva el orden por más vendidos — escenarios «Producto oculto de la venta rápida», «Producto con foto», «Producto sin foto»
- [x] 3.2 `FairSaleService.listSellableProducts`: `.eq("show_in_fair", true)`, lote `listForEntities` + `signedThumbnailUrls` por el `AttachmentService`; `FairProduct` gana `photoUrl` y `photoAttachmentId`
- [x] 3.3 Prueba de integración (`tests/integration/`) contra la base local: un producto oculto no sale y uno visible con foto trae una URL firmada que responde 200

## 4. Feria, sin conexión: miniaturas en Dexie

- [x] 4.1 `lib/offline/types.ts`: `FairSnapshotProduct.photoAttachmentId` y un tipo `FairPhoto`; `lib/offline/db.ts`: `db.version(3).stores({ fairPhotos: "id, snapshotId" })` con un comentario que explique por qué `OUTBOX_SCHEMA_VERSION` no cambia
- [x] 4.2 Pruebas primero en `lib/fair/snapshot.test.ts` (fake-indexeddb): guardar y leer fotos por snapshot; no descargar otra vez una foto con el mismo `attachmentId`; borrar las de productos que salieron o cambiaron de foto; un `fetch` fallido deja el producto sin foto y no lanza error — escenarios «Entrar con red captura el catálogo», «Una miniatura que no se pudo guardar», «Volver a entrar con red renueva la captura»
- [x] 4.3 Implementar en `lib/fair/snapshot.ts` `captureFairPhotos(snapshotId, products, fetcher)` con concurrencia 4 y tiempo máximo por imagen, `readFairPhotos(snapshotId)` y la limpieza
- [x] 4.4 `features/fair/fair-session-store.ts`: `start` guarda `photoAttachmentId` en el snapshot y lanza `captureFairPhotos` **después** de pintar y sin esperarla; `restore` carga las fotos guardadas; prueba de que la cuadrícula se fija antes de que termine la descarga — requisito «Guardar las miniaturas SHALL NOT retrasar la aparición de la cuadrícula»
- [x] 4.5 La sesión convierte las miniaturas guardadas en `objectURL` y revoca las del juego anterior; hook `useFairPhotoUrls` que elige la copia local de la foto vigente o la `photoUrl`; pruebas con `URL.createObjectURL`/`revokeObjectURL` simulados — escenarios «Abrir sin red tras haber entrado con red», «Las miniaturas no caducan durante la feria»

## 5. Carrito: cantidades

- [x] 5.1 Pruebas primero en `lib/fair/cart.test.ts`: `addLine` con `quantity` 3 crea la línea con 3 y suma a una existente; `setLineQuantity` fija la cantidad y no baja de 1 — escenarios «Agregar varias unidades de una vez», «Tocar dos veces el mismo producto», «Cambiar la cantidad desde el panel», «La cantidad de una línea no baja de 1»
- [x] 5.2 Implementar `addLine(..., quantity = 1)` y `setLineQuantity` en `lib/fair/cart.ts` (actualizar el comentario de «no existe quitar una unidad») y exponer `add(product, id, quantity)` y `setQuantity` en `features/fair/cart-store.ts`

## 6. Feria, interfaz

- [x] 6.1 Pruebas primero en `features/fair/product-grid.test.tsx`: tocar la tarjeta no agrega; − no baja de 1; + sube; *Agregar* llama con la cantidad y devuelve el selector a 1; la miniatura se muestra con `photoUrl` y el sustituto sin ella; vacío con el texto nuevo; `aria-label` con el nombre del producto — escenarios «Tocar la tarjeta no agrega», «El selector no baja de 1», «Agregar varias unidades de una vez», «Producto con foto», «Producto sin foto», «Línea sin productos que mostrar»
- [x] 6.2 Reescribir `features/fair/product-grid.tsx`: tarjeta no interactiva con miniatura lateral, selector `− n +` y *Agregar* (objetivos ≥ 44 px), `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- [x] 6.3 Pruebas en `features/fair/cart-bar.test.tsx`: sin lista de líneas; unidades y total; *Ver carrito* deshabilitado con el carrito vacío — escenarios «El total sigue al carrito», «Cobrar con el carrito vacío»
- [x] 6.4 Reescribir `features/fair/cart-bar.tsx` con *Ver carrito*
- [x] 6.5 Pruebas en el nuevo `features/fair/cart-drawer.test.tsx`: abre por la derecha; líneas con subtotal, − / + y quitar; monto propuesto igual al total y que lo sigue mientras no se edita; una vez editado, se conserva; método elegible; *Registrar pedido* llama con monto y método; vacío con *Registrar pedido* deshabilitado — escenarios «Monto propuesto», «El monto propuesto sigue a los cambios del panel», «Quitar una línea», «Cambiar la cantidad desde el panel», «Cobrar con el carrito vacío»
- [x] 6.6 Crear `features/fair/cart-drawer.tsx` (`Sheet side="right"`) y eliminar `checkout-sheet.tsx` y `checkout-sheet.test.tsx`
- [x] 6.7 Pruebas en el nuevo `features/fair/fair-toast.test.tsx`: `role="status"`, desaparece solo a los 2,5 s (timers falsos), un segundo mensaje reemplaza al primero, texto de venta en cola — escenarios «Mensaje de éxito», «Mensaje de éxito sin señal»
- [x] 6.8 Crear `features/fair/fair-toast.tsx` (`fixed`, `pointer-events-none`, `aria-live="polite"`)
- [x] 6.9 Pruebas en `features/fair/fair-screen.test.tsx`: recorrido *Agregar*, *Agregar*, *Ver carrito*, *Registrar pedido* encola una venta con dos líneas y su cobro; tras registrar, el panel se cierra, el carrito queda vacío, los selectores vuelven a 1 y se muestra el mensaje antes de que `captureSale` resuelva; *Agregar* con el mensaje visible entra en un carrito nuevo — escenarios «Venta de dos productos en cuatro interacciones», «Retorno sin pantallas intermedias», «La vista queda limpia», «No se espera al servidor», «Venta siguiente inmediata», «Precio del momento»
- [x] 6.10 Integrar en `features/fair/fair-screen.tsx`: `CartDrawer`, `FairToast`, `key` de la cuadrícula que cambia en cada venta, fotos de `useFairPhotoUrls`, y el mensaje según el `status` de `captureSale`
- [x] 6.11 Correr `npm run test:unit -- features/fair lib/fair lib/catalog features/catalog services` en verde

## 7. E2e

- [x] 7.1 Adaptar `tests/e2e/fair-offline.spec.ts` al recorrido nuevo (*Agregar* / *Ver carrito* / *Registrar pedido*) sin perder sus aserciones de veinte ventas sin red y sin duplicados
- [x] 7.2 Nuevo caso e2e, con su propia organización: producto con foto y otro oculto con el ajuste; abrir `/fair` con red, comprobar la miniatura y que el oculto no aparece; cortar la red, recargar, comprobar que la miniatura sigue (desde un blob) y registrar una venta de 3 unidades con mensaje «se enviará al recuperar la señal» — escenarios «Producto oculto de la venta rápida», «Abrir sin red tras haber entrado con red», «Mensaje de éxito sin señal», «Agregar varias unidades de una vez»
- [x] 7.3 Caso a 390 px: sin desplazamiento horizontal con tarjetas, selector y barra — escenario «Sin desplazamiento horizontal»
- [x] 7.4 Correr ambos specs en solitario con Playwright

## 8. Cierre

- [x] 8.1 `npm run lint` y `npm run typecheck` limpios
- [x] 8.2 Verificar en el navegador (dev en el puerto 3010): ocultar un producto desde su edición, abrir `/fair`, ver las miniaturas, agregar con cantidad, abrir *Ver carrito*, editar cantidades, registrar y ver el mensaje y la vista limpia
- [x] 8.3 `graphify update .` (tras el cambio de esquema) y revertir `.graphify_root`/`manifest.json` si se trabajó en un worktree
- [x] 8.4 `openspec validate fair-product-photos-visibility-cart-drawer --strict` sin errores
