## 1. Matriz de campos y textos por tipo

- [x] 1.1 `lib/catalog/fields.ts`: `ITEM_KIND_FIELDS: Record<ItemKind, { salePrice: boolean; minStock: boolean }>` (supply: mínimo; product: precio de venta; asset: ninguno) y la función pura `applyKindFields(kind, values)`, que devuelve `salePrice` y `minStock` en `null` cuando no corresponden al tipo. También `variantSalePriceFor(kind, salePrice)`, que vacía el precio de una variante si el tipo no es producto (design D1).
- [x] 1.2 `lib/catalog/fields.test.ts`: la matriz de los tres tipos; `applyKindFields` vacía el precio de venta de un insumo y de un activo, vacía el mínimo de un producto y de un activo, y conserva el resto de los valores sin tocarlos; `variantSalePriceFor` conserva el precio solo en productos.
- [x] 1.3 `lib/catalog/labels.ts`: `ITEM_KIND_COPY: Record<ItemKind, { newLabel; createLabel; editLabel; firstLabel; description }>` con «Nuevo insumo» / «Crear insumo» / «Editar insumo» / «Crear el primer insumo» / «Lo que compras para producir.», y lo equivalente para producto («Lo que vendes.») y activo («Una máquina o herramienta del taller.»). Mayúscula solo en la inicial (design D2).
- [x] 1.4 `lib/catalog/schema.ts`: `itemFormSchema` aplica `applyKindFields` según el `kind` validado (transformación posterior a la validación de importes). Ampliar `lib/catalog/schema.test.ts`: un insumo con `salePrice: "45"` sale con `salePrice: null`, y un producto con `minStock: "10"` sale con `minStock: null`. Cubre, a nivel de esquema, «El servidor descarta un precio de venta en un insumo» y «El servidor descarta un mínimo en un producto».

## 2. Servidor: tipo fijo y normalización

- [x] 2.1 `services/catalog/item-service.ts`: `update` deja de escribir `kind`. Ampliar `services/catalog/catalog-service.test.ts`: la carga de `update` no incluye `kind` («Editar no cambia el tipo», nivel de servicio).
- [x] 2.2 `actions/catalog.ts` · `updateItem`: leer el ítem con `ItemService.findById(org, id)`. Si no existe, responder con el error comprensible de siempre. Si existe, normalizar con `applyKindFields(stored.kind, …)` y guardar con el tipo guardado, sin mirar el que trae la petición (design D4).
- [x] 2.3 `actions/catalog.ts` · `createItemVariant` y `updateItemVariant`: leer el tipo del ítem padre por `itemId` y pasar el precio por `variantSalePriceFor` antes de delegar en `ItemVariantService` (design D4).
- [x] 2.4 `actions/catalog.test.ts` (nuevo, con el patrón de dobles de `actions/assets.test.ts`). Cada prueba cubre estos escenarios:
  - `createItem` de un insumo con precio 45 llega al servicio con `salePrice: null` («El servidor descarta un precio de venta en un insumo»).
  - `updateItem` de un producto con mínimo 10 llega con `minStock: null` («El servidor descarta un mínimo en un producto»).
  - `updateItem` de un insumo guardado que trae `kind: "product"` y precio 45 llega con `salePrice: null`, sin `kind` en la escritura («Editar no cambia el tipo»).
  - `updateItem` de un insumo guardado con precio sin enviar precio llega con `salePrice: null` («Un valor antiguo que ya no corresponde se vacía al editar»; el registro en bitácora ya lo cubre el trigger de auditoría de `items`, probado en `supabase/tests/catalog.test.sql`).
  - `createItemVariant` y `updateItemVariant` bajo un insumo y bajo un activo llegan con `salePrice: null` («La variante de un insumo no lleva precio de venta»).
  - Bajo un producto, la variante conserva 55 («La variante de un producto conserva su precio»).
  - `updateItem` de un id inexistente devuelve un error y no escribe.

## 3. Formulario de ítem

- [x] 3.1 `features/catalog/item-form-dialog.tsx`: sustituir `defaultKind` por `kind: ItemKind` fijo, quitar el estado `kind` y el `Select` de *Tipo*, y seguir enviando `kind` en la carga. Título, descripción y botón de envío salen de `ITEM_KIND_COPY[kind]` («Nuevo insumo» / «Editar insumo», «Crear insumo» / «Guardar cambios»). *Precio de venta referencial* y *Mínimo* se muestran según `ITEM_KIND_FIELDS[kind]` (design D3).
- [x] 3.2 `features/catalog/item-form-dialog.test.tsx` (nuevo, con `actions/catalog` simuladas):
  - Un insumo muestra *Mínimo* y no *Precio de venta referencial* («Un insumo no pide precio de venta»).
  - Un producto muestra el precio de venta y no el mínimo («Un producto no pide mínimo»).
  - Un activo no muestra ninguno de los dos («Un activo no pide precio de venta ni mínimo»).
  - En los tres tipos, al crear y al editar, no hay combobox *Tipo* («El formulario no ofrece elegir el tipo»).
  - El título de alta es «Nuevo insumo» y el de edición de un producto, «Editar producto».
  - Enviar el alta de un insumo llama a `createItem` con `kind: "supply"`.

