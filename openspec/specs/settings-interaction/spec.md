# settings-interaction Specification

## Purpose

Fija un solo patrón de interacción para las secciones de configuración que gestionan entidades (V15 y V22): alta y edición en un diálogo, confirmación en un diálogo de toda acción que no es un formulario, listas en tablas con sus acciones en un menú «⋯» por fila, y un menú lateral de secciones.

> Origen: cambio `settings-dialogs-and-tables`; `specs/PRD/kamay-mapa-navegacion-ui.md` §2.3 y §14 — V15, V22.

## Requirements

### Requirement: Configuration lists are tables with a row actions menu

The Business lines, Channels, Expense categories, Item categories and Units sections of `/settings`, and the three lists of the Users and roles section, MUST present their entries as a table. Each row MUST end with an actions menu opened from a "⋯" button whose accessible name identifies the row (for example «Acciones de Sublimación»), and the row's actions MUST be offered only from that menu — no action buttons sit loose on the row. Destructive actions (Archivar, Quitar acceso, Revocar) MUST appear last in the menu, set apart from the rest. The row of an active item category MUST also offer «Atributos», between «Editar» and «Archivar», which opens the attributes of that category.

The table of each section MUST show:

- Business lines: the name with its color, and the color's name.
- Channels, Expense categories and Item categories: the name. Item categories list only those of the selected kind tab.
- Units: the code and the name.

When a section has no active entries, it MUST show its initial empty state instead of an empty table. In Item categories the empty state MUST name the selected kind (for example «Aún no hay categorías de insumo»).

#### Scenario: A line row offers its actions from the menu

- **WHEN** an owner opens `/settings/lines` and opens the "⋯" menu of a line that is not the shared one
- **THEN** the menu offers «Editar» and «Archivar», and the row shows no other action button

#### Scenario: A unit row shows its code and name

- **WHEN** an owner opens `/settings/units`
- **THEN** each unit is a table row showing its code and its name, with a "⋯" menu at the end

#### Scenario: The menu is reachable by keyboard

- **WHEN** an owner moves focus to the "⋯" button of a row and presses Enter
- **THEN** the menu opens and its actions can be chosen with the arrow keys and Enter

#### Scenario: An item category row offers its actions from the menu

- **WHEN** an owner opens `/settings/item-categories` in the Insumos tab and opens the "⋯" menu of «Sustratos»
- **THEN** the menu offers «Editar», «Atributos» and, set apart and last, «Archivar», and the row shows no other action button

#### Scenario: A kind without categories shows its empty state

- **WHEN** an owner opens the Activos tab of `/settings/item-categories` in an organization without asset categories
- **THEN** the section shows «Aún no hay categorías de activo» with a hint to use its creation button, and no empty table

### Requirement: Archived entries are listed in their own table

In the Business lines, Channels, Expense categories, Item categories and Units sections, archived entries MUST remain visible in a separate table titled «Archivados», placed below the table of active entries. In Item categories, the «Archivados» table MUST list only the archived categories of the selected kind tab. The menu of an archived row MUST offer «Restaurar» and nothing else. When the section —or, in Item categories, the selected tab— has no archived entries, the «Archivados» table MUST NOT be shown.

#### Scenario: An archived channel moves to the archived table

- **WHEN** an owner archives a channel and confirms
- **THEN** the channel leaves the active table and appears in the «Archivados» table, whose menu offers only «Restaurar»

#### Scenario: No archived entries, no archived table

- **WHEN** an owner opens a section in which no entry is archived
- **THEN** no «Archivados» table is shown

#### Scenario: Restoring an item category

- **WHEN** an owner chooses «Restaurar» on an archived supply category and confirms
- **THEN** the category returns to the active table of the Insumos tab and is offered again in supply forms and in the catalog filter

### Requirement: Creating a configuration entry happens in a dialog

Each section that manages entities MUST offer a single creation button next to its title that opens a dialog containing the creation form, a primary button that submits it and a «Cancelar» button that closes the dialog without saving. The creation forms MUST NOT be rendered inline on the page. The buttons and fields MUST be:

| Section | Button that opens the dialog | Fields | Primary button |
|---|---|---|---|
| Business lines | «Crear línea» | Nombre, Color | «Crear línea» |
| Channels | «Nuevo canal» | Nombre | «Crear canal» |
| Expense categories | «Nueva categoría» | Nombre | «Crear categoría» |
| Item categories | «Nueva categoría» | Nombre | «Crear categoría» |
| Units | «Nueva unidad» | Código, Nombre | «Crear unidad» |
| Statuses | «Agregar estado» | Nombre, Tipo, Color, Columna en cola | «Agregar estado» |
| Users and roles | «Invitar» | Correo, Rol | «Invitar» |

