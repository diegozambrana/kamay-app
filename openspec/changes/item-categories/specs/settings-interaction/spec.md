## MODIFIED Requirements

### Requirement: Configuration lists are tables with a row actions menu

The Business lines, Channels, Expense categories, Item categories and Units sections of `/settings`, and the three lists of the Users and roles section, MUST present their entries as a table. Each row MUST end with an actions menu opened from a "⋯" button whose accessible name identifies the row (for example «Acciones de Sublimación»), and the row's actions MUST be offered only from that menu — no action buttons sit loose on the row. Destructive actions (Archivar, Quitar acceso, Revocar) MUST appear last in the menu, set apart from the rest.

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
- **THEN** the menu offers «Editar» and «Archivar», and the row shows no other action button

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

### Requirement: Settings sections are navigated from a side menu

The `/settings` page MUST use the full width of the application's content area and MUST limit its settings block —section menu and section content together— to a maximum width of 1280 px, aligned with the page title (not centered, so the title and the menu share the same left edge). The menu MUST list the sections the person can open, grouped under visible headings —*Organización* (General, Business lines, Channels, Expense categories, Item categories, Units, Statuses), *Equipo* (Users and roles), *Preferencias* (Notifications) and *Datos* (Retention, Export)—, each entry with an icon and its name; a group with no section open to the person MUST NOT be shown.

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
