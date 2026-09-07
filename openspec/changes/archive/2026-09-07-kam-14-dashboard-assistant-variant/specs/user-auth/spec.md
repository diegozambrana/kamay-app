## MODIFIED Requirements

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
