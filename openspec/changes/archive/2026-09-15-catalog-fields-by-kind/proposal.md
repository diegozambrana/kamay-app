# Catálogo: campos según el tipo de ítem

## Why

El catálogo (V10) y el detalle de ítem (V11) tratan igual a los tres tipos de ítem aunque no se usen igual. El formulario muestra siempre los mismos campos. Al abrir «Nuevo ítem» en la pestaña de insumos, pide un **Precio de venta referencial** que ningún insumo usa: los pedidos y el modo feria solo venden productos (`listProductsWithVariants`, `FairSaleService.listSellableProducts` filtra `kind = 'product'`) y la compra ofrece insumos y activos sin precio de venta. Pasa lo mismo con el **Mínimo**: solo lo lee `item_balances`, que está definida sobre `kind = 'supply'`, y la migración del catálogo ya lo anota como «solo aplica a insumos». En un producto o un activo, ese campo se captura y no se usa en ningún sitio. Además, el botón dice «Nuevo ítem» en todas las pestañas y el diálogo pide elegir un **Tipo** que la pestaña ya decidió. Se puede crear un producto desde la pestaña de insumos y, al editar, un insumo con movimientos de inventario se puede convertir en producto.

## What Changes

- **Una sola matriz de campos por tipo**, que usan el formulario, el listado, el detalle y las variantes:

  | Campo | Insumo | Producto | Activo |
  |---|---|---|---|
  | Nombre, Línea, Unidad, Categoría, Descripción, Fotografía | ✓ | ✓ | ✓ |
  | Precio de venta referencial (ítem y variante) | — | ✓ | — |
  | Mínimo | ✓ | — | — |

- **El botón de alta se nombra según la pestaña**: «Nuevo insumo», «Nuevo producto» y «Nuevo activo». El diálogo se titula igual («Nuevo insumo»…), su botón de envío dice «Crear insumo»… y su descripción corresponde al tipo. La acción del vacío inicial pasa de «Crear el primer ítem» a «Crear el primer insumo»…
- **El Tipo deja de mostrarse en el diálogo**, al crear y al editar. Al crear, lo fija la pestaña activa. Al editar, se conserva el tipo guardado, que ya no cambia. El título de edición dice «Editar insumo», «Editar producto» o «Editar activo».
- **El diálogo muestra solo los campos del tipo**: en un insumo desaparece *Precio de venta referencial*; en un producto, *Mínimo*; en un activo, los dos.
- **El listado muestra solo las columnas del tipo**: las pestañas de insumos y de activos pierden la columna *Precio de venta*. La de productos la conserva.
- **El detalle (V11) muestra solo los datos generales del tipo**: sin *Precio de venta referencial* en insumos ni activos, y sin *Mínimo* en productos ni activos.
- **Las variantes de un insumo o un activo no llevan precio de venta**: ni en la lista de variantes del detalle ni en su formulario.
- **El servidor aplica la misma regla, no solo la interfaz**. Al crear o editar, un campo que no corresponde al tipo se guarda vacío (`null`), aunque la petición traiga un valor. Editar un ítem no cambia su tipo aunque la petición traiga otro. Si hoy hay un insumo con precio de venta guardado, ese valor se vacía la próxima vez que alguien lo edite, y la bitácora registra el cambio.
- **BREAKING (pruebas y documentación, no datos)**: el nombre accesible «Nuevo ítem» y «Crear ítem» desaparece de V10, y el combobox *Tipo* ya no existe en el diálogo. Hay que ajustar las pruebas e2e y unitarias que los usan y el manual de uso.

## Capabilities

### New Capabilities

_Ninguna._ La regla pertenece al catálogo que ya existe.

### Modified Capabilities

- `catalog-directory`:
  - Requisitos nuevos: *Los campos de un ítem dependen de su tipo* (la matriz, aplicada también en el servidor) y *El tipo de un ítem se fija al crearlo*. *Un ítem declara su tipo, su unidad y su alcance de línea* no cambia.
  - *Pantalla de catálogo (V10)* hace que las columnas y el botón de alta dependan de la pestaña. El precio de venta pasa a mostrarse solo en productos.
  - *Pantalla de detalle de ítem (V11)* hace que los datos generales y el precio de las variantes dependan del tipo.

## Impact

- **UI (`features/catalog/`)**: `catalog-screen.tsx` (columnas por tipo, texto del botón y del vacío), `item-form-dialog.tsx` (sin selector de Tipo, campos y textos por tipo), `item-detail.tsx` (datos generales por tipo, tipo del ítem pasado a las variantes), `variants-list.tsx` y `variant-form-dialog.tsx` (precio de venta solo en productos).
- **`lib/catalog/`**: un módulo nuevo con la matriz de campos por tipo y los textos por tipo en `labels.ts`. `schema.ts` normaliza a `null` los campos que no corresponden al tipo.
- **`actions/catalog.ts`**: `updateItem` usa el tipo guardado del ítem, no el que llega en la petición. `createItemVariant` y `updateItemVariant` consultan el tipo del ítem padre para normalizar el precio de la variante.
- **`services/catalog/item-service.ts`**: `update` deja de escribir `kind`.
- **Sin cambios** en la base de datos, las migraciones, RLS, la bitácora, la semilla (ya cumple la matriz: los insumos no tienen precio de venta, los productos no tienen mínimo y los activos no tienen ninguno de los dos), los pedidos, el modo feria, las compras ni el inventario.
- **Pruebas**:
  - Unitarias nuevas o ajustadas en `features/catalog/catalog-screen.test.tsx`, `item-detail.test.tsx`, un test nuevo del diálogo de ítem y `lib/catalog/schema.test.ts`.
  - E2E a ajustar donde se pulsa «Nuevo ítem», «Crear ítem» o el combobox *Tipo*: `archive-restore.spec.ts`, `assets.spec.ts`, `account.spec.ts`, `images.spec.ts`, `accessibility.spec.ts` y el `createSupply` de `inventory.spec.ts`.
- **Documentación**: `docs/manual-de-uso.md` (alta de ítem) y `docs/manual-de-pruebas.md` (CAT-01).
- **Fuera de alcance**:
  - Una restricción o un trigger en la base que haga inmutable `kind` o rechace `sale_price`/`min_stock` según el tipo. La regla vive en la acción y el servicio; si hace falta en la base, será un cambio aparte con su migración y su pgTAP.
  - Limpiar en bloque los valores que ya existan en campos que no corresponden.
  - Mover ítems entre pestañas o cambiar el tipo de un ítem existente por otra vía.
  - Cambiar los datos de activo (KAM-19) o las secciones de inventario (KAM-18) del detalle.
  - Los buscadores de ítems de pedidos, compras y tareas.
  - Actualizar la captura `docs/capturas/catalogo-nuevo-item.png`.
