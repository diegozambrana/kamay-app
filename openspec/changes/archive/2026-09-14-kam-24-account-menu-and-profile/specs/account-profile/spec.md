## Purpose

Da a cualquier persona con sesión una pantalla propia donde ver sus datos de cuenta, corregir su nombre visible y cambiar su contraseña sin depender del flujo de recuperación por correo.

## ADDED Requirements

### Requirement: The profile screen shows the user's account data

The profile screen (`/profile`) MUST be reachable from the account menu (desktop) or the account block of the "Más" panel (mobile), and MUST require a signed-in session like every other `(app)` route. It MUST show, read-only, the signed-in user's email, their active organization's name and their role in it.

#### Scenario: Profile shows read-only account data

- **WHEN** a signed-in user opens `/profile`
- **THEN** their email, active organization name and role are shown, none of them editable

#### Scenario: Profile requires a session

- **WHEN** a user without a session requests `/profile`
- **THEN** they are redirected to `/auth/login`

### Requirement: The user edits their own display name from the profile screen

The profile screen MUST let the signed-in user change the display name shown for their active organization's membership, and MUST show the result of the change (success or a domain error) without leaving the screen.

#### Scenario: Saving a new display name updates it everywhere it is shown

- **WHEN** a user saves a new display name from the profile screen
- **THEN** the new name is what the shell and every other screen show for that person from then on

#### Scenario: An empty display name is rejected

- **WHEN** a user submits an empty display name
- **THEN** the change is rejected and the previous name is kept

### Requirement: The user changes their password after verifying the current one

The profile screen MUST offer a "Cambiar contraseña" action that opens a modal with three fields: current password, new password and confirm new password. The system MUST verify the current password before applying the change — Supabase's own password update does not require it under this project's configuration, so the verification is the application's responsibility. The new password MUST be confirmed by typing it twice, and MUST meet the same minimum requirements enforced elsewhere in the product (at least 6 characters).

Verifying the current password MUST NOT end or otherwise disturb the user's active session, whether the current password is correct or not.

#### Scenario: Correct current password changes it

- **WHEN** a user enters their correct current password along with a matching new password and confirmation
- **THEN** the password is changed and the user can sign in afterward with the new one

#### Scenario: Wrong current password is rejected

- **WHEN** a user enters an incorrect current password
- **THEN** the change is rejected with an error and the password stays unchanged

#### Scenario: Mismatched confirmation is rejected before submitting

- **WHEN** the new password and its confirmation do not match
- **THEN** the modal shows a validation error and no change is attempted

#### Scenario: A too-short new password is rejected

- **WHEN** the new password has fewer than 6 characters
- **THEN** the change is rejected with a validation error and the password stays unchanged

#### Scenario: Checking the current password does not sign the user out

- **WHEN** a user submits the wrong current password in the modal
- **THEN** their existing session on the profile screen remains active afterward