## 4. Pantalla de catálogo (V10)

- [x] 4.1 `features/catalog/catalog-screen.tsx`:
  - La columna `salePrice` solo se incluye si `ITEM_KIND_FIELDS[kind].salePrice`.
  - El botón de alta pasa a `ITEM_KIND_COPY[kind].newLabel` y la acción del vacío inicial, a `firstLabel`.
  - Los dos `ItemFormDialog` pasan `kind` (el de la pestaña al crear, `editing.kind` al editar) (design D6).
- [x] 4.2 Actualizar `features/catalog/catalog-screen.test.tsx`. Se reescriben las pruebas que hoy buscan «Nuevo ítem» y leen el combobox *Tipo*, y se añaden estas:
  - En `kind="product"`, la tabla tiene la columna *Precio de venta* y la fila muestra su importe («Precio de venta solo en productos»).
  - En `kind="supply"` y en `kind="asset"`, no hay columna *Precio de venta* («Insumos y activos sin columna de precio de venta»).
  - El botón dice «Nuevo insumo», «Nuevo producto» o «Nuevo activo» según `kind` («El botón de alta nombra el tipo de la pestaña»).
  - «Nuevo insumo» abre un diálogo titulado «Nuevo insumo», sin combobox *Tipo* ni *Precio de venta referencial* («El formulario de alta corresponde a la pestaña»).
  - Enviarlo llama a `createItem` con `kind: "supply"` («El alta toma el tipo de la pestaña», nivel unitario).
  - Sin ítems ni filtros en `kind="asset"`, el vacío ofrece «Crear el primer activo» y abre el diálogo «Nuevo activo» («El vacío inicial nombra el tipo»).
  - «Editar» en la fila de un producto abre «Editar producto» con sus datos («El formulario de edición nombra el tipo»).

## 5. Detalle de ítem (V11) y variantes

- [x] 5.1 `features/catalog/item-detail.tsx`: en *Datos generales*, *Precio de venta referencial* y *Mínimo* se muestran según `ITEM_KIND_FIELDS[item.kind]`. El `ItemFormDialog` de edición pasa `kind={item.kind}` y `VariantsList` recibe `itemKind={item.kind}`.
- [x] 5.2 `features/catalog/variants-list.tsx` y `variant-form-dialog.tsx`: reciben `itemKind`. El precio de venta de cada variante, en la lista y en el formulario, solo aparece si `ITEM_KIND_FIELDS[itemKind].salePrice`.
- [x] 5.3 Ampliar `features/catalog/item-detail.test.tsx`:
  - Un insumo muestra *Mínimo* y no *Precio de venta referencial* en `item-general` («Datos generales de un insumo»).
  - Un producto muestra el precio y no el mínimo («Datos generales de un producto»).
  - Un activo no muestra ninguno de los dos («Datos generales de un activo»).
  - Un insumo con variantes no muestra precio en la lista, y su formulario «Nueva variante» no tiene campo de precio («Variantes de un insumo sin precio de venta»).
  - Un producto con variantes muestra el precio de cada una, y su formulario lo ofrece («Variantes de un producto con precio de venta»).

## 6. Pruebas e2e

- [x] 6.1 Sustituir «Nuevo ítem» y «Crear ítem» por el texto del tipo de la pestaña en `tests/e2e/archive-restore.spec.ts` (sobre `?kind=product` sigue rellenando *Precio de venta referencial*), `account.spec.ts`, `images.spec.ts` y `accessibility.spec.ts`. Comprobar antes en cada uno qué pestaña abre. Al implementar aparecieron dos más con el mismo botón, `offline-capture.spec.ts` y `pagination.spec.ts` (ambos en `?kind=supply`), y se ajustaron igual.
- [x] 6.2 `tests/e2e/assets.spec.ts`: quitar la elección del combobox *Tipo* y confiar en `?kind=asset` para crear el activo con «Nuevo activo» / «Crear activo» («El alta toma el tipo de la pestaña», e2e para activo).
- [x] 6.3 `tests/e2e/inventory.spec.ts` · `createSupply`: usar «Nuevo insumo» / «Crear insumo» en `?kind=supply` y comprobar que el diálogo no tiene *Precio de venta referencial* («El formulario de alta corresponde a la pestaña», e2e).
- [x] 6.4 Correr solo los archivos e2e tocados. Luego `npm run lint`, `npm run typecheck`, `npm run test:unit` y, al final, la suite e2e completa (unos 18 minutos).

## 7. Documentación

- [x] 7.1 `docs/manual-de-uso.md`, alta de ítem (líneas 519–523): el botón es «Nuevo insumo», «Nuevo producto» o «Nuevo activo» según la pestaña, y el tipo ya no se elige. Explicar qué campos pide cada tipo: el precio de venta solo en productos y el mínimo solo en insumos.
- [x] 7.2 `docs/manual-de-pruebas.md` · CAT-01: la tabla muestra la columna de precio de venta solo en la pestaña de productos. Añadir un caso para «Nuevo insumo» que abre el diálogo sin *Tipo* ni *Precio de venta referencial*.
- [x] 7.3 `graphify update .` tras terminar el código.
