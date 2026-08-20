## MODIFIED Requirements

### Requirement: Authenticated shell frames every app screen

Once inside `(app)`, the user MUST see the application shell: a top bar on desktop and a bottom bar on mobile, both present on every `(app)` screen. The signed-in user and the selected organization MUST be available to every screen within the shell. The top bar MUST carry the global business line selector, and the shell's navigation entries MUST be filtered by the signed-in user's role: entries the role cannot use MUST be absent, never shown as disabled.

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
