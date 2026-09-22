## 1. Documentos de producto

- [x] 1.1 `specs/PRD/kamay-esquema-base-de-datos-supabase.md`:
  - §6: tabla `item_category_attributes` junto a `item_categories`, con la clave compuesta `(category_id, organization_id)`.
  - §7: `items.attributes jsonb`; restricción de objeto en `item_variants.attributes`; `unique (id, item_id)` en `item_variants`.
  - §10: vista `item_variant_balances` y la clave compuesta `(variant_id, item_id)` de `inventory_movements`.
  - Matriz de acceso: la tabla nueva junto a las demás de configuración.
- [x] 1.2 `specs/PRD/kamay-especificacion-producto-v6.md`: V15 suma «atributos por categoría de ítem»; V10 el filtro por atributo; V11 los datos técnicos y la disponibilidad por variante; el consumo y el conteo por variante.
- [x] 1.3 `specs/PRD/kamay-backlog-sprint-01.md`: KAM-31 pasa a «en cambio de OpenSpec»; su alcance suma consumo y conteo por variante, y sus preguntas abiertas remiten a `design.md`. Línea nueva en la bitácora del sprint.

## 2. Base de datos

- [x] 2.1 Antes de escribir la migración, consultar la base compartida por filas de `inventory_movements` y de `expense_items` cuya variante no sea de su ítem, y anotar aquí el resultado. Si hay, corregirlas antes de 2.3 (design, Risks).
  - *Hecho (2026-09-21):* cero movimientos y cero líneas de compra cruzadas en la base compartida, y ninguna variante con `attributes` que no sea objeto. La clave compuesta y los `check` se pueden crear sin tocar datos.
- [x] 2.2 Migración nueva `supabase/migrations/<timestamp>_catalog_custom_attributes.sql` (design D1, D2, D6):
  - `unique (id, organization_id)` en `item_categories`.
  - Tabla `item_category_attributes` con sus `check`, la clave compuesta, el índice único `(category_id, lower(name))` y el índice parcial de vigentes.
  - Trigger `audit`, `grant`/`revoke` y políticas calcados de `item_categories`.
  - Trigger `before update` que rechaza cambiar `type`, `scope` o `category_id`.
  - `items.attributes` con su `check` de objeto; `check` de objeto en `item_variants.attributes`.
  - `unique (id, item_id)` en `item_variants` y la clave compuesta `inventory_movements_variant_of_item_fk`.
  - Vista `item_variant_balances` con `security_invoker = true` y `grant select` a `authenticated` y `service_role`.
- [x] 2.3 `supabase/tests/catalog_custom_attributes.test.sql` (pgTAP, organización propia, `throws_ok` de cuatro argumentos):
  - **Forma**: un `type` o un `scope` fuera del juego se rechaza («An attribute outside the allowed types or scopes is rejected»). `color` junto a `Color` en la misma categoría se rechaza («An attribute name differing only in case is rejected», «Duplicate attribute name in the same category is rejected», nivel de base). El mismo nombre en dos categorías se acepta («The same attribute name in two categories», nivel de base). Una lista sin opciones y una unidad en un atributo de texto se rechazan («A list attribute needs its options», nivel de base).
  - **Clave compuesta**: un atributo con la organización de A y una categoría de B se rechaza («An attribute cannot belong to a category of another organization»).
  - **Inmutables**: actualizar `type`, `scope` o `category_id` se rechaza («Type and scope cannot change», nivel de base).
  - **RLS**: el ayudante lee, no inserta ni actualiza («Assistant reads configuration», «Assistant cannot write configuration», «The assistant cannot define attributes», nivel de base); otra organización ve cero filas («Configuration of another organization is invisible», «Definitions of another organization are invisible»); `delete` no borra («No one can delete configuration»).
  - **Bitácora**: el alta de la dueña deja un evento `created` con su autoría («Creating a configuration row is logged»).
  - **Valores**: los ítems existentes tienen `{}` y ningún evento nuevo en `activity_log` («Los ítems existentes quedan con atributos vacíos»); un arreglo, un texto o un nulo en `items.attributes` o `item_variants.attributes` se rechaza («Los atributos no admiten algo que no sea un objeto»).
