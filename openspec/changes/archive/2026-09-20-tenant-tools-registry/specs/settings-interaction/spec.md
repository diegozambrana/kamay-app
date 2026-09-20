## MODIFIED Requirements

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
