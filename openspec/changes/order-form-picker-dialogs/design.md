## Context

Ver `proposal.md` (Why). Estado actual relevante:

- `features/orders/order-form.tsx` sirve alta y edición (design D6 de KAM-08) con react-hook-form + Zod; el cliente vive en `contactId` más un estado local `selected: Contact | null`, y tras «Guardar y crear otro» (y tras un guardado encolado) se enfoca `#contact-combobox-input`.
- `features/orders/order-lines-editor.tsx` monta `features/orders/catalog-picker.tsx` (único consumidor) arriba de las líneas; agrega una línea por evento con `onAdd(line, names)`.
- `features/contacts/contact-combobox.tsx` también lo usan `features/expenses/purchase-form.tsx` y `features/contacts/contacts-screen.tsx`: no se toca.
- `lib/orders/lines.ts` ya tiene `pickerCandidates` (alcance por línea + archivados + `matchesSearch`) y `prefilledPrice` (variante → producto → 0). El «precio de venta referencial» del catálogo es `salePrice`.
- `createContactInline` (`actions/contacts.ts`) valida con `quickContactSchema` (id, nombre, teléfono, roles) y crea con correo y dirección nulos.
- shadcn estilo `radix-nova`; ya hay `dialog`, `checkbox`, `input`, `field`, `tooltip`, `empty`, `alert`. Falta `command`. `components/shared/form-dialog.tsx` fija el patrón de diálogo controlado cuyo contenido se desmonta al cerrar.

## Goals / Non-Goals

**Goals:**
- Dos diálogos (catálogo y cliente) construidos sobre piezas genéricas en `components/shared/`, sin lógica de pedidos dentro de ellas.
- Mantener el filtrado en memoria con la misma normalización que la base (`matchesSearch`).
- Cero cambios en base de datos, servicios o cola sin conexión.

**Non-Goals:**
- Migrar `purchase-form` o el directorio a los nuevos componentes (queda para otro cambio; las piezas se diseñan para permitirlo).
- Virtualizar listas: los catálogos y directorios actuales caben en memoria (ya se cargan completos en la página).

## Decisions

### D1 · `cmdk` (shadcn `command`) como motor de las listas, con filtro propio

Las listas usan `Command` + `CommandInput` + `CommandList` + `CommandItem`, con `shouldFilter={false}` y el filtrado hecho por nosotros con `matchesSearch`. Así se gana navegación por teclado, roles `listbox/option` y enfoque del filtro sin reescribirlo, y la tolerancia a acentos sigue siendo la de la base (el filtro difuso de `cmdk` daría coincidencias distintas a las del catálogo).

- *Alternativa*: `Input` + `<ul>` de botones como hoy → sin navegación por flechas y con la accesibilidad a mano.
- *Alternativa*: `Combobox` de Base UI → el proyecto está sobre Radix; mezclar primitivas no compensa.

### D2 · Tres piezas genéricas en `components/shared/`

1. **`selection-list.tsx` · `SelectionList<T>`** — filtro + lista, controlado: `items`, `getKey`, `getSearchText`, `renderItem`, `mode: "single" | "multiple"`, `selected: string[]`, `onSelectedChange`, `term`/`onTermChange` (opcional, para que el padre lea el filtro), `empty(term)` y `footerSlot` (contenido fijo bajo la lista, p. ej. «Registrar nuevo cliente»). En modo múltiple cada fila muestra un `Checkbox` decorativo (`aria-hidden`) y la fila lleva `aria-checked`/`data-checked`; en simple, un ícono de check. Lo marcado se guarda por clave, por eso sobrevive a los cambios de filtro.
2. **`selection-dialog.tsx` · `SelectionDialog<T>`** — `Dialog` controlado que envuelve `SelectionList` con pie «Cancelar» + botón de confirmación (`confirmLabel`, que recibe el conteo) deshabilitado con `selected.length === 0`. El estado de selección vive **dentro** de `DialogContent`, que se desmonta al cerrar: cancelar, `Esc` o clic fuera descartan lo marcado sin código extra (mismo razonamiento que `FormDialog`). Acepta `initialSelected` para el caso «cambiar».
3. **`entity-picker-field.tsx` · `EntityPickerField`** — el disparador: sin valor, `Button` «Seleccionar …»; con valor, el nombre y un `ButtonGroup` de botones de icono (`PencilIcon`/`RefreshCw` para cambiar, `XIcon` para quitar) con `aria-label` y `Tooltip`. Recibe `id` para el enfoque programático y `aria-invalid` para el error del campo.

- *Alternativa*: un solo componente «picker» con todo → el diálogo de cliente necesita un segundo modo (registro) que no encaja en un diálogo de selección genérico; separar lista y diálogo permite que `CustomerPickerDialog` componga `Dialog` + `SelectionList` y cambie de vista.

### D3 · Productos con variantes como filas propias

`lib/orders/lines.ts` gana `pickerOptions(items, businessLineId): PickerOption[]`, que parte de los mismos filtros de alcance que `pickerCandidates` y devuelve una opción por producto sin variantes y una por variante vigente (`key = itemId:variantId`), con `label`, `searchText` (producto + variante) y `price = prefilledPrice(item, variant)`. `pickerCandidates` se conserva si sigue teniendo consumidores; si no, se reemplaza.

- *Alternativa*: paso intermedio de «elegir variante» dentro del diálogo → rompe la selección múltiple (habría que abrir un sub-flujo por producto).

