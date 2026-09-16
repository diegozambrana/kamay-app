## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/catalog-directory/spec.md`.

Estado actual que condiciona el enfoque:

- **Un solo formulario para los tres tipos.** `features/catalog/item-form-dialog.tsx` recibe `defaultKind` y lo guarda en estado local. Muestra un `Select` de *Tipo* y siempre los mismos campos. `catalog-screen.tsx` lo monta dos veces: una para el alta (`defaultKind={kind}` de la pestaña) y otra para la edición (`defaultKind={editing.kind}`). `item-detail.tsx` lo monta una vez más para la edición.
- **Los datos ya cumplen la matriz.** En la semilla, los insumos tienen `sale_price` en null, los productos no tienen `min_stock` y los activos no tienen ninguno de los dos. `item_balances` solo cubre `kind = 'supply'`, y los pedidos y el modo feria solo leen `sale_price` de productos. Ninguna vista ni consulta depende de que un insumo o un activo tenga precio de venta.
- **La escritura pasa por un solo camino.** `actions/catalog.ts` (`createItem`, `updateItem`, `createItemVariant`, `updateItemVariant`) valida con `itemFormSchema` e `itemVariantFormSchema` de `lib/catalog/schema.ts` y delega en `ItemService` e `ItemVariantService`. `ItemService.update` escribe hoy `kind` en cada edición.
- **Otro camino de alta, fuera de este cambio.** La función SQL de entregables de tarea (`20260909180000_task_deliverables.sql`) crea ítems de los tres tipos y acepta `sale_price` en su carga, pero ninguna pantalla lo envía: el diálogo de cierre de tareas no lo pide.
- **La tabla del catálogo** (`components/data-table/data-table.tsx`) recibe un arreglo de columnas: filtrarlo por tipo no requiere cambiar el componente.

## Goals / Non-Goals

**Goals:**

- Que «qué campo corresponde a qué tipo» esté escrito una sola vez y lo lean el formulario, el listado, el detalle, las variantes y la validación del servidor.
- Que el servidor garantice la matriz y la inmutabilidad del tipo aunque la petición no venga de la interfaz.
- Cambiar lo mínimo en los componentes: los mismos diálogos, la misma tabla y las mismas acciones.

**Non-Goals:**

- Garantizarlo en la base de datos (ver D4).
- Separar el formulario en tres componentes, uno por tipo.
- Tocar la función SQL de entregables de tarea.

## Decisions

### D1 · La matriz vive en `lib/catalog/fields.ts`, como datos

Un módulo nuevo exporta la matriz como un registro por tipo:

```ts
export const ITEM_KIND_FIELDS: Record<ItemKind, { salePrice: boolean; minStock: boolean }> = {
  supply:  { salePrice: false, minStock: true  },
  product: { salePrice: true,  minStock: false },
  asset:   { salePrice: false, minStock: false },
};
```

Solo están los dos campos que varían. Nombre, línea, unidad, categoría, descripción y foto son comunes y no se listan. Se añade una función pura `applyKindFields(kind, values)` que devuelve los valores con `null` en los campos que no corresponden. La usan el esquema y las acciones.

*Alternativas descartadas:*
- Condiciones sueltas (`kind === "product"`) en cada componente. Serían cuatro sitios que pueden discrepar, que es justo el problema que este cambio corrige.
- Una configuración de formulario más general (etiquetas, orden, tipos de input). Hoy solo varían dos campos y la generalidad no se justifica.

### D2 · Los textos por tipo, en `labels.ts`

`lib/catalog/labels.ts` ya tiene `ITEM_KIND_SINGULAR` («Insumo», «Producto», «Activo»). Los textos nuevos se forman a partir de él, en minúscula y sin artículo:

- «Nuevo insumo», «Crear insumo», «Editar insumo» y «Crear el primer insumo», con el mismo patrón para producto y activo.
- Los tres sustantivos son masculinos, así que «Nuevo»/«el primer» concuerdan sin tabla de género. Aun así, se deja un mapa explícito de textos por tipo (`ITEM_KIND_COPY`) en lugar de concatenar cadenas. Si mañana hay un tipo femenino, se añade una fila y no se cambian las plantillas.
- Cada tipo lleva además su descripción del diálogo. Insumo: «Lo que compras para producir.» Producto: «Lo que vendes.» Activo: «Una máquina o herramienta del taller.»

Los textos siguen la convención de mayúscula inicial de la interfaz («Nuevo ítem», «Ver archivados»), así que es «Nuevo insumo» y no «Nuevo Insumo».

### D3 · El formulario recibe `kind` fijo y deja de tener estado de tipo