- [x] 2.4 `supabase/tests/derived_values.test.sql` (ampliar) con un filamento de dos variantes:
  - Compras, consumo y ajuste dan Negro 1,5, Rojo 0,8 e ítem 2,3, iguales a la suma directa («Cada saldo coincide con la suma de sus movimientos»).
  - Una variante sin movimientos sale con cero («Una variante que nunca se movió»).
  - Un movimiento sin variante produce la fila `variant_id is null`; sin él, la fila no existe («Movimientos anteriores sin variante», «Sin fila «Sin variante» cuando no hace falta»).
  - Con mínimo 1, Negro en 0 y Rojo en 3, `item_balances.below_min` es falso («Un color agotado no dispara la alerta del ítem», nivel de base).
- [x] 2.5 `supabase/tests/catalog.test.sql` (ampliar la prueba de columnas derivadas): ninguna columna de `items`, `item_variants` ni `inventory_movements` se llama como saldo, existencias, último costo, costo promedio, margen o precio por kilo («Inspección de las columnas del catálogo», «El saldo por variante tampoco se guarda», «Ninguna columna guarda el saldo por variante»).
- [x] 2.6 `supabase/tests/inventory_idempotency.test.sql` (ampliar): una compra de la variante Negro sincronizada dos veces deja un solo movimiento con esa variante, y el saldo de Rojo no cambia («La compra de una variante sube el saldo de esa variante»). Un movimiento con la variante de otro ítem se rechaza.
- [x] 2.7 `supabase/tests/inventory_access.test.sql` (ampliar): un miembro de A obtiene cero filas de `item_variant_balances` de B («Saldos por variante de otra organización»).
- [x] 2.8 Aplicar la migración en la base compartida con `psql "$DB_URL" -1 -f`, sin `db reset`. Avisar antes. Anotar aquí el resultado.
  - *Hecho (2026-09-21):* primero en una transacción deshecha y después con `-1`. La tabla y la vista existen, los 43.004 ítems quedaron con `{}`, y la vista devolvió 10.882 filas en el ensayo. Se aplicó antes de 2.4 porque las pgTAP corren contra esta base; es aditiva y no rompe ramas que no conozcan los atributos.
- [x] 2.9 `supabase/seed.sql` · `e2e.seed_geeko` (design D10): categoría «Filamento», sus cinco atributos, «PLA Sunlu» con sus valores y las variantes «Negro» y «Rojo». Las variantes de la taza pasan a `{}`. Recrear la función en la base compartida extrayendo hasta `$geeko$;`.
  - *Hecho:* `e2e.seed_geeko` recreada en la base compartida; una copia nueva sale con «Filamento», sus cinco atributos en orden y «PLA Sunlu» con Negro y Rojo. A la Geeko de la base compartida (que no se reinicia) se le sembró el mismo bloque con los mismos identificadores, para que `seed_geeko.test.sql` lea lo que dejaría un `db reset`. Las tazas de esa Geeko conservan su clave antigua `capacidad`, que el detalle mostrará como dato que ya no se pide.
- [x] 2.10 `supabase/tests/seed_geeko.test.sql`: «Filamento» declara sus cinco atributos en orden y «PLA Sunlu» tiene sus valores y sus dos variantes con color («Filamento de la semilla con sus atributos»).
- [x] 2.11 Correr `supabase test db` completo y `graphify update .`.
  - *Hecho:* 77 archivos, 1.182 aserciones, todo en verde.

## 3. Lógica compartida y tipos