In Item categories the dialog MUST NOT ask for the kind: the category is created with the kind of the selected tab, and the dialog title MUST name it («Nueva categoría de insumo», «Nueva categoría de producto», «Nueva categoría de activo»; «Editar categoría de insumo»… when editing).

On success the dialog MUST close and the new entry MUST appear in the section's list without reloading the page.

#### Scenario: Owner creates a line from the dialog

- **WHEN** an owner presses «Crear línea» in `/settings/lines`, fills *Nombre* and picks a *Color* in the dialog, and presses «Crear línea»
- **THEN** the dialog closes and the new line appears in the table with the chosen color

#### Scenario: Cancelling creates nothing

- **WHEN** an owner opens the «Nueva categoría» dialog, types a name and presses «Cancelar»
- **THEN** the dialog closes, no category is created, and opening the dialog again shows the form empty

#### Scenario: No inline creation form

- **WHEN** an owner opens `/settings/channels`
- **THEN** the page shows the «Nuevo canal» button and the table, and no *Nombre* field is rendered outside a dialog

#### Scenario: Owner creates an item category in the selected tab

- **WHEN** an owner presses «Nueva categoría» in the Productos tab of `/settings/item-categories`
- **THEN** the dialog is titled «Nueva categoría de producto», asks only for *Nombre*, and on «Crear categoría» the new category appears in the Productos table

### Requirement: Editing a configuration entry happens in a dialog

Choosing «Editar» in a row's menu MUST open a dialog with the same form used for creation, prefilled with the entry's current values, a «Guardar cambios» primary button and «Cancelar». On success the dialog MUST close and the row MUST show the new values.

#### Scenario: Owner renames a unit

- **WHEN** an owner chooses «Editar» on the unit «kg · Kilogramo», changes *Nombre* in the dialog and presses «Guardar cambios»
- **THEN** the dialog closes and the row shows the new name

#### Scenario: The edit dialog opens prefilled

- **WHEN** an owner chooses «Editar» on a line
- **THEN** the dialog shows that line's current name and color

### Requirement: A rejected submission keeps the dialog open

When the server rejects a dialog's submission (for example a duplicate name in the same organization) or the form fails validation, the dialog MUST stay open, keep what the user typed, and show the error message inside the dialog. While the submission is in flight, the primary button MUST be disabled.

#### Scenario: Duplicate name

- **WHEN** an owner submits the «Nuevo canal» dialog with the name of a channel that already exists in the organization
- **THEN** the dialog stays open with the typed name and shows the error inside it, and no second channel is created

### Requirement: Every action that is not a form asks for confirmation

Every action on a configuration entry that does not open a form MUST first open a confirmation dialog that names the entry, explains the consequence in one or two sentences, and offers a button labelled with the action and a «Cancelar» button. The action MUST run only when the user presses the action button; «Cancelar», Escape or clicking outside MUST close the dialog and change nothing. Destructive actions MUST present their action button with the destructive style.

This applies at least to: Archivar and Restaurar (lines, channels, categories, units, statuses), Quitar acceso (members), Revocar (invitations), Restaurar valores por defecto, Crear el juego por defecto, Crear juego propio para esta línea and Usar el juego de la organización (statuses).

If the action fails, the confirmation dialog MUST stay open and show the error inside it.

#### Scenario: Archiving a line asks first

- **WHEN** an owner chooses «Archivar» on a line
- **THEN** a confirmation dialog explains that the line stops being offered in new work while its history keeps showing it, and nothing is archived yet

#### Scenario: Confirming archives

- **WHEN** the owner presses «Archivar» in that confirmation dialog
- **THEN** the dialog closes and the line moves to the «Archivados» table

#### Scenario: Cancelling leaves the entry untouched

- **WHEN** the owner presses «Cancelar» in that confirmation dialog
- **THEN** the dialog closes and the line stays active in the table

#### Scenario: Restoring an archived entry asks first

- **WHEN** an owner chooses «Restaurar» on an archived category and confirms
- **THEN** the category returns to the active table

### Requirement: The Users and roles section follows the same pattern

The Users and roles section MUST present three tables: *Equipo* (active members, with name, role and business lines), *Invitaciones pendientes* (email, role and expiry date) and *Sin acceso* (archived members, with name and role, without actions).

- «Invitar» MUST open a dialog with *Correo* and *Rol*. When the invitation is created, the same dialog MUST show the invitation link with a button to copy it and a warning that it will not be shown again; closing the dialog discards the link.
- «Editar» on a member MUST open a dialog to change the role and, for an assistant, the business lines they cover. The dialog MUST state that no line selected means every line. Saving MUST apply the role and the lines in one step from the user's point of view.
- «Quitar acceso» on a member and «Revocar» on an invitation MUST ask for confirmation.

