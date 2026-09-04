## MODIFIED Requirements

### Requirement: Authenticated shell frames every app screen

Once inside `(app)`, the user MUST see the application shell: a top bar on desktop and a bottom bar on mobile, both present on every `(app)` screen. The signed-in user and the selected organization MUST be available to every screen within the shell. The top bar MUST carry the global business line selector, and the shell's navigation entries MUST be filtered by the signed-in user's role: entries the role cannot use MUST be absent, never shown as disabled. The desktop menu, the mobile bottom bar and the mobile "Más" panel MUST all derive from a single declaration of navigation entries, so that no surface can drift out of step with another.

#### Scenario: Desktop shell shows the top bar

- **WHEN** a signed-in user on desktop opens `/dashboard`
- **THEN** the top bar renders as part of the layout, including the business line selector

#### Scenario: Mobile shell shows the bottom bar

- **WHEN** a signed-in user on mobile opens `/quick`
- **THEN** the bottom bar renders as part of the layout

#### Scenario: Owner sees the owner-only entries

- **WHEN** a signed-in owner views the shell
- **THEN** the navigation offers the entry that leads to `/settings`

#### Scenario: Assistant does not see owner-only entries

- **WHEN** a signed-in assistant views the shell
- **THEN** the owner-only navigation entries are absent from the menu, not rendered disabled

#### Scenario: One declaration feeds every surface

- **WHEN** a navigation entry is restricted to the owner role
- **THEN** it is absent from the desktop menu, from the mobile bottom bar and from the mobile "Más" panel for an assistant, without any surface declaring the restriction separately

## ADDED Requirements

### Requirement: The mobile bottom bar carries exactly four slots

On mobile viewports the bottom bar MUST offer exactly four slots, in this order: Inicio, Pedidos, Tareas and Más. Inicio MUST lead to the quick capture screen, Pedidos to the orders screen and Tareas to *Mis pendientes* — not to the tasks board. The fourth slot MUST open the "Más" panel. No further section MUST occupy a slot of its own, whatever the signed-in role, so that the labels stay legible at 390 px.

#### Scenario: Four slots, whatever the role

- **WHEN** an owner and an assistant each open a screen on a mobile viewport
- **THEN** both bottom bars carry exactly four slots, labelled Inicio, Pedidos, Tareas and Más

#### Scenario: Inicio leads to quick capture

- **WHEN** the Inicio slot is activated on a mobile viewport
- **THEN** the quick capture screen opens

#### Scenario: Tareas leads to Mis pendientes

- **WHEN** the Tareas slot is activated on a mobile viewport
- **THEN** *Mis pendientes* opens, not the tasks board

#### Scenario: Labels are not clipped at 390 px

- **WHEN** the bottom bar renders at a viewport width of 390 px
- **THEN** the four labels render in full, with no horizontal scrolling of the bar

### Requirement: The "Más" panel holds every remaining section

The "Más" slot MUST open a panel listing every section of the application that does not hold a bottom-bar slot, filtered by the signed-in user's role. For the owner this MUST include Egresos, Catálogo, Contactos and Configuración; for the assistant it MUST include Catálogo and Contactos and MUST NOT include Egresos or Configuración. Activating an entry MUST navigate to its section and dismiss the panel.

#### Scenario: Owner sees the money and system sections

- **WHEN** an owner opens the "Más" panel
- **THEN** it offers Egresos, Catálogo, Contactos and Configuración

#### Scenario: Assistant sees only what the role can use

- **WHEN** an assistant opens the "Más" panel
- **THEN** it offers Catálogo and Contactos, and Egresos and Configuración are absent

#### Scenario: Choosing an entry navigates and closes

- **WHEN** an entry of the "Más" panel is activated
- **THEN** its section opens and the panel is dismissed

#### Scenario: A section with a slot is not repeated

- **WHEN** the "Más" panel is open
- **THEN** Inicio, Pedidos and Tareas do not appear inside it

### Requirement: No app screen scrolls horizontally on a phone

At a viewport width of 390 px, every screen of the authenticated area MUST let the user complete its primary action without horizontal scrolling of the page. A component whose content is intrinsically wide — the orders board being the case in point — MAY scroll horizontally within its own bounds, provided the page around it does not.

#### Scenario: Capture screens fit the phone

- **WHEN** the quick capture screen, the new order form, the new purchase form and the new cost form are each opened at 390 px
- **THEN** none of them requires horizontal page scrolling to reach and use its primary action

#### Scenario: Listing screens fit the phone

- **WHEN** the orders screen, the expenses inbox, the catalogue and the contacts directory are each opened at 390 px
- **THEN** none of them requires horizontal page scrolling to reach and use its primary action

#### Scenario: A wide component scrolls inside itself

- **WHEN** the orders board is chosen explicitly at 390 px
- **THEN** the columns scroll horizontally within the board, and the page itself does not
