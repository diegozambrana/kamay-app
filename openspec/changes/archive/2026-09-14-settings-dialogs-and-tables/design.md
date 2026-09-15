## Context

Motivación y alcance en `proposal.md`; comportamiento exigido en `specs/settings-interaction`, `specs/org-configuration` y `specs/configurable-statuses`. Aquí, solo lo que condiciona el cómo.

- **Seis secciones con entidades, cuatro formas de pintarlas.** `features/settings/config-list.tsx` pinta la lista de Líneas, Canales, Categorías y Unidades (`<ul>` con botones «Editar»/«Archivar» sueltos, archivar sin confirmar, y una segunda `<ul>` de archivados con «Restaurar»). Cada sección (`business-lines-section.tsx`, `named-section.tsx`, `units-section.tsx`) monta su formulario de alta encima y lo reutiliza para editar cambiando la `key`. `members-section.tsx` tiene formulario de invitación en línea, un `<select>` de rol y casillas de líneas **que guardan al cambiar**, y «Archivar»/«Revocar» sin confirmar. `statuses/status-row.tsx` despliega edición y archivado dentro de la fila (`mode: view | edit | archive`), y `statuses-section.tsx` confirma las acciones del juego con una frase y dos botones en línea (`Confirming = "none" | "restore" | "use-org"`).
- **Dos tablas en el proyecto.** `components/shared/data-table.tsx` (KAM-26: `/admin/users`, `/admin/organizations`, detalle de organización) pinta tabla en escritorio y tarjetas en el celular, con `RowActionsMenu` («⋯», nombre accesible por fila, destructivas al final y separadas). `components/data-table/data-table.tsx` (catálogo, pedidos) tiene confirmación incorporada, pero ni tarjetas ni nombre accesible por fila.
- **shadcn ya está completo para esto** (`components.json`, estilo `radix-nova`, paquete único `radix-ui`): `dialog` (con su prueba de foco `components/ui/dialog.test.tsx`), `alert-dialog`, `dropdown-menu`, `table`, `select`, `checkbox`, `field`, `badge`, `input`, `label`. Hoy los formularios de configuración usan `<select>` y `<input type="checkbox">` nativos.
- **Las acciones del servidor no cambian**, salvo el validador de identificadores de `actions/configuration.ts` (ver «Corrección al implementar» al final). `actions/configuration.ts`, `actions/members.ts` y `actions/statuses.ts` devuelven `{ error }` o nada (o `{ inviteUrl }` en `inviteMember`) y revalidan la ruta; las validaciones del juego de estados (`statusFormSchema`, `setIsComplete`) viven en `lib/statuses/schema.ts` y se reutilizan.
- **Qué hace cada acción del juego de estados** (para el texto de cada confirmación): `restore_default_statuses` reactualiza o crea los estados por defecto y **archiva los que no son del juego por defecto** —si alguno está en uso, la transacción entera se rechaza—; `createOwnSet` copia el juego de la organización a la línea; `use_organization_statuses` archiva el juego propio y la línea vuelve a resolver el de la organización.
- **E2E**: la tabla compartida deja en el documento la tabla **y** las tarjetas (una oculta con `display: none`). `tests/e2e/platform-admin.spec.ts:62` ya lo resuelve con `visibleRows()` (`getByTestId(id).filter({ visible: true })`). Las pruebas de configuración usan hoy `getByText`/`locator("li")` y `selectOption` sobre `<select>` nativos.

## Goals / Non-Goals

**Goals:**
- Un único par de diálogos reutilizables (formulario y confirmación) que resuelva estado abierto/cerrado, envío en curso, error del servidor dentro del diálogo y devolución del foco, para que cada sección solo declare sus campos y su texto.
- Cero cambios en `services/`, base de datos y `/admin/*`; en `actions/`, solo el validador de identificadores de configuración.
- Cada escenario de `specs/` cubierto por una prueba referenciada en `tasks.md`.

