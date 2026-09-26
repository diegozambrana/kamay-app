## 1. Pruebas que fallan primero

- [x] 1.1 En `features/catalog/catalog-screen.test.tsx`, prueba «la foto del producto anterior no pasa al siguiente»: abrir «Nuevo producto», elegir un `File` en el dropzone («Arrastra la foto del ítem»), guardar con `createItem`/`uploadItemPhoto` simulados, reabrir y comprobar que no hay foto elegida; guardar el segundo y comprobar que `uploadItemPhoto` se llamó una sola vez en total — escenario «La foto del producto anterior no pasa al siguiente»
- [x] 1.2 Prueba «los datos del alta anterior no se conservan»: crear un insumo eligiendo línea, unidad y categoría con el filtro de línea en todas; reabrir y comprobar nombre vacío, línea «Compartido», unidad y categoría sin elegir — escenario «Los datos del alta anterior no se conservan»
- [x] 1.3 Prueba «cancelar descarta lo llenado»: escribir nombre, elegir foto y categoría, cerrar sin guardar, reabrir y comprobar formulario en blanco y sin foto — escenario «Cancelar descarta lo llenado»
- [x] 1.4 Prueba «el error anterior no reaparece»: `createItem` simulado que devuelve `{ error }`, cerrar, reabrir y comprobar que no hay alerta — escenario «El error anterior no reaparece»
- [x] 1.5 Prueba «el alta toma la pestaña vigente»: abrir alta de insumo, elegir categoría, cerrar, volver a renderizar con `kind` producto, abrir y comprobar formulario de producto con categoría sin elegir — escenario «El alta toma la pestaña vigente»
- [x] 1.6 Prueba «el alta toma la línea filtrada vigente»: alta con otra línea, volver a renderizar con `activeLineId` de una línea, abrir y comprobar esa línea elegida — escenario «El alta toma la línea filtrada vigente»
- [x] 1.7 Prueba «la edición sigue trayendo los datos del registro»: tras un alta con foto, «Editar» en la fila de otro producto muestra sus datos y ninguna foto nueva elegida — escenario «La edición sigue trayendo los datos del registro»
- [x] 1.8 Prueba de `VariantsList` (nuevo `features/catalog/variants-list.test.tsx` o en `variant-form-dialog.test.tsx` si encaja mejor): añadir una variante con nombre y atributos, reabrir el alta y comprobar nombre y atributos vacíos; y con un guardado que devuelve error, cerrar, reabrir y comprobar que no hay alerta — escenario «El alta de variante empieza en blanco»
- [x] 1.9 Correr `npm run test:unit -- features/catalog` y confirmar que 1.1–1.6 y 1.8 fallan por la razón esperada (1.7 puede pasar ya: es de no regresión)

## 2. Implementación

- [x] 2.1 En `features/catalog/catalog-screen.tsx`, añadir un contador de aperturas del alta y una función `openCreate()` que lo incrementa y abre; usarla en el botón de alta y en la acción del vacío inicial; pasar `key={createKey}` al `ItemFormDialog` de alta (según `design.md`: incrementar al abrir, no al cerrar)
- [x] 2.2 En `features/catalog/variants-list.tsx`, el mismo patrón para el `VariantFormDialog` de alta
- [x] 2.3 Comprobar que `item-form-dialog.tsx` y `variant-form-dialog.tsx` no necesitan cambios; si alguno inicializa estado desde props de otra forma que no reinicia con la clave, corregirlo
- [x] 2.4 Correr `npm run test:unit -- features/catalog` y confirmar que todo el grupo 1 pasa, junto con las pruebas existentes de catálogo

## 3. E2e

- [x] 3.1 En `tests/e2e/images.spec.ts` (o un spec de catálogo junto a él), prueba «crear dos productos seguidos no arrastra la foto»: con su propia organización, crear un producto con foto vía `setInputFiles` sobre «Arrastra la foto del ítem», pulsar «Nuevo producto» otra vez y comprobar que el dropzone no muestra vista previa; guardar el segundo y comprobar en su detalle que no tiene foto — escenario «La foto del producto anterior no pasa al siguiente», de punta a punta
- [x] 3.2 Correr ese spec en solitario con Playwright y confirmar que pasa

## 4. Cierre

- [x] 4.1 `npm run lint` y `npm run typecheck` limpios
- [x] 4.2 Verificar a mano en el navegador (dev en el puerto 3010): crear un producto con foto, abrir «Nuevo producto» y confirmar que el formulario está en blanco; cambiar de pestaña y de línea y confirmar que el alta las toma — cubierto por la corrida en navegador real del e2e de 3.1 (Chrome contra el dev en 3010), acordado con la persona usuaria
- [x] 4.3 `graphify update .` y revertir `.graphify_root`/`manifest.json` si se trabajó en un worktree
- [x] 4.4 `openspec validate catalog-create-form-reset --strict` sin errores
