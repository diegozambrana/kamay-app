## MODIFIED Requirements

### Requirement: Sign-in lands on the device-appropriate home

After a successful sign-in (and organization selection, when required), the user MUST land on `/dashboard` on desktop viewports and on `/quick` on mobile viewports. A platform admin is the exception only while no organization is active for them: they MUST land on `/admin/organizations` on every viewport; with an active organization they land like everyone else.

#### Scenario: Desktop lands on the dashboard

- **WHEN** a user signs in from a desktop viewport
- **THEN** they arrive at `/dashboard`

#### Scenario: Mobile lands on quick capture

- **WHEN** a user signs in from a mobile viewport
- **THEN** they arrive at `/quick`

#### Scenario: A platform admin without an organization lands on Organizations

- **WHEN** a platform admin with no active organization signs in
- **THEN** they arrive at `/admin/organizations`

#### Scenario: A platform admin back in an organization lands on the home

- **WHEN** a platform admin whose active organization is still valid signs in again from a desktop viewport
- **THEN** they arrive at `/dashboard` inside that organization

### Requirement: Users with multiple organizations must choose one

A user who belongs to more than one active organization MUST be asked to select one before reaching any `(app)` route. A user with exactly one active organization MUST NOT see the selection step. All subsequent data access happens in the context of the selected organization. A platform admin MUST NOT be sent to the selection step, whatever their memberships: they choose the organization from the sidebar selector or the Organizations view, and without an active one they are taken to `/admin/organizations`.

#### Scenario: Multi-organization user selects before continuing

- **WHEN** a user who is not platform admin, with active memberships in two organizations, signs in
- **THEN** they are presented with an organization selection screen before landing on `/dashboard` or `/quick`

#### Scenario: Single-organization user skips selection

- **WHEN** a user with exactly one active membership signs in
- **THEN** they land directly on their home route without a selection step

#### Scenario: A platform admin never gets the selection screen

- **WHEN** a platform admin with active memberships in two organizations, and no active organization, signs in or opens `/auth/select-org`
- **THEN** they arrive at `/admin/organizations` instead of the selection screen

### Requirement: An account without an organization can sign out

A signed-in user who has no active membership in any organization — never invited, or removed from every team — and who is not a platform admin MUST be told so instead of seeing the application shell, and that notice MUST offer an action to end the session. Ending the session from the notice MUST behave as it does from the account menu: it MUST invalidate the Supabase session, clear the active-organization cookie and redirect to `/auth/login`, so that another account can sign in. The notice MUST NOT offer navigation into any `(app)` section. A platform admin without memberships MUST NOT see the notice: they get the platform shell instead.

#### Scenario: The notice offers a way out

- **WHEN** a signed-in user who is not platform admin and has no active membership opens `/` or any `(app)` route
- **THEN** they see a notice saying their account does not belong to any organization, with a "Cerrar sesión" button and no navigation bar

#### Scenario: Signing out from the notice goes to login

- **WHEN** a user without an organization activates "Cerrar sesión" on the notice
- **THEN** their session ends and they land on `/auth/login`

#### Scenario: After signing out, the notice is no longer reachable

- **WHEN** a user who signed out from the notice opens `/` again
- **THEN** they are redirected to `/auth/login` instead of seeing the notice

#### Scenario: A platform admin without memberships never sees the notice

- **WHEN** a platform admin with no membership in any organization opens `/`
- **THEN** they arrive at `/admin/organizations` with the platform shell, and the notice is not shown