- [x] 3.1 `types/index.ts`: `ItemCategoryAttribute` (`id`, `organizationId`, `categoryId`, `name`, `type`, `unit`, `options`, `required`, `scope`, `position`, `archivedAt`), `Item.attributes`, `VariantBalance` (`itemId`, `variantId | null`, `variantName`, `variantArchivedAt`, `balance`). Corregir los errores de compilación y los factories de prueba.
- [x] 3.2 `lib/catalog/attributes.ts` (design D3): `attributeFieldsFor`, `attributesSchema`, `mergeAttributes` y `describeAttributes`.
- [x] 3.3 `lib/catalog/attributes.test.ts`:
  - `attributeFieldsFor` devuelve solo los vigentes de la categoría y el alcance, por posición («El formulario de variante ofrece los atributos de su categoría», «El formulario de ítem ofrece los atributos de ítem», nivel unitario); una categoría sin atributos da lista vacía («Un ítem sin atributos declarados se ve como hoy», nivel unitario); los de otra categoría no aparecen («La definición de una categoría no se aplica a otra», nivel unitario).
  - `attributesSchema`: obligatorio vacío falla («Un atributo obligatorio sin valor no se guarda», nivel unitario); `"190"` da el número 190 y `"caliente"` falla («Un número se guarda como número y se muestra con su unidad», «Un valor no numérico se rechaza», nivel unitario); una opción desconocida falla («Una opción que no está en la lista se rechaza», nivel unitario); una opción retirada pasa si es la guardada y falla si no («Una opción retirada se conserva si no se toca», «Una opción retirada no se asigna de nuevo», nivel unitario); opcional vacío es ausencia.
  - `mergeAttributes` conserva las claves de atributos archivados, de otra categoría y desconocidas, y quita las vaciadas («Un atributo retirado conserva y muestra su valor», «Los valores de la categoría anterior se conservan», nivel unitario).
  - `describeAttributes` rotula con el nombre vigente aunque haya cambiado («Renombrar un atributo no pierde valores», nivel unitario), añade la unidad, y separa los retirados, incluidas las claves desconocidas.
- [x] 3.4 `lib/catalog/attribute-definition-schema.ts` (o en `schema.ts`): esquemas Zod de alta y de edición de un atributo. Nombre recortado de 1 a 60, opciones recortadas, no vacías y distintas sin mayúsculas, unidad solo para número. El de edición no tiene `type` ni `scope`. Pruebas: una lista sin opciones o con opciones repetidas falla («A list attribute needs its options», nivel unitario); la edición descarta `type` y `scope` («Type and scope cannot change», nivel unitario).

## 4. Servicios y acciones

- [x] 4.1 `services/configuration/item-category-attribute-service.ts` sobre `ConfigTableService` (design D5): `listForCategory(org, categoryId, { includeArchived })`, `listActiveForCategories(org, categoryIds)`, `create` con `position` calculada y `update` sin `type`, `scope` ni `category_id`. `COLUMNS` como un solo literal. Pruebas con `FakeClient`: filtros por organización y categoría; `create` calcula la posición siguiente contando archivados; la carga de `update` no lleva los inmutables.
- [x] 4.2 `services/catalog/item-service.ts` e `item-variant-service.ts`: `attributes` en `COLUMNS` y en las escrituras; filtro `attributes: Record<id, value>` en `list()` con `.contains`. Ampliar `services/catalog/catalog-service.test.ts`: el filtro añade `.contains("attributes", { id: value })` («Filtrar por un atributo de lista», nivel de servicio); `create` y `update` escriben `attributes`.
- [x] 4.3 `services/inventory/variant-balance-service.ts` con `forItem(org, itemId)`, más sus pruebas: convierte `numeric` sin perder precisión y ordena las variantes por nombre con «Sin variante» al final.
- [x] 4.4 `actions/configuration.ts` (design D5): `createItemCategoryAttribute` y `updateItemCategoryAttribute` con `getOwnerContext`, los esquemas de 3.4, el mensaje de duplicado de siempre, y la entidad `itemCategoryAttribute` en archivar y desarchivar.
- [x] 4.5 `actions/configuration.test.ts` (ampliar): crear llama al servicio con los datos normalizados («Owner declares the attributes of a category», nivel de acción); sin contexto de dueña no se llama al servicio («The assistant cannot define attributes», nivel de acción); el duplicado devuelve el mensaje («Duplicate attribute name in the same category is rejected», nivel de acción); editar no pasa `type` ni `scope`; archivar y desarchivar con la entidad nueva.
- [x] 4.6 `actions/catalog.ts` (design D4): `createItem`, `updateItem`, `createItemVariant` y `updateItemVariant` reciben `attributes`, resuelven la categoría efectiva, cargan sus atributos vigentes del alcance, validan con `attributesSchema` y escriben con `mergeAttributes`.
- [x] 4.7 `actions/catalog.test.ts` (ampliar):
  - Una variante de filamento sin «Color» devuelve error y no escribe («El servidor también rechaza el obligatorio vacío»).
  - «caliente» en un número y «Verde» en una lista devuelven error y no escriben («Un valor no numérico se rechaza», «Una opción que no está en la lista se rechaza», nivel de acción).
  - Azul retirada se conserva sin tocarla y se rechaza como valor nuevo («Una opción retirada se conserva si no se toca», «Una opción retirada no se asigna de nuevo», nivel de acción).
  - Editar el nombre de un filamento con un atributo archivado guarda y conserva su valor («Un atributo retirado conserva y muestra su valor», nivel de acción).
  - Cambiar de categoría conserva los valores anteriores («Los valores de la categoría anterior se conservan», nivel de acción).
  - Un ítem sin categoría ignora la carga de atributos y conserva lo guardado.
  - Como ayudante, crear un filamento con marca y una variante con color guarda los valores («El ayudante llena los atributos», nivel de acción).