**Non-Goals:**
- Unificar las dos tablas del proyecto ni migrar catálogo y pedidos.
- Pasar los formularios a react-hook-form: siguen con `FormData` + Zod como hoy; cambiar eso no aporta nada al alcance.
- Tocar el selector de flujo y el de alcance de Estados (navegación, no formulario; `status-config.spec.ts` los usa por su `<option>`).

## Decisions

### D1 · La tabla es `components/shared/data-table`, sin cambiarla

Es la de las vistas de referencia (`/admin/users`, `/admin/organizations`), ya da el nombre accesible por fila que exige la spec («Acciones de Sublimación»), separa las destructivas, y en el celular pinta tarjetas sin trabajo extra. Se usa tal cual: `rows`, `columns`, `getRowKey`, `rowActions`, `rowActionsLabel`, `empty`, `testId`, `rowTestId`, `caption`.

**Alternativa descartada:** `components/data-table/data-table.tsx`, porque ya confirma. Su confirmación es síncrona (no muestra el error del servidor ni el envío en curso), su «⋯» se llama siempre «Acciones» y no tiene tarjetas; adaptarla sería rehacerla, y la usan catálogo y pedidos.

### D2 · La confirmación es un hook, no una propiedad de la tabla

`components/shared/confirm-dialog.tsx` exporta:

- `ConfirmDialog` — presentacional sobre `AlertDialog`: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `destructive`, `pending`, `error`, `onConfirm`, y `children` opcional para contenido extra (la reasignación al archivar un estado).
- `useConfirmDialog()` — devuelve `{ ask, dialog }`. `ask({ title, description, confirmLabel, destructive, action })` abre el diálogo; `action` es la Server Action ya ligada (`() => archiveConfigurationItem({ entity, id })`). Al confirmar corre dentro de `startTransition`: con `{ error }` el diálogo sigue abierto y lo muestra; sin error, se cierra. `dialog` es el elemento a pintar una vez por sección.

El botón de acción **no** es `AlertDialogAction` (que cierra al hacer clic, antes de saber si la acción falló): es un `Button` con `onClick` propio; «Cancelar» sí es `AlertDialogCancel`. Mientras corre, los dos se deshabilitan y Escape no cierra.

**Por qué un hook y no `RowAction.confirm`:** las confirmaciones salen tanto del menú de una fila como de botones sueltos («Restaurar valores por defecto», «Crear juego propio para esta línea»), y una necesita contenido propio (a dónde mover). Con el hook la tabla sigue siendo solo presentación y `/admin/*` no se entera.

### D3 · El formulario en diálogo: `FormDialog` + estado `editing` en cada sección

`components/shared/form-dialog.tsx` exporta `FormDialog`: `open`, `onOpenChange`, `title`, `description?`, `submitLabel`, `pending`, `error`, `onSubmit(formData)`, y los campos como `children`. Pinta `DialogHeader`, un `<form>` con `id` propio, el error con `role="alert"` dentro del diálogo, y `DialogFooter` con «Cancelar» (`DialogClose`) y el botón de envío (`form={id}`, deshabilitado con `pending`). No usa `DialogTrigger`: el diálogo es controlado porque el mismo sirve para crear (desde el botón de la sección) y para editar (desde el menú de la fila).

Cada sección guarda `editing: null | "new" | Entidad`. `open = editing !== null`; los campos usan `defaultValue` de la entidad (o vacío con `"new"`). Como `DialogContent` se desmonta al cerrar, reabrir siempre arranca limpio, lo que cubre *Cancelling creates nothing* sin reinicios manuales. El error vive en la sección y se borra al cerrar.

**Alternativa descartada:** un diálogo por fila con su propio `DialogTrigger` (como `AddUserDialog`). Multiplica diálogos montados y no encaja con abrir desde un `DropdownMenuItem`.

### D4 · Abrir un diálogo desde el menú «⋯» sin perder el foco

`Dialog` y `AlertDialog` de `components/ui/` devuelven el foco con `hooks/use-return-focus.ts` (KAM-23): recuerdan el elemento enfocado al abrirse y lo enfocan al cerrarse. Abierto desde un `DropdownMenuItem`, ese elemento es el ítem, que desaparece con el menú, y el foco caía en `body` (la prueba del escenario *Focus returns to the row menu* lo confirmó al fallar).

