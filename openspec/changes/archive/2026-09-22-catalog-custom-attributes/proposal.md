# Atributos de catálogo definidos por la organización, y disponibilidad por variante

> Origen: `specs/PRD/kamay-backlog-sprint-01.md` — KAM-31, más la exploración del 2026-09-21 que amplió el alcance a las salidas de inventario por variante.

## Why

Cada rubro describe sus insumos y productos con datos distintos: un filamento tiene color, marca y temperaturas; una taza tiene capacidad y acabado. Hoy el catálogo solo ofrece nombre, unidad, categoría y descripción, así que esos datos van en texto suelto o no van. `item_variants.attributes` existe desde KAM-06 y nadie lo escribe ni lo lee.

Además, `item_balances` suma todas las variantes de un insumo en un solo saldo: el filamento negro y el rojo son un número. Y las salidas de inventario nunca llevan variante, porque los diálogos de consumo y de conteo no la piden. Ver «cuánto negro queda» exige que la entrada, la salida y el conteo distingan la variante, y que una vista lo derive.

## What Changes

- **Cada categoría de ítem declara sus atributos.** Una lista ordenada de atributos con nombre, tipo (texto, número con unidad, lista de opciones, o color), si es obligatorio y si aplica **al ítem o a la variante**. Se declara una vez por categoría y sirve para todos los ítems de esa categoría. Solo la persona dueña la gestiona, desde la sección «Categorías de ítem» de Configuración, con el patrón de tabla, menú «⋯», diálogo y archivado que ya usan las demás secciones.
- **Un atributo de tipo color guarda un color en hex.** Se registra con un selector de color o escribiendo el hex (`#1A1A1A`), y se muestra con su muestra de color junto al hex, en el detalle y en la lista de variantes. *Añadido el 2026-09-22 a pedido de la persona usuaria; reemplaza la decisión de la exploración de modelar el color como lista.*
- **Los formularios de ítem y de variante generan sus campos desde la definición** de la categoría del ítem, validados con Zod en el cliente y en el servidor. Un ítem cuya categoría no declara atributos, o que no tiene categoría, ve su formulario exactamente como hoy. Los valores de variante van en `item_variants.attributes`; los de ítem, en una columna `items.attributes jsonb` nueva. Ambos roles llenan valores; solo la dueña define atributos.
- **Un atributo archivado conserva sus valores.** Se sigue mostrando en el detalle con su etiqueta, pero el formulario no lo ofrece de nuevo. Lo mismo cuando un ítem cambia de categoría: los valores de la categoría anterior se conservan y se muestran marcados como tales.
- **El detalle del ítem (V11) muestra los atributos como datos rotulados**, con su unidad cuando la tienen, y no dentro de la descripción.
- **El catálogo (V10) filtra por los atributos de lista del ítem**, junto al filtro de categoría. Los atributos de variante no filtran en este corte.
- **La disponibilidad se ve por variante.** Una vista hermana `item_variant_balances` deriva el saldo por `(ítem, variante)`; `item_balances` no cambia y el mínimo sigue siendo del ítem. El detalle de un insumo con variantes muestra el saldo de cada una, y una fila «Sin variante» cuando existen movimientos anteriores sin variante.
- **Consumo y conteo eligen variante cuando el ítem las tiene**, con la misma regla que ya aplica la compra: un insumo con variantes vigentes exige elegir cuál. El conteo pregunta cuánto hay **de esa variante** y calcula la diferencia contra su saldo derivado. Desde el detalle, cada fila de variante trae su consumo y su conteo con la variante puesta, así que se mantiene el límite de tres interacciones; desde el registro rápido, elegir la variante suma exactamente una.
- **Semilla de Impresión 3D:** categoría de insumo «Filamento» con marca (lista), temperatura mínima y máxima (número, °C) y velocidad recomendada (número, mm/s) al ítem, y color (lista) a la variante; un filamento «PLA Sunlu» con dos colores.
- **Nada derivado se guarda.** Ni precio por kilo, ni último costo, ni saldo, en ninguna columna de `items` ni de `item_variants`. El precio de referencia del filamento ya vive como parámetro de la calculadora de KAM-27 y no se duplica como atributo.

## Capabilities

### New Capabilities

_Ninguna._ La definición de atributos es configuración de la organización; los valores son catálogo; el saldo por variante es inventario. Todo cabe en capacidades que ya existen.

### Modified Capabilities

- `org-configuration`:
  - Las tablas de configuración suman `item_category_attributes`, con la matriz de lectura para miembros y escritura para la dueña.
  - Requisito nuevo: cada categoría de ítem declara una lista ordenada de atributos, con tipo, unidad, obligatoriedad y alcance (ítem o variante); archivar un atributo conserva sus valores.
- `settings-interaction`: la fila de una categoría de ítem suma «Atributos» a su menú «⋯», que abre la gestión de atributos de esa categoría con su propia tabla, menú, diálogo y archivados.
- `catalog-directory`:
  - `items` pasa a llevar `attributes jsonb`, requisito de la forma canónica.
  - Requisito nuevo: los formularios de ítem y de variante ofrecen los atributos de la categoría, validados por tipo en cliente y servidor; los valores de atributos retirados o de otra categoría se conservan y se muestran.
  - V10 suma el filtro por atributos de lista del ítem.
  - V11 muestra los atributos como datos rotulados y la disponibilidad por variante.
  - El requisito «El catálogo no almacena nada derivado» se refuerza: tampoco precio de referencia por unidad de compra.
  - La semilla de Geeko Store declara «Filamento» con sus atributos y un filamento con dos colores.