- [x] 4.8 `actions/inventory.ts` (design D7): consumo y conteo leen las variantes del ítem; exigen `variantId` si hay vigentes; rechazan una variante ajena o archivada; el conteo acepta `variantId: null` en un ítem con variantes solo con `countsUnassigned: true`. Ampliar `lib/inventory/schema.ts` con ese campo.
- [x] 4.9 `actions/inventory.test.ts` (ampliar): consumo sin variante de un ítem con variantes, rechazado sin escribir («El servidor rechaza el consumo sin variante»); variante de otro ítem o archivada, rechazada («El servidor rechaza una variante ajena»); conteo sin variante, rechazado («El servidor rechaza el conteo sin variante»); conteo de la fila «Sin variante» aceptado con la marca («Poner en cero lo que no tiene variante», nivel de acción); un ítem sin variantes sigue igual que antes.
- [x] 4.10 `actions/expenses.ts`: una línea de compra cuya variante no es de su ítem devuelve un mensaje comprensible antes de llegar a la base (design D6). Prueba en `actions/expenses.test.ts`.

## 5. Configuración: atributos de una categoría

- [x] 5.1 `features/settings/config-list.tsx`: `ConfigTables` acepta `extraActions`, que van entre «Editar» y el separador de «Archivar». `ConfigEntity` y `ENTITY_COPY` suman `itemCategoryAttribute`, con el efecto de archivar que dice que los valores se conservan. Las demás secciones no cambian (sus pruebas siguen en verde).
- [x] 5.2 `features/settings/item-categories-section.tsx`: acción «Atributos» que navega a `/settings/item-categories/<id>`.
- [x] 5.3 `features/settings/attribute-dialog.tsx`: Nombre, Tipo, Unidad (solo Número), Opciones una por línea (solo Lista), Obligatorio y Aplica a. En edición, sin Tipo ni Aplica a. Un rechazo deja el diálogo abierto con lo escrito.
- [x] 5.4 `features/settings/category-attributes-section.tsx`: encabezado con el nombre de la categoría y la vuelta a `/settings/item-categories?kind=<tipo>`, botón «Nuevo atributo», `ConfigTables` con columnas nombre, tipo («Número (°C)», «Lista (4 opciones)»), obligatorio y alcance, y el vacío «Aún no hay atributos en esta categoría».
- [x] 5.5 `app/(app)/settings/item-categories/[categoryId]/page.tsx` con `loading.tsx` y `error.tsx`: `getOwnerContext()` y redirección, 404 si la categoría no es de la organización, carga de la categoría y de sus atributos con archivados. `settings-nav.tsx` marca «Categorías de ítem» también en esta ruta.
- [x] 5.6 `features/settings/item-categories-section.test.tsx` (ampliar): el menú de «Filamento» ofrece «Editar», «Atributos» y, al final, «Archivar» («A category row offers its attributes»).
- [x] 5.7 `features/settings/category-attributes-section.test.tsx` y `attribute-dialog.test.tsx`, con las acciones simuladas (*hecho en un solo archivo, con un bloque `AttributeDialog`: el diálogo solo se abre desde la sección*):
  - Las filas muestran «Temperatura mínima · Número (°C) · Ítem» y «Color · Lista (4 opciones) · Obligatorio · Variante», con «⋯» y sin botones sueltos («The attributes table shows each definition»).
  - Crear «Color» como lista de cuatro opciones, obligatoria, de variante, llama a la acción y cierra («Owner creates a list attribute», «Owner declares the attributes of a category», nivel de interfaz).
  - Unidad aparece con Número y Opciones con Lista («Unit appears only for numbers»).
  - «Editar» no ofrece Tipo ni Aplica a («Editing does not offer type or scope»).
  - «Archivar» pide confirmación con el texto de conservación y llama a la acción («Archiving warns that values are kept»); «Restaurar» llama a desarchivar.
  - Sin atributos se ve el vacío y ninguna tabla («A category without attributes shows its empty state»).
  - La vuelta lleva a la pestaña del tipo de la categoría («Back to the categories»).
  - Un duplicado deja el diálogo abierto con lo escrito («Duplicate attribute name in the same category is rejected», nivel de interfaz).
