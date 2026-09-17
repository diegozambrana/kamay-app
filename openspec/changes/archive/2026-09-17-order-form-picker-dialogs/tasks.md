## 1. Componentes shadcn

- [x] 1.1 Instalar con el CLI (sin `--overwrite`): `npx shadcn@latest add command button-group spinner`. Revisar el diff: si el registro intenta reescribir `components/ui/dialog.tsx`, `input-group` u otro existente, conservar la versión del proyecto y anotar aquí qué se agregó (design, riesgo de sobrescritura). `components/ui/dialog.test.tsx` sigue en verde.
  - *Hecho:* el registro quería sobrescribir `button`, `input`, `textarea`, `separator` y `dialog` (este último perdía `useReturnFocus` y «Cerrar»): se rechazó. Se agregaron `command`, `input-group`, `button-group` y `spinner`. El CLI 4.21 importa `cn` del paquete npm `cn`: se desinstaló y los cuatro archivos importan de `@/lib/utils`. `Spinner` usa «Cargando».
- [x] 1.2 Confirmar que `cmdk` quedó en `package.json` y que `npm run typecheck` y `npm run lint` pasan antes de seguir.

## 2. Piezas genéricas en `components/shared/`

- [x] 2.1 `components/shared/selection-list.tsx` · `SelectionList<T>` (design D1–D2): `Command` con `shouldFilter={false}`, filtro con `matchesSearch` sobre `getSearchText`, modos `single`/`multiple`, selección controlada por clave, `aria-checked` en la fila, `empty(term)` y `footerSlot`.
- [x] 2.2 `components/shared/selection-list.test.tsx`: filtra ignorando acentos y mayúsculas; en múltiple marca/desmarca y lo marcado sobrevive a un cambio de filtro; en simple marcar otra fila reemplaza la anterior; `empty(term)` se rinde sin coincidencias; flechas + Enter marcan.
- [x] 2.3 `components/shared/selection-dialog.tsx` · `SelectionDialog<T>` (design D2): diálogo controlado con estado dentro de `DialogContent`, `initialSelected`, pie «Cancelar» + confirmación con conteo, deshabilitada sin selección; alto máximo `calc(100dvh-2rem)` con la lista desplazable y el pie visible.
- [x] 2.4 `components/shared/selection-dialog.test.tsx`: confirmar deshabilitado sin selección; confirmar entrega las claves en el orden de la lista y cierra; «Cancelar» y `Esc` no llaman `onConfirm` y al reabrir no hay nada marcado; `initialSelected` llega marcado.
- [x] 2.5 `components/shared/entity-picker-field.tsx` · `EntityPickerField` (design D2): vacío → botón «Seleccionar …» con `id`; con valor → nombre + `ButtonGroup` con botones de icono «Cambiar …» y «Quitar …» (`aria-label` + `Tooltip`); `aria-invalid` para el error.
- [x] 2.6 `components/shared/entity-picker-field.test.tsx`: estados vacío y con valor; cada botón llama su callback; nombres accesibles.

## 3. Lógica pura y esquema

- [x] 3.1 `lib/orders/lines.ts`: `pickerOptions(items, businessLineId)` (design D3) — una opción por producto sin variantes y una por variante vigente, con `key`, `label`, `searchText` y `price` vía `prefilledPrice`. Quitar `pickerCandidates` si queda sin consumidores.
- [x] 3.2 `lib/orders/lines.test.ts`: excluye archivados y productos de otra línea, incluye compartidos («Productos fuera de alcance no se ofrecen»); un producto con variantes no tiene opción sin variante («Producto con variantes»); precio de la variante, luego del producto, luego 0 («Producto sin precio referencial»); `searchText` encuentra «sublimacion» («El filtro ignora acentos y mayúsculas», catálogo).
- [x] 3.3 `lib/catalog/schema.ts`: extraer las definiciones de `email` y `address` de `contactFormSchema` a constantes y sumarlas, opcionales, a `quickContactSchema` (design D6). Pruebas en `lib/catalog/schema.test.ts`: correo inválido rechazado, vacío → nulo, sin los campos sigue siendo válido (compatibilidad con `ContactCombobox`).
- [x] 3.4 `actions/contacts.ts` · `createContactInline`: persistir `email` y `address`. Prueba de la acción (o de integración existente) que afirma que se guardan.

