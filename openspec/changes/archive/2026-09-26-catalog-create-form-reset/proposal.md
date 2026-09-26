# El formulario de alta del catálogo empieza vacío cada vez

> Origen: reporte de la persona usuaria del 2026-09-26: «después de crear un producto en el catálogo y agregar una imagen, se quiere crear otro producto pero sigue la imagen del anterior producto creado; debería limpiarse todo esto antes».

## Why

En el catálogo (V10), el diálogo de alta («Nuevo insumo», «Nuevo producto», «Nuevo activo») queda montado entre una apertura y la siguiente, así que conserva lo que la persona eligió la vez anterior: la foto, la línea, la unidad, la categoría y el último mensaje de error. Al crear el segundo producto la foto del primero sigue puesta y, si la persona no se da cuenta, se sube al ítem nuevo. Es un dato equivocado guardado sin querer, y la persona tiene que revisar campo por campo en cada alta.

## What Changes

- **Cada apertura del alta de ítem empieza en blanco.** Nombre, descripción, precio, mínimo y atributos vacíos; sin foto; línea en la línea activa del catálogo (o «Compartido»); unidad y categoría sin elegir; sin mensaje de error. Vale al abrir desde el botón de alta y desde la acción del vacío inicial.
- **Da igual cómo se cerró la vez anterior**: tras guardar con éxito, tras cancelar o cerrar el diálogo con datos a medio llenar, o tras un error.
- **El alta toma la pestaña y la línea vigentes al abrirse.** Hoy, si la persona abre el alta en insumos, la cierra y cambia a productos, la categoría elegida para el insumo puede seguir puesta en el alta de producto. Con el cambio, la categoría y la línea iniciales siempre corresponden a la pestaña y al filtro de línea del momento.
- **El alta de variante en el detalle (V11) sigue la misma regla**: cada apertura empieza en blanco, sin los valores ni el error de la variante anterior.
- **La edición no cambia**: el formulario de edición ya se abre con los datos del ítem o de la variante que se edita.

### Fuera de alcance

- Cuando el ítem se guarda pero la foto falla, el diálogo queda abierto con el error «El ítem se guardó, pero la foto no…». Reintentar desde ahí hoy crearía un segundo ítem en vez de reintentar la foto. Es un defecto real pero distinto (qué hace el reintento, no qué se limpia al abrir) y queda para un cambio propio.
- Otros diálogos de alta fuera del catálogo (contactos, pedidos, gastos…). Si comparten el patrón, se revisan aparte.
- Conservar un borrador del alta entre aperturas a propósito: no se pide y contradice lo reportado.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `catalog-directory`: requisito nuevo — los formularios de alta de ítem (V10) y de variante (V11) se abren siempre en blanco, con la línea y el tipo vigentes, sin foto, valores ni error de un alta anterior. Los requisitos de V10 y V11 no cambian su texto.

## Impact

- `features/catalog/catalog-screen.tsx`: cómo se monta el diálogo de alta de ítem.
- `features/catalog/variants-list.tsx`: cómo se monta el diálogo de alta de variante.
- `features/catalog/item-form-dialog.tsx` y `variant-form-dialog.tsx`: sin cambio de contrato previsto.
- Pruebas: unitarias en `features/catalog/catalog-screen.test.tsx` y `variants-list` (o `variant-form-dialog.test.tsx`); un escenario e2e en Playwright que crea dos productos seguidos, el primero con foto.
- Sin migraciones, sin cambios de servidor ni de acciones.
