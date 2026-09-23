## ADDED Requirements

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

## MODIFIED Requirements

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