**Decisión:** `useReturnFocus` reconoce ese caso: si el elemento enfocado está dentro de un `[role="menu"]`, recuerda en su lugar el disparador del menú, que Radix enlaza con `aria-labelledby` en el contenido del menú. Arregla de paso cualquier otro diálogo de la aplicación abierto desde un menú.

**Alternativa descartada:** diferir la apertura del diálogo al siguiente fotograma. El menú sale con una animación (~100 ms) y durante ella el foco sigue en el ítem, así que un fotograma no alcanza en el navegador, y esperar al final de la animación ata cada sección a un tiempo.

### D5 · Una sola pieza para los cuatro catálogos: `ConfigTables`

`config-list.tsx` pasa a exportar `ConfigTables<T>`: recibe `entity`, las filas, sus columnas y `onEdit`. Pinta una `DataTable` de activos (`testId="${entity}-list"`, `rowTestId="${entity}-row"`) con «Editar» y —salvo filas `protected`, la línea compartida— «Archivar» (destructiva); y, si hay archivados, el título «Archivados» con una segunda `DataTable` (`${entity}-archived-list`) cuyo menú solo tiene «Restaurar». Archivar y Restaurar pasan por `useConfirmDialog` con el texto de cada entidad en un registro junto a `EMPTY_TITLES` (p. ej. línea: «Deja de ofrecerse en el selector y en los formularios nuevos; los registros que ya la usan la siguen mostrando.»). El vacío inicial cambia su descripción a «Usa «Crear línea»» (según la sección).

Cada sección conserva su archivo y define solo columnas y diálogo: `LineDialog` (Nombre + `Select` de color con su punto), `NamedItemDialog` para canales y categorías (la página le pasa el sustantivo y los rótulos: «Nuevo canal» / «Crear canal»), `UnitDialog` (Código + Nombre).

### D6 · Controles de shadcn dentro de los diálogos, leídos con `FormData`

Los `<select>` nativos pasan a `Select` de shadcn con `name` (Radix pinta un `<select>` oculto dentro del formulario, así `FormData` sigue funcionando y el envío no cambia). «Columna en cola» pasa a `Checkbox` con `name="isQueue"` (su input oculto envía `"on"`, que es lo que ya se lee). Etiquetas con `Field`/`FieldLabel` para que `getByLabel` siga resolviendo. Donde el estado se necesita en vivo —el rol del miembro, que decide si se ven las líneas— el control es controlado y no se lee de `FormData`.

No se prevé instalar componentes; si al implementar falta alguno se añade con `npx shadcn@latest add <componente>` y se anota en `tasks.md`.

### D7 · Usuarios y roles

- **Tres `DataTable`**: *Equipo* (`member-list` / `member-row`: nombre, rol como `Badge`, líneas como insignias con su color o «Todas»), *Invitaciones pendientes* (`invitation-list`: correo, rol, vence) y *Sin acceso* (sin `rowActions`).
- **`InviteDialog`**: al crear, el mismo diálogo cambia a la vista del enlace (`data-testid="invite-url"` con el `<code>`, «Copiar enlace» con `navigator.clipboard` y «Listo»). El enlace vive en el estado del diálogo y se descarta al cerrarlo: en la base solo queda su hash, como hoy.
- **`MemberDialog`** (Editar): `Select` de rol controlado y, si el rol es ayudante, la lista de líneas con `Checkbox` (`aria-label` «Alfarería para <nombre>», como hoy) y el texto «Sin ninguna marcada, ve las tareas de todas las líneas.». Al guardar llama, en orden y solo si cambió, a `changeMemberRole` y a `setMemberLines`; si queda como dueño no envía líneas.
- **Quitar acceso** (`archiveMembership`) y **Revocar** (`revokeInvitation`) por `useConfirmDialog`. El rechazo del último dueño llega como `{ error }` de la base y se muestra en el diálogo.