`ItemFormDialog` sustituye `defaultKind` por `kind: ItemKind`. Al editar se pasa `item.kind`, y el diálogo lo usa tal cual y no lo guarda en estado. Desaparece el `Select` de *Tipo*. El `kind` sigue viajando en la carga, porque `itemFormSchema` lo exige y el alta lo necesita. Los campos *Precio de venta referencial* y *Mínimo* se muestran según `ITEM_KIND_FIELDS[kind]`. Al ocultarse, no se envían: el esquema los recibe vacíos y la normalización los deja en `null`.

La rejilla de dos columnas conserva su orden. Si un tipo queda con un número impar de campos, la rejilla lo acomoda sola, sin reglas de maquetación por tipo.

`VariantFormDialog` y `VariantsList` reciben `itemKind` y muestran el precio según la misma matriz. `item-detail.tsx`, que ya conoce el ítem, pasa `item.kind`.

### D4 · El servidor normaliza en la acción, no en la base

- **`createItem`**: el esquema aplica `applyKindFields(kind, …)` con el tipo de la petición. Al crear, ese tipo es el que decide.
- **`updateItem`**: lee el ítem con `ItemService.findById` y normaliza con **el tipo guardado**, no con el de la petición. `ItemService.update` deja de escribir `kind`. Aunque el cliente mande otro tipo, el tipo no cambia y los campos se ajustan al tipo real. Si el ítem no existe o es de otra organización, la acción responde con el error comprensible de siempre.
- **`createItemVariant` y `updateItemVariant`**: leen el tipo del ítem padre (`itemId` ya viaja en la carga) y vacían `salePrice` si el tipo no es producto.

*Alternativa descartada: una restricción `CHECK` y un trigger en `items` e `item_variants`.* Sería la garantía más fuerte y el patrón que el proyecto usa para archivar. La descartamos por tres motivos:
1. Obligaría a una migración con su pgTAP en un cambio que la persona usuaria pidió como mejora de interfaz.
2. La función de entregables de tarea, que hoy acepta `sale_price` para cualquier tipo, empezaría a fallar en lugar de ignorar el dato.
3. Los datos que ya estén en producción podrían violar la restricción y bloquear la migración.

Queda anotado en *Fuera de alcance* de la propuesta como un cambio aparte si hace falta.

*Alternativa descartada: normalizar dentro de `ItemService`.* El servicio es acceso a datos y no conoce reglas de interfaz. La acción ya concentra sesión, organización y validación.

### D5 · Un valor antiguo que ya no corresponde se vacía al guardar, no se conserva

Si un insumo tiene hoy `sale_price` guardado, editarlo lo vacía, y la bitácora registra el cambio por el trigger `log_activity()` de siempre.

*Alternativa descartada: conservar el valor oculto, sin enviarlo en la edición.* Exigiría que la edición distinguiera «no enviado» de «vacío». Además, dejaría en la base un dato que ninguna pantalla muestra ni permite corregir, y el catálogo no guarda nada que nadie lea.

### D6 · El listado filtra columnas por la matriz

En `catalog-screen.tsx`, la columna `salePrice` se incluye solo si `ITEM_KIND_FIELDS[kind].salePrice`. El resto de columnas, las acciones por fila, el distintivo de bajo mínimo y los filtros no cambian. El texto del botón de alta, el del vacío inicial y la descripción del vacío con filtros salen de `ITEM_KIND_COPY[kind]`.

## Risks / Trade-offs

- **[Riesgo] Las pruebas e2e dependen de «Nuevo ítem», «Crear ítem» y el combobox *Tipo*.** Hay seis archivos afectados (ver la propuesta, *Impact*), y `assets.spec.ts` elige el tipo a mano en el diálogo. → Se ajustan en el mismo cambio. La suite completa tarda unos 18 minutos, así que primero se corren solo los archivos tocados y la suite completa al final.
- **[Riesgo] `archive-restore.spec.ts` rellena *Precio de venta referencial* en `?kind=product`.** Sigue siendo válido, porque el producto conserva el campo. → Se verifica que no cambie, sin reescribirlo.
- **[Trade-off] La garantía no está en la base.** Un cliente con acceso directo a PostgREST podría guardar un precio de venta en un insumo. → No rompe nada: ninguna vista lo lee, y la siguiente edición desde la aplicación lo vacía. Si el riesgo cambia, se añade la restricción en un cambio aparte (D4).
- **[Trade-off] `updateItem` hace una lectura más por edición** (`findById`) antes de escribir. → Es una fila por clave primaria en una acción poco frecuente, sin impacto medible frente al presupuesto de `performance-budget`.
- **[Riesgo] La función de entregables de tarea sigue aceptando `sale_price` en insumos y activos.** → Hoy ninguna pantalla lo envía. Se deja anotado y no se toca.

## Migration Plan

No hay migración de datos ni de esquema. El despliegue es un despliegue normal del frontend y de las acciones. Para revertir, basta volver a desplegar la versión anterior: ningún dato queda en un formato que la versión anterior no entienda. Los campos vaciados por D5 no se recuperan al revertir, pero la bitácora conserva el valor anterior de cada uno.
