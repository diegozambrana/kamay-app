# user-management Specification

## Purpose

Permite que el dueño incorpore a su equipo sin registro público: invita por correo con un enlace de un solo uso, cambia el rol de una membresía y la archiva cuando alguien deja de trabajar en la organización — sin que ninguna acción de usuario use privilegios elevados.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-04 (Gestión de usuarios) y KAM-02 (las cuentas se crean por invitación); `specs/PRD/kamay-especificacion-producto-v6.md` §Acceso y roles.

## Requirements

### Requirement: Invitations are stored per organization with a single-use token

The database MUST contain the table `invitations` with `organization_id` (not null, referencing `organizations`), `email`, `role` constrained to `owner | assistant`, an unguessable `token`, `expires_at`, `accepted_at`, `invited_by`, `created_at` and `archived_at`. At most one pending invitation MUST exist per `(organization_id, email)`. The table MUST carry the `audit` trigger from its creation migration.

#### Scenario: A second pending invitation for the same email is rejected

- **WHEN** an owner creates an invitation for an email that already has a pending invitation in that organization
- **THEN** the database rejects the insert

#### Scenario: An invitation may be reissued after the previous one was resolved

- **WHEN** an owner invites an email whose previous invitation was accepted, revoked or expired
- **THEN** the new invitation is created

### Requirement: Only the owner manages invitations, and no one reads another organization's

RLS MUST be enabled on `invitations`. `SELECT`, `INSERT` and `UPDATE` MUST be restricted to `is_owner(organization_id)`. No `DELETE` policy MUST exist. Revoking an invitation MUST be an archive (`archived_at`), never a deletion.

#### Scenario: Assistant cannot see or create invitations

- **WHEN** a user with role `assistant` queries or inserts into `invitations`
- **THEN** the query returns zero rows and the insert is rejected under RLS

#### Scenario: Invitations of another organization are invisible

- **WHEN** an owner of organization A queries `invitations`
- **THEN** zero rows of organization B are returned

#### Scenario: Revoking archives instead of deleting

- **WHEN** an owner revokes a pending invitation
- **THEN** the row remains with `archived_at` set and is no longer acceptable

### Requirement: Inviting a user never requires elevated privileges

Creating an invitation MUST be possible for the owner through ordinary authenticated access, without the application using a service-role client in any user-triggered action.

#### Scenario: Owner invites an assistant

- **WHEN** an owner submits an email and the role `assistant` in the Users and roles section
- **THEN** a pending invitation is created for that email with that role and an expiry date

### Requirement: Accepting a valid invitation creates the membership

Accepting an invitation MUST create an active `memberships` row for the accepting user in the invitation's organization with the invitation's role, and MUST mark the invitation as accepted so the same token cannot be used again. Acceptance MUST be rejected when the invitation is expired, already accepted, revoked, or when the accepting user's email does not match the invited email.

#### Scenario: Valid invitation grants membership

- **WHEN** a signed-in user whose email matches the invitation opens a valid, unexpired invitation link
- **THEN** an active membership is created for them in that organization with the invited role, and the invitation is marked accepted

#### Scenario: A token cannot be used twice

- **WHEN** an already accepted invitation link is opened again
- **THEN** acceptance is rejected and no second membership is created

#### Scenario: Expired invitation is rejected

- **WHEN** an invitation whose `expires_at` is in the past is opened
- **THEN** acceptance is rejected and no membership is created

#### Scenario: Another user cannot claim someone else's invitation

- **WHEN** a signed-in user whose email differs from the invited email opens the invitation link
- **THEN** acceptance is rejected and no membership is created

### Requirement: The owner changes the role of an existing membership

The Users and roles section MUST let the owner change a membership's role between `owner` and `assistant`. The change MUST take effect for the affected user's next request without them re-registering.

#### Scenario: Assistant is promoted to owner

- **WHEN** an owner changes an assistant's membership role to `owner`
- **THEN** that user's subsequent requests are authorized as owner

#### Scenario: Role change is logged

- **WHEN** an owner changes a membership's role
- **THEN** an `activity_log` event records the change with the previous and the new role and the acting user as author

### Requirement: The owner archives a membership and the access stops

Archiving a membership MUST end that user's access to the organization: their next request MUST NOT return any of the organization's rows. An organization MUST always keep at least one active owner — archiving the last active owner MUST be rejected.

#### Scenario: Archived member loses access

- **WHEN** an owner archives an assistant's membership and that user makes a request
- **THEN** the user obtains zero rows of that organization

#### Scenario: The last active owner cannot be archived

- **WHEN** an owner attempts to archive the only remaining active owner membership of the organization
- **THEN** the operation is rejected and the membership stays active

#### Scenario: Archiving a membership is logged

- **WHEN** an owner archives a membership
- **THEN** an `activity_log` event with action `archived` records it with the acting user as author