- [x] 5.8 `features/settings/settings-nav.test.tsx`: la página nueva llama a `getOwnerContext()`, y la entrada queda marcada en la ruta nueva.

## 6. Catálogo: formularios, detalle y filtro

- [x] 6.1 `features/catalog/attribute-fields.tsx`: dibuja los campos de `attributeFieldsFor` según su tipo (texto, número con su unidad, selector con opción vacía y opción retirada rotulada), con nombres `attr:<id>`, y los lee del `FormData`.
- [x] 6.2 `features/catalog/item-form-dialog.tsx`: recibe las definiciones de las categorías del tipo, dibuja los campos de alcance ítem de la categoría elegida, que cambian al cambiar el selector, y valida con `attributesSchema` antes de enviar.
- [x] 6.3 `features/catalog/variant-form-dialog.tsx`: recibe los campos de alcance variante de la categoría del ítem y los valida y envía igual.
- [x] 6.4 Ampliar `item-form-dialog.test.tsx` y crear `variant-form-dialog.test.tsx`:
  - Un filamento ofrece sus cuatro campos de ítem en orden, con «°C» y «mm/s», y no «Color» («El formulario de ítem ofrece los atributos de ítem»).
  - La variante ofrece nombre y «Color» y nada más («El formulario de variante ofrece los atributos de su categoría»).
  - Sin categoría, o con «Sustratos», el formulario es igual que antes («Un ítem sin atributos declarados se ve como hoy», «La definición de una categoría no se aplica a otra»).
  - Cambiar de «Sustratos» a «Filamento» muestra los campos («Cambiar la categoría cambia los campos»).
  - Sin «Color», no llama a la acción y marca el campo («Un atributo obligatorio sin valor no se guarda»).
  - Azul retirada aparece como valor actual rotulado y se envía igual («Una opción retirada se conserva si no se toca», nivel de formulario).
- [x] 6.5 `features/catalog/item-detail.tsx`: los datos generales muestran los atributos rotulados con unidad, y un bloque aparte los datos que ya no se piden.
- [x] 6.6 `features/catalog/variants-list.tsx`: una columna por atributo vigente de alcance variante.
- [x] 6.7 Ampliar `item-detail.test.tsx`:
  - «Marca: Sunlu» y «Temperatura mínima: 190 °C» como datos rotulados, con la descripción intacta («Datos técnicos en los datos generales», «Un número se guarda como número y se muestra con su unidad», nivel de detalle).
  - Un atributo archivado y uno de otra categoría aparecen en el bloque de retirados («Un atributo retirado conserva y muestra su valor», «Los valores de la categoría anterior se conservan», nivel de detalle).
  - Con «Marca» renombrada a «Fabricante» se ve «Fabricante: Sunlu» («Renombrar un atributo no pierde valores», nivel de detalle).
  - La lista de variantes tiene la columna «Color» con cada valor («La lista de variantes muestra sus atributos»).