## 4. Diálogo de catálogo y editor de líneas

- [x] 4.1 `features/orders/catalog-picker-dialog.tsx`: disparador «Agregar del catálogo» + `SelectionDialog` múltiple sobre `pickerOptions`, filas con nombre, variante y precio referencial; confirmación «Agregar (n)»; entrega las opciones marcadas.
- [x] 4.2 `features/orders/order-lines-editor.tsx` (design D4): `onAdd` recibe un arreglo; cada opción se convierte en línea con cantidad 1 y `price`; «Agregar del catálogo» y «Línea libre» juntos al final, antes del total. Eliminar `features/orders/catalog-picker.tsx`.
- [x] 4.3 `features/orders/order-lines-editor.test.tsx` (ajustar las existentes y agregar):
  - «Elegir un producto prellena el precio» (45 → cantidad 1, precio 45, editables).
  - «Selección múltiple» (tres productos → tres líneas con su precio).
  - «Agregar deshabilitado sin selección».
  - «Cancelar descarta la selección».
  - «El filtro conserva lo marcado».
  - «Producto con variantes» (opción por variante, precio desde la variante o el producto).
  - «Producto sin precio referencial» (precio 0).
  - «Producto ya presente en el pedido» (dos líneas).
  - «Acciones al final de las líneas» (los dos botones después de la última fila).
  - «Línea libre» y «El total en pantalla sigue a las líneas» siguen cubiertas.

## 5. Diálogo de cliente

- [x] 5.1 `features/contacts/contact-fields.tsx` (design D6): nombre, teléfono, correo y dirección con `name` y prefijo de `id`; `ContactFormDialog` pasa a usarlo sin cambiar su comportamiento (sus pruebas existentes siguen en verde).
- [x] 5.2 `features/contacts/customer-picker-dialog.tsx` (design D5, D7, D9): vistas `list`/`create`; lista de contactos vigentes con `isCustomer`; «Registrar nuevo cliente» siempre visible y «Registrar «term»» sin coincidencias; formulario con nombre prellenado, `preventDefault` + `stopPropagation`, «Cancelar» vuelve a la lista con el filtro, «Crear y seleccionar» con `Spinner`; errores del servidor y de red capturados sin cerrar.
- [x] 5.3 `features/contacts/customer-picker-dialog.test.tsx`:
  - «Seleccionar deshabilitado sin elección».
  - «El filtro ignora acentos y mayúsculas» (cliente).
  - «Solo se listan clientes vigentes» (sin archivados ni solo proveedores).
  - «Cambiar muestra el cliente actual marcado».
  - «Sin coincidencias se ofrece registrar lo buscado».
  - «Registrar lo buscado prellena el nombre».
  - «Registrar sin buscar primero» (nombre vacío).
  - «Nombre obligatorio al registrar» (no llama la acción).
  - «Cancelar el registro vuelve a la lista» (filtro intacto, sin llamada).
  - «El registro fallido conserva lo escrito» (acción con `{ error }` y acción que lanza).
  - «Creación con nombre y teléfono» (acción mockeada llamada con `isCustomer: true`, `isSupplier: false`, correo y dirección; `onSelect` con el contacto; diálogo cerrado).
  - Enviar el registro no dispara el `onSubmit` de un `<form>` que lo contiene (design D7).

## 6. Formulario de pedido

- [x] 6.1 `features/orders/order-form.tsx`: reemplazar `ContactCombobox` por `EntityPickerField` (`id="order-customer-trigger"`) + `CustomerPickerDialog`; seleccionar y quitar con `setValue("contactId", …, { shouldDirty: true, shouldValidate: true })`; enfocar `#order-customer-trigger` tras «Guardar y crear otro» y tras un guardado encolado (design D8); el error de cliente se sigue mostrando bajo el campo.
- [x] 6.2 `features/orders/order-form.test.tsx` (ajustar las que teclean en «Cliente» y agregar):
  - «Sin cliente se ofrece seleccionarlo».
  - «Elegir un cliente de la lista» (nombre + «Cambiar cliente» + «Quitar cliente»).
  - «Cancelar no cambia el cliente».
  - «Quitar el cliente» (vuelve el botón y guardar señala el campo).
  - «El formulario conserva lo escrito» (dos líneas y nota tras crear el cliente).
  - Tras «Guardar y crear otro» el foco queda en «Seleccionar cliente» y el campo vuelve a vacío («Guardar y crear otro conserva línea y canal» sigue en verde).
  - Cambiar la línea de negocio sigue quitando las líneas huérfanas agregadas desde el diálogo.

