## MODIFIED Requirements

### Requirement: Authenticated shell frames every app screen

Once inside `(app)`, the user MUST see the application shell: a top bar on desktop and a bottom bar on mobile, both present on every `(app)` screen. The signed-in user and the selected organization MUST be available to every screen within the shell. The top bar MUST carry the global business line selector, a notifications bell with an unread counter, and an account menu, and the shell's navigation entries MUST be filtered by the signed-in user's role: entries the role cannot use MUST be absent, never shown as disabled. The desktop menu, the mobile bottom bar and the mobile "Más" panel MUST all derive from a single declaration of navigation entries, so that no surface can drift out of step with another.

The bell MUST be present for both roles and MUST lead to the notifications tray. While the tray does not yet exist, the bell MUST show a zero counter and MUST say so when activated, rather than offering a link that leads nowhere. The counter MUST NOT display a badge when there is nothing unread.

The account menu MUST show an avatar with the signed-in user's initials and, when opened, MUST offer exactly two items: one that leads to the profile screen and one that ends the session. It MUST be present for both roles.

#### Scenario: Desktop shell shows the top bar

- **WHEN** a signed-in user on desktop opens `/dashboard`
- **THEN** the top bar renders as part of the layout, including the business line selector, the notifications bell and the account menu

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

#### Scenario: The account menu shows initials and two items

- **WHEN** a signed-in user on desktop opens the account menu
- **THEN** an avatar with their initials is shown, and the menu offers exactly "Perfil" and "Cerrar sesión"

#### Scenario: Both roles get the account menu

- **WHEN** an assistant opens any `(app)` screen on desktop
- **THEN** the account menu is present in the top bar

### Requirement: The "Más" panel holds every remaining section

The "Más" slot MUST open a panel listing every section of the application that does not hold a bottom-bar slot, filtered by the signed-in user's role. For the owner this MUST include Egresos, Catálogo, Contactos and Configuración; for the assistant it MUST include Catálogo and Contactos and MUST NOT include Egresos or Configuración. Activating an entry MUST navigate to its section and dismiss the panel.

The panel MUST also carry an account block, distinct from the navigation sections, with exactly two actions: one that leads to the profile screen and one that ends the session. This block MUST be present for both roles.

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

#### Scenario: The account block is present for both roles

- **WHEN** an assistant on a mobile viewport opens the "Más" panel
- **THEN** the panel offers "Perfil" and "Cerrar sesión" in its account block

#### Scenario: Choosing an account action navigates and closes

- **WHEN** "Perfil" or "Cerrar sesión" is activated from the "Más" panel
- **THEN** the corresponding action runs and the panel is dismissed

## ADDED Requirements

### Requirement: The user can end their own session

A signed-in user MUST be able to end their session from the account menu (desktop) or the account block of the "Más" panel (mobile). Ending the session MUST invalidate the Supabase session and clear the active-organization cookie, and MUST redirect to `/auth/login`. Once ended, none of the previously reachable `(app)` routes MUST remain accessible without signing in again.

When there are records still waiting to be synchronized, ending the session MUST ask for confirmation before proceeding, so that no locally captured record is silently stranded.

#### Scenario: Signing out redirects to login

- **WHEN** a signed-in user chooses "Cerrar sesión"
- **THEN** their session ends and they land on `/auth/login`

#### Scenario: A protected route is no longer reachable

- **WHEN** a user who just signed out requests a previously reachable `(app)` route
- **THEN** they are redirected to `/auth/login`

#### Scenario: Pending records ask for confirmation first

- **WHEN** a user with records pending synchronization chooses "Cerrar sesión"
- **THEN** the shell asks for confirmation before ending the session

#### Scenario: Confirming with pending records proceeds

- **WHEN** a user confirms ending the session despite pending records
- **THEN** the session ends the same way as when there is nothing pending

#### Scenario: No pending records skips the confirmation

- **WHEN** a user with nothing pending chooses "Cerrar sesión"
- **THEN** the session ends immediately, without an intermediate confirmation step
