# user-auth Specification

## Purpose

Define cómo un usuario entra a Kamay, mantiene su sesión viva, elige con qué organización trabaja y queda dentro de un cascarón de aplicación protegido — sin registro público: las cuentas se crean por invitación.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-02, criterios de aceptación 1–3, 6–7; `specs/PRD/kamay-mapa-navegacion-ui.md` — V1; `specs/PRD/ARCHITECTURE.md` §Enrutado.

## Requirements

### Requirement: Unauthenticated access is redirected to login

Any request to a route of the authenticated group `(app)` without a valid session MUST be redirected to `/auth/login`. The originally requested route MUST be preserved so the user can be returned to it after signing in.

#### Scenario: Anonymous visitor is redirected

- **WHEN** a user without a session visits any `(app)` route (e.g. `/dashboard`)
- **THEN** they are redirected to `/auth/login`

#### Scenario: Original destination is restored after login

- **WHEN** a user's session expires, they attempt to open an `(app)` route and then sign in again from the redirect
- **THEN** they land on the route they originally tried to open

### Requirement: Sign-in lands on the device-appropriate home

After a successful sign-in (and organization selection, when required), the user MUST land on `/dashboard` on desktop viewports and on `/quick` on mobile viewports.

#### Scenario: Desktop lands on the dashboard

- **WHEN** a user signs in from a desktop viewport
- **THEN** they arrive at `/dashboard`

#### Scenario: Mobile lands on quick capture

- **WHEN** a user signs in from a mobile viewport
- **THEN** they arrive at `/quick`

### Requirement: Users with multiple organizations must choose one

A user who belongs to more than one active organization MUST be asked to select one before reaching any `(app)` route. A user with exactly one active organization MUST NOT see the selection step. All subsequent data access happens in the context of the selected organization.

#### Scenario: Multi-organization user selects before continuing

- **WHEN** a user with active memberships in two organizations signs in
- **THEN** they are presented with an organization selection screen before landing on `/dashboard` or `/quick`

#### Scenario: Single-organization user skips selection

- **WHEN** a user with exactly one active membership signs in
- **THEN** they land directly on their home route without a selection step

### Requirement: Session is refreshed on every request

The session MUST be refreshed on each request so that an active user is never forced to sign in again while using the application.

#### Scenario: Active session stays alive

- **WHEN** a signed-in user keeps navigating the application across requests
- **THEN** the session cookie is renewed on each request and no re-authentication is demanded

### Requirement: Password recovery is available

From the login screen, a user MUST be able to request a password reset by email and complete it to regain access. The login screen MUST NOT offer public registration — accounts are created by invitation only.

#### Scenario: User recovers access

- **WHEN** a user requests a password reset from the login screen and follows the emailed link
- **THEN** they can set a new password and sign in with it

#### Scenario: No public sign-up exists

- **WHEN** a visitor inspects the login screen and the auth routes
- **THEN** no self-service registration option is offered

### Requirement: Authenticated shell frames every app screen

Once inside `(app)`, the user MUST see the application shell: a top bar on desktop and a bottom bar on mobile, both present on every `(app)` screen. The signed-in user and the selected organization MUST be available to every screen within the shell. The top bar MUST carry the global business line selector and a notifications bell with an unread counter, and the shell's navigation entries MUST be filtered by the signed-in user's role: entries the role cannot use MUST be absent, never shown as disabled. The desktop menu, the mobile bottom bar and the mobile "Más" panel MUST all derive from a single declaration of navigation entries, so that no surface can drift out of step with another.

The bell MUST be present for both roles and MUST lead to the notifications tray. While the tray does not yet exist, the bell MUST show a zero counter and MUST say so when activated, rather than offering a link that leads nowhere. The counter MUST NOT display a badge when there is nothing unread.

#### Scenario: Desktop shell shows the top bar

- **WHEN** a signed-in user on desktop opens `/dashboard`
- **THEN** the top bar renders as part of the layout, including the business line selector and the notifications bell

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

#### Scenario: Both roles get the bell

- **WHEN** an assistant opens any `(app)` screen on desktop
- **THEN** the notifications bell is present in the top bar

#### Scenario: Nothing unread shows no badge

- **WHEN** there is nothing unread for the signed-in user
- **THEN** the bell renders without a badge

#### Scenario: The tray does not exist yet

- **WHEN** a user activates the bell before the notifications tray has been built
- **THEN** the shell states that the tray is not available yet and does not navigate to a missing screen
### Requirement: The mobile bottom bar carries exactly four slots

On mobile viewports the bottom bar MUST offer exactly four slots, in this order: Inicio, Pedidos, Tareas and Más. Inicio MUST lead to the quick capture screen, Pedidos to the orders screen and Tareas to *Mis pendientes* — not to the tasks board. The fourth slot MUST open the "Más" panel. No further section MUST occupy a slot of its own, whatever the signed-in role, so that the labels stay legible at 390 px. The bottom bar MUST NOT take over the mobile context strip: the business line selector and the pending-records indicator stay where they are and MUST remain visible and reachable.

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

#### Scenario: The context strip survives the restructure

- **WHEN** the bottom bar renders on a mobile viewport while records are pending synchronization
- **THEN** the business line selector and the pending-records indicator remain visible in the context strip, neither covered by the bar nor moved into it

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