## 7. Pruebas e2e

- [x] 7.1 `tests/e2e/helpers/order-form.ts` (design D10): `elegirCliente(page, nombre)`, `registrarCliente(page, { nombre, telefono, correo, direccion, desdeFiltro })` y `agregarDelCatalogo(page, nombres)`.
- [x] 7.2 Migrar al helper los pasos de cliente y catálogo en `order-entry`, `order-edit`, `task-from-order`, `orders-tasks-independence`, `mobile-capture`, `offline-capture` y `pagination` (buscar `getByLabel("Cliente")` y `Agregar del catálogo` para no dejar ninguno).
  - *Hecho:* `pagination` no usa el formulario de pedido (su «Cliente» es la casilla del directorio) y quedó igual. En `order-entry` y `order-edit`, `/^Quitar/` pasó a «Quitar Maceta de barro»: ahora también existe «Quitar cliente».
  - *Criterio 7 del backlog (< 15 interacciones):* con los diálogos, el alta medida escribiendo en ambos filtros suma 16; eligiendo directamente de la lista visible (abrir, elegir, confirmar) suma 14. La prueba mide el segundo camino.
- [x] 7.3 `tests/e2e/order-entry.spec.ts`, escenarios nuevos contra la base real:
  - «Selección múltiple» + «Elegir un producto prellena el precio» (dos productos con precio referencial → líneas con esos precios; guardar y ver el detalle).
  - «Creación con nombre y teléfono» + «El contacto es un cliente» (registrar desde el filtro con correo y dirección, queda seleccionado, guardar; el directorio lo muestra como cliente con correo y dirección).
  - «El precio editado es el que se guarda» y «Línea libre» siguen cubiertas con el helper.
- [x] 7.4 `tests/e2e/accessibility.spec.ts`: axe sin violaciones con el diálogo de catálogo y con el de cliente abiertos (design, riesgo `aria-selected`).
- [x] 7.5 (quedó en «en el celular el formulario es pantalla completa» de `tests/e2e/order-entry.spec.ts`, que ya es la prueba del formato móvil) En ancho móvil, con el diálogo de catálogo abierto y lista larga, «Agregar» es visible sin desplazar la página.

## 8. Cierre

- [ ] 8.1 `npm run lint`, `npm run typecheck`, `npm run test:unit` y la suite e2e completa (~18 min) en verde.
  - *Estado (2026-09-17):* lint, typecheck y unitarias en verde (261 archivos, 2468 pruebas). Las e2e de las suites tocadas pasaron en ejecuciones dirigidas (`order-entry`, `order-edit`, `task-from-order`, `orders-tasks-independence`, `offline-capture`, `accessibility` en escritorio; `order-edit` en ambos proyectos). La suite completa no terminó limpia: el servidor de desarrollo compartido estaba saturado (10 GB, carga del equipo ~25) y fallaron por timeout de navegación también suites ajenas a este cambio. Falta repetirla con el servidor reiniciado.
- [ ] 8.2 Verificación manual en el navegador de `/orders/new` y `/orders/[id]/edit`: diálogos en escritorio y móvil, tema claro y oscuro, teclado (Tab, flechas, Enter, Esc) y foco devuelto al disparador.
  - *Estado:* capturas de `/orders/new` en escritorio y tema claro (catálogo con selección, cliente sin coincidencias, registro, formulario con cliente elegido). Tema oscuro y móvil solo están cubiertos por las e2e (axe en ambos temas y el pie visible en móvil). Faltan capturas de `/orders/[id]/edit`. Al verificar apareció que, tras elegir un cliente, el foco caía en `body`: se corrigió con `returnFocusId` (design D8) y quedó cubierto con una prueba.
- [x] 8.3 `graphify update .` para regenerar el grafo.
