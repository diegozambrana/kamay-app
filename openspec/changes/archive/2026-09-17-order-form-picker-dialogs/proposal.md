## Why

En el formulario de pedido (V5, `/orders/new` y `/orders/[id]/edit`) elegir productos y cliente se hace con buscadores en línea que despliegan listas debajo del campo: solo aparecen al teclear, agregan un producto por vez y el alta de cliente al vuelo vive incrustada en esa lista, con nombre de solo lectura y únicamente el teléfono. Con catálogos de decenas de productos y pedidos de varias líneas el alta se vuelve lenta, y en móvil las listas desplegadas empujan el resto del formulario. Llevar ambas elecciones a diálogos —con la lista completa visible, filtro y selección explícita— hace el alta más rápida y deja piezas reutilizables para el formulario de compra y futuras pantallas.

## What Changes

- **Agregar del catálogo en un diálogo.** El buscador en línea de productos se reemplaza por un botón «Agregar del catálogo» que abre un diálogo con la lista completa de productos elegibles (los de la línea del pedido y los compartidos), un campo de filtro tolerante a acentos y mayúsculas y **selección múltiple**. Pie con «Cancelar» y «Agregar»: «Agregar» está deshabilitado sin selección; «Cancelar» descarta la selección y cierra. Cada producto con variantes vigentes aparece como una fila por variante, de modo que la selección múltiple sigue exigiendo decir cuál.
- **Acciones de líneas al final.** Los botones «Agregar del catálogo» y «Línea libre» se ubican juntos al pie de la lista de líneas (debajo de las líneas, antes del total).
- **Precio prellenado desde el precio referencial.** Cada línea agregada desde el diálogo nace con cantidad 1 y el «precio de venta referencial» de la variante o del producto cuando existe (0 si no hay); sigue siendo editable. Se mantiene la regla vigente, ahora aplicada a varias líneas a la vez.
- **Cliente en un diálogo.** El campo de cliente deja de ser un buscador en línea:
  - Sin cliente elegido muestra un botón «Seleccionar cliente».
  - Con cliente elegido muestra su nombre y, al lado, botones de icono para **cambiar** (reabre el diálogo) y **quitar** la selección.
  - El diálogo lista los clientes vigentes con un filtro; se elige uno y se confirma con «Seleccionar cliente» (deshabilitado sin selección) o se cierra con «Cancelar».
  - **Registrar cliente** desde el mismo diálogo: siempre hay una opción «Registrar nuevo cliente», y cuando el filtro no coincide con ningún cliente se ofrece «Registrar «<texto>»». Ambas pasan el diálogo a modo creación: un formulario con nombre (prellenado con lo buscado), teléfono, correo y dirección, y un pie con «Cancelar» (vuelve a la lista) y «Crear y seleccionar».
- **Componentes reutilizables.** Se instalan los componentes shadcn que faltan (`command` con sus dependencias de registro, `button-group`, `spinner`) y se crean en `components/shared/` piezas genéricas: una lista filtrable de selección (simple o múltiple), el diálogo que la envuelve con «Cancelar»/confirmar, y un campo «seleccionar entidad» con acciones cambiar/quitar. Los campos de contacto se extraen para compartirse entre el diálogo del directorio y el alta rápida.
- **Fuera de alcance:** el formulario de compra (`purchase-form`) y el directorio de contactos siguen con `ContactCombobox`, que no se modifica ni se elimina; la edición de roles del contacto desde el pedido (se crea siempre como cliente); la creación de productos desde el pedido; búsqueda en el servidor (el filtrado sigue en memoria sobre lo ya cargado); cambios de esquema, servicios o reglas del servidor.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `orders`: cambian los requisitos «Líneas desde el catálogo con precio prellenado y editable» (selección múltiple en diálogo, variantes como filas, ubicación de las acciones) y «Cliente creado al vuelo desde el pedido» (selección y alta de cliente en un diálogo con estados vacío/seleccionado, filtro, registro con nombre prellenado y «Crear y seleccionar»).

## Impact

- **UI**: `features/orders/order-form.tsx`, `features/orders/order-lines-editor.tsx`; `features/orders/catalog-picker.tsx` se reemplaza por un diálogo (`catalog-picker-dialog.tsx`); nuevo `features/contacts/customer-picker-dialog.tsx` y campos compartidos de contacto; `features/contacts/contact-form-dialog.tsx` reutiliza esos campos sin cambiar su comportamiento.
- **Componentes**: nuevos `components/ui/{command,button-group,spinner}.tsx` (shadcn; dependencia `cmdk`, más lo que el registro traiga consigo); nuevos `components/shared/selection-list.tsx`, `components/shared/selection-dialog.tsx` y `components/shared/entity-picker-field.tsx`.
- **Acciones**: `actions/contacts.ts` — el alta rápida acepta además correo y dirección opcionales (`quickContactSchema` en `lib/catalog/schema.ts`); sin cambios de base de datos, RLS ni servicios.
- **Lógica pura**: `lib/orders/lines.ts` gana la expansión de productos a filas elegibles (producto o variante) con su precio prellenado.
- **Pruebas**: unitarias de los componentes nuevos y del formulario; e2e que hoy teclean en «Cliente» y «Agregar del catálogo» (`order-entry`, `order-edit`, `task-from-order`, `orders-tasks-independence`, `mobile-capture`, `offline-capture`, `pagination`) pasan a usar los diálogos mediante un helper común.
- **Sin conexión**: el alta de cliente sigue requiriendo red, como hoy; seleccionar un cliente o productos ya cargados funciona sin red.
