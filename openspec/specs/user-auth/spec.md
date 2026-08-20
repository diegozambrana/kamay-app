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

Once inside `(app)`, the user MUST see the application shell: a top bar on desktop and a bottom bar on mobile, both present on every `(app)` screen even while their navigation entries are still empty. The signed-in user and the selected organization MUST be available to every screen within the shell.

#### Scenario: Desktop shell shows the top bar

- **WHEN** a signed-in user on desktop opens `/dashboard`
- **THEN** the top bar renders as part of the layout

#### Scenario: Mobile shell shows the bottom bar

- **WHEN** a signed-in user on mobile opens `/quick`
- **THEN** the bottom bar renders as part of the layout