- [x] 6.8 `app/(app)/catalog/page.tsx` y `[id]/page.tsx`: cargan las definiciones de las categorías del tipo con `listActiveForCategories`, y el detalle también las archivadas para rotular. La lista lee los `attr_<id>` válidos de la categoría elegida y los pasa a `ItemService.list()` y a `joinsCatalogWindow`.
- [x] 6.9 `lib/catalog/window.ts`: `CatalogScope` suma `attributeFilters`. Ampliar `window.test.ts`: un ítem recién creado con otra marca no entra en la ventana filtrada.
- [x] 6.10 `features/catalog/catalog-screen.tsx` (design D8): con categoría elegida, un `Select` por atributo de lista de ítem; los `attr_` cuentan como filtros activos; cambiar de categoría o de pestaña los quita.
- [x] 6.11 Ampliar `catalog-screen.test.tsx`:
  - Elegir «Marca» Sunlu navega con `attr_<id>=Sunlu` («Filtrar por un atributo de lista», nivel de pantalla).
  - Con «Todas las categorías» no hay filtros de atributo («Sin categoría elegida no hay filtros de atributo»).
  - En «Filamento» hay filtro «Marca» y no «Color» («Los atributos de variante no filtran»).
  - Cambiar a «Sustratos» navega sin `attr_` («Cambiar de categoría descarta el filtro de atributo»).
  - «Quitar filtros» limpia categoría, atributos, búsqueda y línea («Quitar filtros incluye los atributos»).

## 7. Inventario por variante

- [x] 7.1 `features/inventory/consumption-dialog.tsx` (design D7): acepta `variant` puesta; si no, muestra un `ToggleGroup` con las variantes vigentes del ítem elegido y exige elegir una. Sin variantes, se ve como antes.
- [x] 7.2 `features/inventory/count-dialog.tsx`: acepta `variant` o la marca de fila «Sin variante», muestra el saldo de esa fila y envía la diferencia con la variante o con `countsUnassigned`.
- [x] 7.3 `features/inventory/balance-section.tsx`: con variantes, tabla por variante con su saldo y la unidad, y «Registrar consumo» y «Ajustar» por fila; la fila «Sin variante» cuando existe; sin ajuste del ítem completo. `movements-section.tsx` muestra la variante.
- [x] 7.4 Registro rápido (`features/quick-capture/quick-grid.tsx`, `register-button.tsx`) y su carga de insumos: cada insumo trae sus variantes vigentes.
- [x] 7.5 `app/(app)/catalog/[id]/page.tsx`: carga `VariantBalanceService.forItem` para insumos con variantes o con fila «Sin variante».
- [x] 7.6 Ampliar `consumption-dialog.test.tsx`, `count-dialog.test.tsx` y crear `balance-section.test.tsx`:
  - Con la variante puesta, escribir 0,3 y confirmar envía esa variante («Consumo desde la fila de una variante», nivel unitario).
  - Sin variante elegida en un ítem con variantes, no se envía y pide elegirla («Consumo de un ítem con variantes exige elegir cuál»).
  - Un insumo sin variantes se ve como antes («Consumo desde el detalle del insumo»).
  - El conteo de Negro en 1,2 con saldo 1,5 envía −0,3 con esa variante («Conteo de una variante», nivel unitario); el de «Sin variante» en 0 con saldo −0,4 envía +0,4 con la marca («Poner en cero lo que no tiene variante», nivel unitario).
  - La sección muestra el total, una fila por variante con sus acciones y no ofrece el ajuste completo («Disponibilidad por variante en el detalle», «Un insumo con variantes no se cuenta entero»).
  - Los movimientos muestran la variante («El historial explica un número que no cuadra»).

## 8. Bitácora y exportación

- [x] 8.1 `lib/activity/fields.ts` (design D9): `items.attributes` oculto con su línea en `HIDDEN_REASON`; `item_category_attributes` con sus campos. `describe.ts`, `services/activity/label-service.ts`, `unarchive.ts` y `app/(app)/activity/page.tsx` suman la tabla, con sus pruebas unitarias ampliadas donde ya las haya.
- [x] 8.2 `lib/export/tables.ts`: tabla `item_category_attributes` (archivo `atributos-categoria`, `ownerOnly: false`, columnas en el orden del catálogo) y `attributes` **al final** de las columnas de `items`.
- [x] 8.3 Correr `npm run test:integration`: `export-manifest.test.ts` y `activity-fields-coverage.test.ts` en verde.
  - *Hecho:* las dos guardas en verde. La suite completa dio 124 de 125: falla por tiempo `reports.test.ts` › «no depende del periodo». No es de este cambio: `report_low_stock` no se tocó, y con plan genérico recorre los ~43.000 ítems de la base compartida bajo RLS (1,1 s por llamada medido en psql). Quedó propuesta como tarea aparte.