The role and the business lines of a member MUST NOT be editable directly on the row.

#### Scenario: Owner invites and copies the link from the dialog

- **WHEN** an owner presses «Invitar», fills *Correo*, keeps the role *Ayudante* and presses «Invitar» in the dialog
- **THEN** the dialog shows the invitation link, a button to copy it and the warning that it is not shown again, and the invitation appears in *Invitaciones pendientes*

#### Scenario: Owner restricts an assistant to one line

- **WHEN** an owner chooses «Editar» on an assistant, marks only *Alfarería* in the dialog and presses «Guardar cambios»
- **THEN** the dialog closes and the assistant's row shows *Alfarería* as their only line

#### Scenario: Promoting to owner hides the lines

- **WHEN** an owner changes the role to *Dueña o dueño* inside the edit dialog
- **THEN** the business lines field is no longer shown, because an owner sees every line

#### Scenario: Removing access asks first

- **WHEN** an owner chooses «Quitar acceso» on a member and presses «Cancelar» in the confirmation dialog
- **THEN** the member keeps their access and stays in *Equipo*

#### Scenario: The last owner cannot lose access

- **WHEN** an owner confirms «Quitar acceso» on the organization's only active owner
- **THEN** the confirmation dialog stays open and shows why it was rejected, and the member keeps their access

#### Scenario: Revoking an invitation asks first

- **WHEN** an owner chooses «Revocar» on a pending invitation and confirms
- **THEN** the invitation leaves *Invitaciones pendientes*

### Requirement: Dialogs return focus to what opened them

Closing any dialog of the configuration sections — by its action, by «Cancelar» or by Escape — MUST return focus to the control that opened it: the section's creation button, or the "⋯" button of the row whose menu opened it.

#### Scenario: Focus returns to the row menu

- **WHEN** an owner opens «Editar» from a row's "⋯" menu and closes the dialog with Escape
- **THEN** focus is on that row's "⋯" button

### Requirement: Single-form sections stay on the page

The General, Allocation of shared expenses, Retention, Notifications and Export sections — which edit settings of the organization or of the person rather than a list of entries — MUST keep their form on the page with its «Guardar» button (or «Descargar» for Export), and saving MUST NOT open a dialog nor ask for confirmation.

#### Scenario: Saving retention does not ask for confirmation

- **WHEN** an owner changes the months in `/settings/retention` and presses «Guardar»
- **THEN** the value is saved and confirmed on the page, without any dialog

### Requirement: Settings sections are navigated from a side menu

The `/settings` page MUST use the full width of the application's content area and MUST limit its settings block —section menu and section content together— to a maximum width of 1280 px, aligned with the page title (not centered, so the title and the menu share the same left edge). The menu MUST list the sections the person can open, grouped under visible headings —*Organización* (General, Business lines, Channels, Expense categories, Item categories, Units, Statuses, Tools), *Equipo* (Users and roles), *Preferencias* (Notifications) and *Datos* (Retention, Export)—, each entry with an icon and its name; a group with no section open to the person MUST NOT be shown. The Tools entry MUST be labelled «Herramientas», MUST be the last entry of *Organización*, and MUST be offered to the owner only.

- On a wide screen (1024 px and up) the menu MUST be a vertical column on the left and the section content MUST sit to its right; the menu MUST stay visible while the content scrolls.
- On narrower screens the menu MUST be a single horizontal row above the content that scrolls sideways, without group headings, and the section being viewed MUST be scrolled into view. The page itself MUST NOT scroll horizontally.

The entry of the section being viewed MUST be marked as the current page (`aria-current="page"`) and look selected.

#### Scenario: Owner sees the menu beside the content on a wide screen

- **WHEN** an owner opens `/settings/lines` on a 1280 px wide screen
- **THEN** the section menu is a column on the left with the groups *Organización*, *Equipo*, *Preferencias* and *Datos*, the Business lines content is to its right, and «Líneas de negocio» is marked as the current page

#### Scenario: The settings block does not stretch past its maximum width

- **WHEN** an owner opens any settings section on a 1920 px wide screen
- **THEN** the menu and the content together are no wider than 1280 px and start at the same left edge as the page title

#### Scenario: On a phone the menu is one row that scrolls sideways

- **WHEN** an owner opens `/settings/members` on a 390 px wide screen
- **THEN** the sections appear in a single row above the content, «Usuarios y roles» is visible and marked as the current page, and the page has no horizontal scroll

#### Scenario: The assistant sees only their groups

