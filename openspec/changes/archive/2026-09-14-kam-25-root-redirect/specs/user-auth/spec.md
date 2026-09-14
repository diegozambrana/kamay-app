## ADDED Requirements

### Requirement: The root route resolves by session

The root route `/` MUST NOT render content of its own: every request to it MUST be answered with a redirect decided by the session. A request without a valid session MUST be redirected to `/auth/login`, without carrying `/` as a destination to return to. A request with a valid session MUST be redirected to the same device-appropriate home used after signing in: `/dashboard` on desktop viewports and `/quick` on mobile viewports. Reaching the application through `/` MUST NOT bypass organization selection: a user with more than one active organization and no valid active organization MUST be asked to select one before any `(app)` screen is shown. Because the installed application opens at `/`, launching it MUST follow the same rules.

#### Scenario: Anonymous visitor at the root goes to login

- **WHEN** a user without a session opens `/`
- **THEN** they are redirected to `/auth/login`, with no destination preserved in the address

#### Scenario: Signed-in user on desktop goes to the dashboard

- **WHEN** a signed-in user opens `/` from a desktop viewport
- **THEN** they arrive at `/dashboard`

#### Scenario: Signed-in user on mobile goes to quick capture

- **WHEN** a signed-in user opens `/` from a mobile viewport, including by launching the installed application
- **THEN** they arrive at `/quick`

#### Scenario: The root does not skip organization selection

- **WHEN** a signed-in user with active memberships in two organizations, who has not yet chosen one, opens `/`
- **THEN** they are presented with the organization selection screen instead of an `(app)` screen

#### Scenario: A session that ended no longer reaches the app through the root

- **WHEN** a user who just signed out opens `/`
- **THEN** they are redirected to `/auth/login`

### Requirement: An account without an organization can sign out

A signed-in user who has no active membership in any organization — never invited, or removed from every team — MUST be told so instead of seeing the application shell, and that notice MUST offer an action to end the session. Ending the session from the notice MUST behave as it does from the account menu: it MUST invalidate the Supabase session, clear the active-organization cookie and redirect to `/auth/login`, so that another account can sign in. The notice MUST NOT offer navigation into any `(app)` section.

#### Scenario: The notice offers a way out

- **WHEN** a signed-in user with no active membership opens `/` or any `(app)` route
- **THEN** they see a notice saying their account does not belong to any organization, with a "Cerrar sesión" button and no navigation bar

#### Scenario: Signing out from the notice goes to login

- **WHEN** a user without an organization activates "Cerrar sesión" on the notice
- **THEN** their session ends and they land on `/auth/login`

#### Scenario: After signing out, the notice is no longer reachable

- **WHEN** a user who signed out from the notice opens `/` again
- **THEN** they are redirected to `/auth/login` instead of seeing the notice