## 9. Integración y e2e

- [x] 9.1 `tests/integration/variant-balances.test.ts` (nuevo, con una organización propia): comprar Negro y Rojo, consumir de Negro, y comprobar que `item_variant_balances` da cada saldo igual a la suma de sus movimientos y que el ítem suma los dos («Cada saldo coincide con la suma de sus movimientos», nivel de integración).
  - *Hecho, con un hallazgo:* la primera corrida agotó el tiempo. La vista unía los movimientos solo por `variant_id`, sin índice, y bajo RLS tardaba 2 s por lectura en la base compartida. Migración nueva `20260921110000_item_variant_balances_index.sql` (índice parcial por variante y unión por ítem y variante, mismas columnas y filas), con su aserción en `catalog_custom_attributes.test.sql`: ahora 1 ms. Diseño D6 y esquema §10/§11 actualizados.
- [x] 9.2 `tests/e2e/catalog-attributes.spec.ts` (nuevo, sobre `geeko()`), la dueña:
  - Abre «Atributos» de una categoría de insumo nueva «Resina», crea «Marca» (lista) y «Color» (lista, variante, obligatorio), y los ve en la tabla («Owner declares the attributes of a category», e2e).
  - Crea dos resinas con marca distinta sin volver a Configuración («Declared once, used by every item», e2e) y a una le añade las variantes «Gris» y «Blanco».
  - Intenta guardar una variante sin color y no puede («Un atributo obligatorio sin valor no se guarda», e2e).
  - Filtra el catálogo por la marca y ve solo esa resina («Filtrar por un atributo de lista», e2e).
  - Archiva «Marca»: el detalle sigue mostrando el valor como dato que ya no se pide y el formulario no ofrece el campo («Archiving an attribute keeps its stored values», e2e); la restaura y vuelve con su valor («Restoring an attribute offers it again», e2e).
- [x] 9.3 Mismo archivo, inventario sobre «PLA Sunlu» de la semilla:
  - Compra 2 kg de Negro y 1 kg de Rojo, y el detalle muestra los datos técnicos y 2 y 1 por variante («Disponibilidad por variante en el detalle», e2e).
  - Registra 0,3 desde la fila Negro en tres interacciones o menos, y solo Negro baja («Consumo desde la fila de una variante», e2e).
  - Registra un consumo de Rojo desde el registro rápido en cuatro interacciones («Registro rápido de un ítem con variantes», e2e).
  - Cuenta Negro y el ajuste solo cambia Negro («Conteo de una variante», e2e).
- [x] 9.4 Mismo archivo, el ayudante: llena marca y color de un filamento nuevo («El ayudante llena los atributos», e2e), no ve «Atributos» en el menú y la dirección directa lo redirige («The assistant cannot reach the attributes»).
- [x] 9.5 `tests/e2e/assistant-permissions.spec.ts`: sumar la ruta de atributos de una categoría de la semilla a `OWNER_ONLY`.
- [x] 9.6 `tests/e2e/inventory.spec.ts`: revisar que los consumos y conteos existentes, sobre insumos sin variantes, sigan igual («Consumo desde la retícula de registro rápido»).
- [x] 9.7 Correr `npm run lint`, `npm run typecheck`, `npm run test:unit`, `supabase test db`, `npm run test:integration`, los archivos e2e tocados y, al final, la suite e2e completa. Repetir los fallos con `--last-failed --workers=2` antes de darlos por regresión (base compartida).
  - *Hecho (2026-09-21), con fallos ajenos documentados:*
    - Lint y tipos limpios. Unitarias: 310 archivos, 3.073 pruebas. pgTAP: 77 archivos, 1.183 aserciones. Integración: 126 de 127; la que falla es `reports.test.ts` › «no depende del periodo», por `report_low_stock` (sin cambios aquí).
    - `catalog-attributes.spec.ts`, `item-categories.spec.ts` y `assistant-permissions.spec.ts` pasaron en escritorio y celular en corridas acotadas.
    - Suite e2e completa: 336 pasaron y 64 fallaron. Repetidas con `--workers=2`: 26 siguen. Repetidas con un trabajador: 8 siguen, repartidas entre inventario, captura sin conexión, cuenta, archivado, herramientas y dos de `catalog-attributes` en celular.
    - Causa medida con `pg_stat_statements`: la base compartida tiene 5.602 organizaciones y 1,1 GB. `item_last_cost` promedia 2,7 s por lectura por PostgREST (1.119 llamadas) y retrasa el detalle de insumo y el formulario de compra; las acciones superan el plazo de 2,5 s de la captura y los movimientos quedan en cola. Ni la vista ni `report_low_stock` cambiaron en este trabajo. Quedaron propuestas dos tareas aparte para esas dos consultas.