- **WHEN** an assistant opens `/settings/notifications`
- **THEN** the menu shows only *Preferencias* (Notifications) and *Datos* (Export), with no empty group heading

#### Scenario: Item categories is marked when open

- **WHEN** an owner opens `/settings/item-categories`
- **THEN** the *Organización* group lists «Categorías de gasto» and «Categorías de ítem», and «Categorías de ítem» is marked as the current page

#### Scenario: Tools closes the Organización group

- **WHEN** an owner opens `/settings/tools`
- **THEN** «Herramientas» is the last entry of the *Organización* group and is marked as the current page

#### Scenario: The assistant is not offered Tools

- **WHEN** an assistant opens the settings menu
- **THEN** no entry points to `/settings/tools`

### Requirement: The attributes of an item category follow the configuration pattern

The «Atributos» action of an item category row MUST open the attributes of that category inside the Item categories section, with a header that names the category and a way back to the list of categories. The attributes MUST be presented as a table with, per row, the name, the type («Texto», «Número» with its unit when it has one, «Lista» with the count of options, «Color»), whether it is required, and what it applies to («Ítem» or «Variante»), in position order. Each row MUST end with a «⋯» menu whose accessible name identifies the row, offering «Editar» and, set apart and last, «Archivar». Archived attributes MUST be listed in their own «Archivados» table below, whose rows offer «Restaurar» and nothing else; when there are none, that table MUST NOT be shown. When the category has no active attributes, the section MUST show «Aún no hay atributos en esta categoría» with a hint to use its creation button, and no empty table.

Creating an attribute MUST happen in a dialog titled «Nuevo atributo» with the fields Nombre, Tipo (Texto, Número, Lista, Color), Unidad (shown only for Número), Opciones (shown only for Lista, one per line), Obligatorio and Aplica a (Ítem, Variante), and the submit «Crear atributo». Editing MUST happen in a dialog titled «Editar atributo» that offers Nombre, Unidad, Opciones and Obligatorio, and MUST NOT offer Tipo nor Aplica a. Archiving and restoring MUST ask for confirmation, and archiving MUST say that stored values are kept. A rejected submission MUST keep the dialog open with what was typed and show the reason.

#### Scenario: A category row offers its attributes

- **WHEN** an owner opens `/settings/item-categories` in the Insumos tab and opens the «⋯» menu of «Filamento»
- **THEN** the menu offers «Editar», «Atributos» and, set apart and last, «Archivar»

#### Scenario: The attributes table shows each definition

- **WHEN** an owner opens «Atributos» of «Filamento», which declares «Temperatura mínima» (number, °C, item) and «Color» (list of four options, variant, required)
- **THEN** the table shows «Temperatura mínima · Número (°C) · Ítem» and «Color · Lista (4 opciones) · Obligatorio · Variante», each row with a «⋯» menu and no loose action button

#### Scenario: Owner creates a list attribute

- **WHEN** an owner presses «Nuevo atributo», types «Color», chooses Lista, types the options Negro, Blanco, Rojo and Azul one per line, marks Obligatorio, chooses Variante and presses «Crear atributo»
- **THEN** the dialog closes and «Color» appears last in the table with its type, its four options and its scope

#### Scenario: Unit appears only for numbers

- **WHEN** an owner opens «Nuevo atributo» and switches Tipo from Texto to Número
- **THEN** the Unidad field appears, and switching to Lista hides it and shows Opciones instead

#### Scenario: A color attribute asks for neither unit nor options

- **WHEN** an owner opens «Nuevo atributo» and chooses Tipo Color
- **THEN** neither Unidad nor Opciones is shown, and creating it lists the row with type «Color»

#### Scenario: Editing does not offer type or scope

- **WHEN** an owner chooses «Editar» on «Temperatura mínima»
- **THEN** the dialog is titled «Editar atributo», offers Nombre, Unidad and Obligatorio prefilled, and offers neither Tipo nor Aplica a

#### Scenario: Archiving warns that values are kept

- **WHEN** an owner chooses «Archivar» on «Velocidad recomendada»
- **THEN** a confirmation says the attribute stops being offered and the values already stored are kept, and confirming moves it to the «Archivados» table

#### Scenario: A category without attributes shows its empty state

- **WHEN** an owner opens «Atributos» of a category that declares none
- **THEN** the section shows «Aún no hay atributos en esta categoría» with a hint to use «Nuevo atributo», and no empty table

#### Scenario: Back to the categories

- **WHEN** an owner is in the attributes of «Filamento» and uses the way back
- **THEN** the Item categories list is shown again in the Insumos tab

#### Scenario: The assistant cannot reach the attributes

- **WHEN** an assistant opens the address of the attributes of a category directly
- **THEN** they are redirected like from any other owner-only section