- `inventory`:
  - Requisito nuevo: el saldo por variante se deriva en una vista hermana, con fila «Sin variante» para los movimientos que no la llevan.
  - «Registrar un consumo cuesta tres interacciones o menos» y «El ajuste por conteo no pide justificación» pasan a exigir la variante cuando el ítem las tiene, y el conteo se calcula contra el saldo de la variante.
  - «El detalle del insumo muestra saldo, movimientos y evolución de precios» suma el saldo por variante.

## Impact

- **Base de datos**: una migración nueva con la tabla `item_category_attributes` (RLS de configuración, trigger `audit`, unicidad de nombre por categoría sin mayúsculas, posición), la columna `items.attributes jsonb not null default '{}'`, y la vista `item_variant_balances` con `security_invoker`. Lleva su pgTAP. `supabase/seed.sql` (`e2e.seed_geeko`) suma la categoría «Filamento», sus atributos y un filamento con dos variantes; `supabase/tests/seed_geeko.test.sql` lo verifica.
- **Servicios y acciones**:
  - Servicio nuevo `services/configuration/item-category-attribute-service.ts`.
  - Servicio nuevo `services/inventory/variant-balance-service.ts` sobre la vista.
  - `services/catalog/item-service.ts` e `item-variant-service.ts`: columna `attributes`, filtro por atributo de lista.
  - `actions/configuration.ts`: alta, edición, archivado y desarchivado de atributos.
  - `actions/catalog.ts`: valida los atributos contra la definición de la categoría antes de escribir.
  - `actions/inventory.ts`: consumo y conteo exigen variante cuando el ítem las tiene.
  - `actions/expenses.ts`: rechaza con un mensaje comprensible una línea de compra cuya variante no es de su ítem, que la base ahora rechaza en el movimiento.
- **Lógica compartida** (`lib/`): `lib/catalog/attributes.ts` construye el esquema Zod y el modelo de campos desde una definición; es la única fuente para formulario, detalle y servidor. `lib/inventory/count.ts` no cambia: recibe el saldo de la variante.
- **UI**:
  - `features/settings/item-categories-section.tsx` gana la acción «Atributos»; sección nueva de atributos con su diálogo (nombre, tipo, unidad, opciones, obligatorio, alcance).
  - `features/catalog/item-form-dialog.tsx` y `variant-form-dialog.tsx`: campos generados. `item-detail.tsx`: atributos rotulados. `variants-list.tsx`: columna de disponibilidad para insumos. `catalog-screen.tsx`: filtros por atributo de lista.
  - `features/inventory/consumption-dialog.tsx` y `count-dialog.tsx`: selector de variante.
  - Las páginas `catalog/page.tsx` y `catalog/[id]/page.tsx` cargan definiciones y saldos por variante.
- **Transversales**:
  - `lib/export/tables.ts`: tabla nueva y la columna nueva de `items`. La prueba de manifiesto de KAM-23 falla si faltan.
  - Bitácora: etiquetas de la tabla nueva y de `items.attributes` (oculto, como el de variantes), descripción y desarchivado (`lib/activity/fields.ts`, `describe.ts`, `unarchive.ts`, `services/activity/label-service.ts`, `app/(app)/activity/page.tsx`).
  - `types/index.ts`.
- **Documentos de producto**: `specs/PRD/kamay-esquema-base-de-datos-supabase.md` (§6 tabla nueva, §7 columna, §10 vista) y `kamay-especificacion-producto-v6.md` (V10, V11, V15). Los atributos de variante ya figuran en el modelo conceptual; lo nuevo es que estén definidos por categoría, no un concepto nuevo.
- **Pruebas**: pgTAP de la migración (forma, RLS, unicidad, vista por variante igual a la suma de movimientos, ausencia de columnas derivadas, idempotencia de la entrada por variante). Unitarias de la generación del esquema y del formulario, validación por tipo, conservación de valores retirados, servicios y acciones. Integración: manifiesto de exportación y cobertura de campos de bitácora. E2E: definir «Filamento», crear dos filamentos con marca y color, comprar y consumir de un color, ver la disponibilidad por variante y los datos técnicos.
- **Fuera de alcance**:
  - Precio por kilo, último costo o saldo en cualquier columna; precio de referencia como atributo.
  - Un catálogo separado del de ítems; biblioteca de imágenes o diseños.
  - Mínimo y alerta de bajo stock por variante: el mínimo sigue siendo del ítem y el panel no cambia.
  - Atributos por línea de negocio; fórmulas o validaciones cruzadas entre atributos.
  - Filtro del catálogo por atributos de variante, y por atributos de tipo color.
  - Nombres de color: un atributo de tipo color guarda el hex, no un nombre. La semilla conserva «Color» como lista con nombres.
  - Orden manual de los atributos: se listan por posición de creación.
  - Conversión de unidades del filamento (kilos a gramos) y conectar los atributos con la calculadora de KAM-27.
  - Atributos en contactos, pedidos, tareas o egresos.
  - Último costo por variante: `item_last_cost` sigue siendo por ítem.