**Alternativa descartada:** una acción nueva `updateMember` que cambie rol y líneas en una transacción. Sería más limpia, pero toca `actions/` y `services/` para un caso que las dos acciones existentes ya cubren, y ambas son idempotentes: si la segunda falla, el diálogo queda abierto y reintentar es seguro.

### D8 · Estados: lista ordenable con menú, diálogos en la sección

`StatusRow` pierde su `mode`, su formulario y su archivado: pinta asa, punto de color, nombre, tipo, «Columna en cola» y un `RowActionsMenu` («Acciones de <estado>») con «Editar» y «Archivar», y avisa a la sección por `onEdit(status)` / `onArchive(status)`. El arrastre sigue igual (los `listeners` de dnd-kit solo están en el asa, así que el «⋯» no inicia arrastres).

`StatusesSection` monta:

- un `StatusDialog` (crear y editar: Nombre, Tipo, Color, Columna en cola) que valida con `statusFormSchema` y `setIsComplete` antes de enviar y muestra el error dentro;
- un `ArchiveStatusDialog` sobre el `ConfirmDialog` presentacional, con el `Select` «Mover los registros que lo usaban a» como `children` y el botón «Archivar estado»; si archivar dejaría el juego sin inicial o final, el diálogo lo dice y deshabilita el botón;
- `useConfirmDialog` para «Restaurar valores por defecto» (texto: los estados vuelven a los de fábrica y los que no son de fábrica se archivan; si alguno está en uso, no se restaura nada), «Crear el juego por defecto», «Crear juego propio para esta línea» (se copia el de la organización) y «Usar el juego de la organización» (el juego propio se archiva). Desaparece el tipo `Confirming`.

Los archivados de Estados siguen como lista simple, sin acciones, como hoy.

### D9 · Pruebas

- **Unitarias (Vitest + Testing Library)**: `confirm-dialog.test.tsx` y `form-dialog.test.tsx` (abrir, cancelar sin efecto, error dentro y diálogo abierto, botón deshabilitado en curso, foco devuelto); `config-list.test.tsx` (menú con/sin «Archivar» para filas protegidas, tabla de archivados solo con «Restaurar», ausencia sin archivados, confirmación antes de llamar a la acción); `members-section.test.tsx`, `statuses/status-row.test.tsx` y `statuses/statuses-section.test.tsx` con las acciones de `actions/*` simuladas.
- **E2E**: se reescriben los pasos que hoy pulsan botones o casillas en las filas; `visibleRows()` sube de `platform-admin.spec.ts` a `tests/e2e/helpers/` para compartirse; los `Select` de shadcn se operan con `getByRole("combobox")` + `getByRole("option")`. La auditoría de accesibilidad de `/settings/lines` suma una pasada con el diálogo de alta abierto.

### D10 · Menú lateral de secciones y bloque de 1280 px

Pedido después de la primera implementación (spec `settings-interaction` → *Settings sections are navigated from a side menu*). Hasta aquí `app/(app)/settings/layout.tsx` centraba un bloque de `max-w-4xl` con pestañas horizontales que, con diez secciones, se partían en dos filas en escritorio y en cuatro en el celular.