### D4 · Agregado en lote

`OrderLinesEditor.onAdd` pasa a recibir un arreglo `{ line, names }[]`; el formulario hace un único `append(lines)` y un único `setNames`. Evita N renders y N validaciones. `CatalogPickerDialog` (`features/orders/catalog-picker-dialog.tsx`) convierte las claves marcadas en líneas en el orden de la lista. Los botones «Agregar del catálogo» y «Línea libre» pasan al final del editor, antes del total. `catalog-picker.tsx` y su uso se eliminan.

### D5 · Diálogo de cliente con dos vistas

`features/contacts/customer-picker-dialog.tsx` mantiene `view: "list" | "create"`, `term` y `selected`. En `list` compone `SelectionList` (modo simple, contactos vigentes con `isCustomer`), con `footerSlot` «Registrar nuevo cliente» y `empty(term)` que ofrece «Registrar «term»». En `create` rinde un formulario con `ContactQuickFields` y pie «Cancelar» (vuelve a `list` con el mismo `term`) y «Crear y seleccionar» (con `Spinner` mientras viaja). Al crear con éxito llama `onSelect(contact)` y cierra.

El nombre se prellena con `term.trim()` como `defaultValue`; es editable (a diferencia del paso actual, de solo lectura).

### D6 · Campos de contacto compartidos y alta rápida ampliada

`features/contacts/contact-fields.tsx` exporta los inputs nombre/teléfono/correo/dirección (con `name` para `FormData` y prefijo de `id` configurable). `ContactFormDialog` lo usa sin cambiar su comportamiento. `quickContactSchema` añade `email` y `address` reutilizando las mismas definiciones que `contactFormSchema` (se extraen a constantes compartidas), y `createContactInline` los persiste. `ContactCombobox` sigue enviando solo nombre y teléfono: los nuevos campos son opcionales.

### D7 · Formularios anidados a través del portal

El diálogo de cliente se monta dentro del `<form>` del pedido. Aunque `DialogContent` se renderiza en un portal (no hay `<form>` anidado en el DOM), los eventos sintéticos de React **sí** burbujean por el árbol de componentes: un `submit` del formulario de registro dispararía el `onSubmit` del pedido. El formulario interno hace `event.preventDefault()` **y** `event.stopPropagation()`; los botones que no envían llevan `type="button"`. Hay prueba unitaria que lo afirma (registrar un cliente no invoca el guardado del pedido).

### D8 · Enfoque y guardia de descarte

Tras «Guardar y crear otro» y tras un guardado encolado se enfoca el disparador `#order-customer-trigger` en lugar de `#contact-combobox-input`. Seleccionar/quitar cliente usa `setValue("contactId", …, { shouldDirty: true, shouldValidate: true })`; quitar escribe `""`, que el esquema ya rechaza con el mensaje del campo. Al cerrar un diálogo, el foco vuelve al disparador. En el de cliente no alcanza con `useReturnFocus`: elegir un cliente reemplaza «Seleccionar cliente» por «Cambiar cliente», el elemento que abrió el diálogo ya no existe y el foco caería en `body`. Por eso `CustomerPickerDialog` recibe `returnFocusId` y, al cerrar, enfoca el elemento que lleva ese `id` en ese momento. Quitar el cliente hace lo mismo con un efecto, porque ahí no hay diálogo de por medio.

### D9 · Sin conexión

Seleccionar cliente o productos no necesita red (todo está en memoria). «Crear y seleccionar» llama a la Server Action; si la llamada lanza (sin red) se captura y se muestra «Sin conexión: registra el cliente cuando vuelva la señal», dejando el diálogo en `create` con lo escrito. No se encola el alta de contactos (fuera de alcance, como hoy).

### D10 · Pruebas e2e con helper común

`tests/e2e/helpers/order-form.ts` expone `elegirCliente(page, nombre)`, `registrarCliente(page, datos)` y `agregarDelCatalogo(page, nombres[])`; las specs existentes que teclean en «Cliente» / «Agregar del catálogo» pasan a usarlo, de modo que un próximo cambio de UI toque un solo archivo.

## Risks / Trade-offs

- [`aria-selected` de `cmdk` significa «resaltado», no «marcado»] → la fila expone el estado con `aria-checked` y el conteo del botón «Agregar (n)»; prueba de accesibilidad con axe en `tests/e2e/accessibility.spec.ts` sobre el diálogo abierto.
- [Diálogo dentro de diálogo no aplica, pero sí dentro del `<form>` del pedido] → D7.
- [Duplicar nombres de cliente al registrar sin buscar] → aceptado: el directorio ya lo permite; la opción contextual solo aparece sin coincidencias.
- [Listas largas en móvil] → `DialogContent` con alto máximo `calc(100dvh-2rem)` y `CommandList` con scroll propio; el pie queda siempre visible.
- [`npx shadcn add command` puede sobrescribir `dialog.tsx` u otros existentes] → añadir sin `--overwrite` y revisar el diff; conservar las personalizaciones y `dialog.test.tsx` en verde.
- [Las e2e dependen de rótulos que cambian] → D10 concentra los selectores; ejecución completa (~18 min) antes de cerrar.

## Migration Plan

Solo UI y un esquema Zod ampliado de forma compatible. Despliegue normal; revertir el commit restablece los buscadores en línea. Sin datos que migrar.