## 10. Documentación

- [x] 10.1 `docs/manual-de-uso.md`: atributos de categoría en Configuración; los campos de atributo en los formularios de ítem y variante; el filtro por atributo; la disponibilidad por variante y el consumo y el conteo por variante.
- [x] 10.2 `docs/manual-de-pruebas.md`: casos para definir atributos (lista sin opciones, duplicado, tipo inmutable), valores obligatorios, número y opción retirada, filtro, y saldo, consumo y conteo por variante, incluida la fila «Sin variante».
- [x] 10.3 `graphify update .` al terminar.

## 11. Tipo de atributo `color` (añadido el 2026-09-22)

- [x] 11.1 Migración `supabase/migrations/20260922100000_attribute_type_color.sql`: reemplazar `item_category_attributes_type_check` por uno que admita `color`. Aserciones en `catalog_custom_attributes.test.sql`: un atributo `color` sin unidad ni opciones se acepta («A color attribute», nivel de base); con opciones o con unidad se rechaza. Aplicarla en la base compartida con `psql -1 -f`.
- [x] 11.2 `types/index.ts` (`ATTRIBUTE_TYPES` suma `color`), `lib/catalog/labels.ts` (rótulo «Color») y `lib/activity/fields.ts` (`ENUM_LABELS` de `type`). Actualizar el delta del esquema en `specs/PRD/kamay-esquema-base-de-datos-supabase.md`.
- [x] 11.3 `lib/catalog/attributes.ts` (design D11): `parseHexColor`, validación y normalización a `#RRGGBB` en `attributesSchema`, `swatch` en `describeAttributes`. Pruebas en `attributes.test.ts`: `c62828` y `#abc` se normalizan («Un color se elige con el selector o se escribe en hex», nivel unitario); `rojizo` y `#12345` se rechazan («Un hex mal escrito se rechaza», nivel unitario); la descripción lleva la muestra («El color se ve como muestra», nivel unitario).
- [x] 11.4 `features/catalog/attribute-fields.tsx`: campo de color con selector nativo y campo de hex sincronizados. `features/catalog/color-swatch.tsx` y su uso en `item-detail.tsx` y `variants-list.tsx`. Pruebas: en `variant-form-dialog.test.tsx`, escribir `c62828` envía `#C62828` y mueve el selector, y elegir con el selector llena el campo; en `item-detail.test.tsx`, la columna de color muestra la muestra con su hex («El color se ve como muestra»).
- [x] 11.5 Configuración: el diálogo ofrece el tipo Color sin Unidad ni Opciones, y la tabla lo rotula «Color». Pruebas en `category-attributes-section.test.tsx` («A color attribute asks for neither unit nor options») y en `attribute-definition-schema.test.ts` (un color descarta unidad y opciones).
- [x] 11.6 Acción del servidor: `actions/catalog.test.ts` rechaza `rojizo` en un atributo de color y guarda `#C62828` al recibir `c62828` («Un hex mal escrito se rechaza», nivel de acción).
- [x] 11.7 `tests/e2e/catalog-attributes.spec.ts`: la dueña crea «Color de rollo» de tipo color en su categoría de prueba, lo llena escribiendo el hex en una variante y ve la muestra en la lista.
- [x] 11.8 Manuales: `docs/manual-de-uso.md` (tipo Color en 12.2, 12.3 y 18.3) y `docs/manual-de-pruebas.md` (casos del selector, del hex y de la muestra). Correr lint, tipos, unitarias, pgTAP de los archivos tocados, la e2e nueva y `graphify update .`.