- **Un solo `<nav>` que cambia de forma**, no dos (uno por tamaño). Dos copias de los enlaces duplicarían el menú para las pruebas unitarias —jsdom no aplica CSS— y cualquier cambio habría que hacerlo dos veces. Desde `lg` (1024 px) es una columna fija (`sticky`, bajo el encabezado de 56 px) a la izquierda de una rejilla `lg:grid-cols-[13rem_1fr]`; por debajo, una sola fila con desplazamiento horizontal. `lg` y no `md`: a 768 px el menú lateral de la aplicación ya ocupa 256 px, y una segunda columna dejaba el contenido en unos 320 px.
- **Grupos con título solo en la columna.** `SETTINGS_SECTIONS` gana `group` e `icon`. La lista es plana —un `<ul>` con los enlaces— y el título de cada grupo es un `<li>` más, oculto por debajo de `lg`. Anidar un `<ul>` por grupo y aplanarlo en la fila con `display: contents` rompe la semántica de lista en Safari.
- **La sección actual a la vista en el celular.** Al montarse, el enlace con `aria-current="page"` se desplaza al centro de la fila (`scrollIntoView({ inline: "center", block: "nearest" })`): entrar a Usuarios y roles no debe dejarlo fuera de la pantalla. La fila no muestra barra de desplazamiento; el siguiente enlace, cortado en el borde, indica que hay más.
- **El orden cambia poco:** Notificaciones pasa delante de Retención para que *Preferencias* quede antes que *Datos* (General…Estados · Usuarios y roles · Notificaciones · Retención, Exportar). Para el ayudante sigue siendo Notificaciones y luego Exportar.
- **Ancho:** la página ya ocupa todo el ancho (`MainContainer`); el bloque menú + contenido se limita a `max-w-screen-xl` **alineado a la izquierda, no centrado**: el título «Configuración» lo pinta `MainContainer` a todo el ancho, y centrar el bloque lo separaba del título en pantallas anchas (el `mx-auto max-w-4xl` anterior ya lo hacía). Es la alineación del resto de las vistas. El contenido es `min-w-0` para que las tablas y los formularios no empujen la columna.

## Risks / Trade-offs

- **[Radix: diálogo abierto desde un menú]** foco que cae en `body` o `pointer-events` pegado → D4 (`useReturnFocus` recuerda el disparador del menú) y prueba unitaria de foco; el e2e de archivar ejercita el recorrido completo en un navegador real.
- **[Tabla y tarjetas duplicadas en el DOM]** `getByText` de un nombre encuentra dos elementos y Playwright falla por modo estricto (`account.spec.ts:137` lo haría) → localizar dentro de `visibleRows()` o por rol (`getByRole` ya excluye lo oculto).
- **[`Select` de Radix y `FormData`]** si el `<select>` oculto no llegara al `FormData` con la versión instalada → la prueba unitaria de cada diálogo lee el valor enviado; si falla, el `Select` pasa a controlado con un `<input type="hidden">`.
- **[Rol y líneas en dos acciones]** no es atómico: el rol puede guardarse y las líneas fallar → el error se ve en el diálogo abierto y reintentar es idempotente (D7).
- **[El enlace de invitación se pierde al cerrar el diálogo]** igual que hoy al recargar → el aviso «No se vuelve a mostrar» va junto al enlace y «Listo» es explícito.
- **[Más clics]** archivar pasa de uno a tres (⋯ → Archivar → confirmar) → es lo que pide la regla de §14 del mapa de navegación para una acción destructiva; editar sigue a dos.
- **[Duración del e2e]** la suite ronda los 18 min → solo se tocan los recorridos que cambian; se corren primero los archivos afectados.

## Migration Plan

Solo interfaz: sin migraciones, sin datos, sin banderas. Se despliega con el resto; revertir es revertir el commit.

## Corrección al implementar

Al probar la edición en la Geeko Store de la semilla, editar o archivar una línea, canal, categoría o unidad sembrados fallaba con «Invalid UUID» dentro del diálogo, mientras que lo creado desde la aplicación funcionaba. `actions/configuration.ts` validaba el identificador con `z.uuid()` (desde KAM-04), que exige la versión y la variante RFC; los identificadores escritos a mano en `supabase/seed.sql` (`10000000-0000-0000-0000-000000000001`…) no las tienen, y los de las copias de e2e (`md5(...)::uuid`) las tienen solo a veces, por eso ninguna prueba lo había detectado. Pasa a `z.guid("No se pudo identificar el registro.")`, la misma elección que ya documenta `lib/tasks/schema.ts` y que usan `actions/statuses.ts` y `actions/members.ts`. Lo fija `actions/configuration.test.ts` con identificadores con la forma de la semilla.

El botón de la acción destructiva de `ConfirmDialog` no usa la variante `destructive` de `Button` (texto rojo sobre velo rojo): la auditoría de `accessibility.spec.ts` la midió en 3,8:1 (claro) y 4,2:1 (oscuro) sobre el pie del diálogo. Es rojo sólido con texto blanco (`red-700` en oscuro), sin tocar el `Button` compartido.
