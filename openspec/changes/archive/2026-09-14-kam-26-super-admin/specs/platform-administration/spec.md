## Purpose

Da a Kamay un administrador de la plataforma (super admin): una cuenta que no necesita pertenecer a ninguna organización, que ve y administra todas las organizaciones y cuentas, y que puede entrar a cualquier organización con la vista de su dueño — sin que ninguna acción de usuario use privilegios que salten RLS.

## ADDED Requirements

### Requirement: Platform admins are registered above organizations

The database MUST contain the table `platform_admins`, holding at most one row per user account, with the moment the grant was made and `archived_at` for revocation. A user account MUST be recognized as platform admin if and only if it has a row with `archived_at` null. RLS MUST be enabled on the table; an authenticated user MUST be able to read only their own row, and no `INSERT`, `UPDATE` or `DELETE` MUST be possible for the `authenticated` or `anon` roles. The table MUST be the only table of the application, besides `organizations`, without `organization_id`, and the automatic catalog verification MUST name it as an explicit, justified exception rather than skip it silently.

#### Scenario: An active row makes a platform admin

- **WHEN** a user account with a `platform_admins` row whose `archived_at` is null asks whether it is platform admin
- **THEN** the answer is yes

#### Scenario: A revoked row grants nothing

- **WHEN** a user account whose `platform_admins` row has `archived_at` set asks whether it is platform admin
- **THEN** the answer is no, and it has no access beyond its own memberships

#### Scenario: No one promotes themselves

- **WHEN** an authenticated user — including an organization owner or an active platform admin — attempts to insert or update a row of `platform_admins`
- **THEN** the database rejects the operation and no row changes

#### Scenario: Other admins are not listed through the table

- **WHEN** an authenticated user selects from `platform_admins`
- **THEN** at most their own row is returned

#### Scenario: The catalog check names the exception

- **WHEN** the automatic verification of "every table has `organization_id`" runs over the catalog
- **THEN** it passes, and `platform_admins` appears only in its explicit exception list with the reason written next to it

### Requirement: Only the operator grants and revokes platform admin

Granting and revoking platform admin MUST be possible only through operator tooling run outside the application with direct access to the database. No screen, action or endpoint of the application MUST grant or revoke it. Granting MUST work for an existing account and MUST be able to create the account when it does not exist yet. Revoking MUST archive the row, never delete it, and MUST take effect on the revoked account's next request.

#### Scenario: The operator grants an existing account

- **WHEN** the operator runs the grant command with the email of an existing account
- **THEN** that account is platform admin from its next request

#### Scenario: The operator grants an email with no account

- **WHEN** the operator runs the grant command with an email that has no account, providing an initial password
- **THEN** the account is created, it is platform admin, and it can sign in with that password without belonging to any organization

#### Scenario: Revoking takes effect on the next request

- **WHEN** the operator revokes a platform admin who is currently inside an organization they do not belong to, and that account makes a new request
- **THEN** it obtains zero rows of that organization, and its `platform_admins` row still exists with `archived_at` set

#### Scenario: No screen offers the grant

- **WHEN** a platform admin inspects the Users view and a user's detail
- **THEN** platform admin status is shown read-only, with no control to grant or revoke it

### Requirement: A platform admin acts as owner in every organization

A platform admin MUST be authorized in every organization exactly as an active owner of it would be — reading, creating, editing and archiving under the same rules, including owner-only data such as expenses, assets, reports, invitations and the activity log — without any membership row being created for them. This access MUST come from the same membership helper functions every policy already uses, so that no individual policy is rewritten for it, and MUST NOT rely on a service-role client in any user-triggered action. Where an owner is restricted by a rule (for example, the last active owner cannot be archived, or nothing is ever deleted), the platform admin MUST be restricted by the same rule.

#### Scenario: Reads any organization

- **WHEN** a platform admin who belongs to no organization queries orders, expenses and the activity log of organization B
- **THEN** the rows of organization B are returned as they would be to B's owner

#### Scenario: Writes as an owner would

- **WHEN** a platform admin creates an expense in organization B
- **THEN** the expense is created, exactly as it would be for B's owner

#### Scenario: Owner rules still apply

- **WHEN** a platform admin attempts to delete a row, or to archive the last active owner of an organization
- **THEN** the operation is rejected as it would be for an owner

#### Scenario: Acting creates no membership

- **WHEN** a platform admin works inside organization B
- **THEN** no `memberships` row is created for them in B

#### Scenario: A platform admin who is an assistant somewhere is still an owner there

- **WHEN** a platform admin who also holds an `assistant` membership in organization A opens A's expenses
- **THEN** they are authorized as owner, not restricted as an assistant

### Requirement: A platform admin is not part of an organization's team

Entering an organization MUST NOT make the platform admin a member of it. A platform admin without a membership in an organization MUST NOT appear in that organization's *Usuarios y roles* section, MUST NOT be offered as a task assignee in it, and MUST NOT receive that organization's notifications or reminders.

#### Scenario: Not listed among the members

- **WHEN** the owner of organization B opens *Usuarios y roles* after a platform admin has worked in B
- **THEN** the platform admin does not appear among B's members

#### Scenario: Not assignable

- **WHEN** anyone in organization B opens the assignee selector of a task
- **THEN** the platform admin is not offered, unless they hold a membership in B

#### Scenario: No notifications from foreign organizations

- **WHEN** the daily notifications of organization B are generated
- **THEN** none is addressed to a platform admin who is not a member of B

### Requirement: Actions of a platform admin are marked in the activity log

Every change a platform admin makes inside an organization where they hold no active membership MUST be recorded in that organization's activity log like any other change, with the platform admin as author and marked as made by "Administrador de la plataforma". The activity screen and every record history MUST show that mark next to the author, so the owner can tell the change did not come from their team. Changes a platform admin makes inside an organization where they are an active member MUST be recorded as that member's, without the mark.

#### Scenario: A foreign change is marked

- **WHEN** a platform admin who is not a member of organization B edits an order of B
- **THEN** B's activity log records the change with the platform admin as author and the mark "Administrador de la plataforma"

#### Scenario: The owner sees the mark

- **WHEN** the owner of B opens the activity screen or the order's history
- **THEN** the event shows "Administrador de la plataforma" as its author

#### Scenario: A member's own change is not marked

- **WHEN** a platform admin who is an active owner of organization A edits an order of A
- **THEN** the event is recorded under their membership's name without the mark

### Requirement: The Organizations view lists and opens every organization

The route `/admin/organizations` MUST show every organization of the platform to a platform admin, with its name, its active owners, its number of active members and its creation date, and MUST let them find one by name. Each organization MUST offer an action to enter it (which makes it the active organization and lands on the device-appropriate home, as its owner) and an action to open its detail. The route and its navigation entry MUST be reserved to platform admins: any other signed-in user opening it by direct address MUST be redirected to their home, and the entry MUST be absent from their menus.

#### Scenario: Every organization is listed

- **WHEN** a platform admin opens `/admin/organizations`
- **THEN** every organization is listed, including those they do not belong to, with its owners and number of active members

#### Scenario: Searching by name

- **WHEN** a platform admin types part of an organization's name in the search field
- **THEN** only organizations whose name matches are listed

#### Scenario: Entering an organization

- **WHEN** a platform admin activates "Entrar" on organization B from a desktop viewport
- **THEN** B becomes the active organization and they land on `/dashboard` seeing B's data as its owner

#### Scenario: An owner cannot open it

- **WHEN** an organization owner who is not platform admin opens `/admin/organizations`
- **THEN** they are redirected to their home and no organization list is shown

### Requirement: A platform admin creates an organization ready to use

The Organizations view MUST let a platform admin create an organization by giving its name, currency and timezone, the last two prefilled with the product defaults. The organization MUST be created together with its shared business line *General* and a minimal set of statuses — for orders one of kind `initial`, one `final` and one `cancelled`; for tasks one `initial` and one `final` — in a single all-or-nothing operation, so that no organization ever exists without its shared line. The creation MUST be recorded in the new organization's activity log with the platform admin's mark. After creating it, the platform admin MUST land on the new organization's detail, where they can add its first owner. An empty name MUST be rejected.

#### Scenario: The new organization is usable

- **WHEN** a platform admin creates the organization "Taller Norte"
- **THEN** it exists with exactly one shared business line, order statuses of kind initial, final and cancelled, and task statuses of kind initial and final

#### Scenario: Creation is all-or-nothing

- **WHEN** creating the organization's shared line or statuses fails
- **THEN** no organization is left behind

#### Scenario: An empty name is rejected

- **WHEN** a platform admin submits the creation form with an empty name
- **THEN** a validation error is shown and no organization is created

#### Scenario: Creation is logged and marked

- **WHEN** a platform admin creates an organization
- **THEN** its activity log records the creation with the mark "Administrador de la plataforma"

#### Scenario: Only a platform admin creates organizations

- **WHEN** an organization owner who is not platform admin attempts to create an organization
- **THEN** the operation is rejected and no organization is created

### Requirement: A platform admin edits an organization and manages its team

An organization's detail at `/admin/organizations/[id]` MUST let a platform admin edit its name, currency and timezone, and MUST list its members with their email, display name, role and whether their access is active. From it, the platform admin MUST be able to:

- add an existing account with a role (`owner` or `assistant`) and a display name, without an invitation;
- invite an email with a role, obtaining the same single-use link the owner obtains from *Usuarios y roles*;
- change a member's role;
- remove a member's access (archive the membership), subject to the last-active-owner rule;
- restore the access of an archived member.

Adding an account that already has an archived membership in that organization MUST restore that membership with the chosen role instead of failing. Adding an account that already has an active membership MUST be rejected with a message saying so. Every change MUST be recorded in the organization's activity log with the platform admin's mark.

#### Scenario: Editing the organization's data

- **WHEN** a platform admin changes organization B's name and timezone from its detail
- **THEN** B's row holds the new values and the change is logged with the mark

#### Scenario: Members are listed with their email

- **WHEN** a platform admin opens organization B's detail
- **THEN** each member of B is listed with their email, display name, role and access state

#### Scenario: Adding an existing account as owner

- **WHEN** a platform admin adds an existing account to organization B with role `owner`
- **THEN** that account has an active owner membership in B and, on its next sign-in, can work in B

#### Scenario: Inviting an email

- **WHEN** a platform admin invites an email with role `assistant` from organization B's detail
- **THEN** a pending invitation for B is created and its single-use link is shown once for copying

#### Scenario: Adding a former member restores them

- **WHEN** a platform admin adds an account whose membership in B was archived
- **THEN** the same membership becomes active again with the chosen role

#### Scenario: Adding a current member is rejected

- **WHEN** a platform admin adds an account that already has an active membership in B
- **THEN** the operation is rejected with a message saying the account already belongs to B

#### Scenario: The last owner stays

- **WHEN** a platform admin removes the access of B's only active owner
- **THEN** the operation is rejected and the membership stays active

### Requirement: The Users view lists every account

The route `/admin/users` MUST show a platform admin every user account of the platform, with its email, its display name, each organization it belongs to with the role and access state in it, whether it is platform admin, and when it last signed in. It MUST let them search by email or name and filter the accounts that belong to no organization. The list MUST be obtained without a service-role client in the user-triggered request, and any account that is not platform admin MUST obtain nothing from the same source. The route and its navigation entry MUST be reserved to platform admins, as the Organizations view is.

#### Scenario: Every account is listed

- **WHEN** a platform admin opens `/admin/users`
- **THEN** every account is listed with its email and its organizations and roles, including accounts without any organization

#### Scenario: Accounts without organization are found

- **WHEN** a platform admin applies the "Sin organización" filter
- **THEN** only accounts with no active membership are listed

#### Scenario: A non-admin cannot list accounts

- **WHEN** an organization owner who is not platform admin requests the account list directly from the database
- **THEN** the request is rejected and no email is returned

#### Scenario: An assistant cannot open the view

- **WHEN** an assistant opens `/admin/users` by direct address
- **THEN** they are redirected to their home and no account is shown

### Requirement: A platform admin adds a user to an organization from the platform views

The Users view MUST offer an "Agregar usuario" action, and an organization's detail MUST offer the same action with that organization already chosen. Adding a user MUST take an email, an organization and a role (`owner` or `assistant`), and optionally a display name. When an account with that email exists, it MUST be added to the organization with that role, following the same rules as any other assignment (an archived membership is restored; an active one is reported and left unchanged). When no account has that email, the action MUST create a pending invitation for that email in that organization with that role and MUST show its single-use link once for copying — the account is then created by accepting it, as with any invitation. The result MUST say which of these happened.

#### Scenario: Adding an existing account from the Users view

- **WHEN** a platform admin uses "Agregar usuario" in the Users view with the email of an existing account, organization B and role `owner`
- **THEN** that account has an active owner membership in B and the view says it was added

#### Scenario: Adding an email with no account invites it

- **WHEN** a platform admin uses "Agregar usuario" with an email that has no account, organization B and role `assistant`
- **THEN** a pending invitation for that email is created in B and its link is shown once for copying

#### Scenario: Adding someone who already belongs is reported

- **WHEN** a platform admin uses "Agregar usuario" with the email of an account that already has an active membership in B
- **THEN** no membership changes and the result says the account already belongs to B

#### Scenario: The organization's detail preselects the organization

- **WHEN** a platform admin opens "Agregar usuario" from organization B's detail
- **THEN** the organization is B and cannot be changed in that dialog

### Requirement: A platform admin assigns one or several organizations to an account

A user's detail at `/admin/users/[id]` MUST let a platform admin assign that account to one or several organizations in a single step, choosing the role for each; each assignment MUST behave as adding the account from the organization's detail (restoring an archived membership, rejecting a duplicate active one). For each of the account's memberships, the detail MUST let the platform admin change its role, change its display name and remove or restore its access, under the same rules as the organization's detail. The account's email and password MUST NOT be editable from this view.

#### Scenario: Assigning two organizations at once

- **WHEN** a platform admin assigns an account to organizations B and C, as owner in B and assistant in C
- **THEN** the account has an active owner membership in B and an active assistant membership in C

#### Scenario: One failing assignment does not hide the others

- **WHEN** a platform admin assigns an account to B, where it is already an active member, and to C, where it is not
- **THEN** the membership in C is created and the result states that the account already belonged to B

#### Scenario: Renaming a membership

- **WHEN** a platform admin changes the display name of an account's membership in B
- **THEN** B shows the new name for that person, and the change is logged in B with the mark

#### Scenario: Email and password are not editable

- **WHEN** a platform admin opens a user's detail
- **THEN** the email is shown read-only and no password control is offered

### Requirement: The sidebar offers an organization selector only to platform admins

On desktop viewports, the sidebar MUST show a platform admin an organization selector listing every active organization of the platform, searchable by name, with the active one marked. Choosing an organization MUST make it the active organization and land on `/dashboard` with the shell and every section as that organization's owner would see them. The selector MUST also offer "Vista de plataforma", which clears the active organization and lands on `/admin/organizations`. The selector MUST NOT be rendered for any user who is not platform admin, including users who belong to several organizations. When the sidebar is collapsed to icons, the selector MUST remain reachable as an icon with its tooltip.

#### Scenario: Switching organization from the sidebar

- **WHEN** a platform admin inside organization A chooses organization B in the sidebar selector
- **THEN** B becomes the active organization and `/dashboard` shows B's data, with the owner's navigation entries

#### Scenario: Leaving to the platform view

- **WHEN** a platform admin chooses "Vista de plataforma" in the selector
- **THEN** no organization is active and they land on `/admin/organizations`

#### Scenario: A multi-organization owner has no selector

- **WHEN** an owner who is not platform admin and belongs to two organizations views the sidebar
- **THEN** no organization selector is rendered

#### Scenario: The selector survives the collapsed sidebar

- **WHEN** a platform admin collapses the sidebar to icons
- **THEN** the selector is still reachable as an icon with a tooltip naming the active organization

### Requirement: Platform sections are reachable on every surface

The navigation entries "Organizaciones" and "Usuarios" MUST be declared once, alongside the other navigation entries, and MUST be shown only to platform admins: in the desktop sidebar and in the mobile "Más" panel, never in a bottom-bar slot. They MUST be present whether or not an organization is active.

#### Scenario: Desktop sidebar carries the platform entries

- **WHEN** a platform admin views the desktop sidebar, with or without an active organization
- **THEN** it offers "Organizaciones" and "Usuarios"

#### Scenario: Mobile carries them in "Más"

- **WHEN** a platform admin opens the "Más" panel on a mobile viewport
- **THEN** it offers "Organizaciones" and "Usuarios", and the bottom bar still carries exactly its four slots

#### Scenario: Nobody else sees them

- **WHEN** an owner or an assistant who is not platform admin views the sidebar or the "Más" panel
- **THEN** neither "Organizaciones" nor "Usuarios" is offered

### Requirement: A platform admin without an active organization gets the platform shell

A platform admin with no active organization MUST see a reduced shell: the sidebar with the platform entries and the organization selector, and the account menu — without the business line selector, the notifications bell or the register button, which require an organization. Opening any organization-scoped route in that state MUST redirect to `/admin/organizations`. A platform admin MUST never be shown the "sin organización" notice, and MUST never be sent to the organization selection screen for users with several organizations.

#### Scenario: Organization-scoped routes need an organization

- **WHEN** a platform admin with no active organization opens `/orders`
- **THEN** they are redirected to `/admin/organizations`

#### Scenario: The platform shell omits organization controls

- **WHEN** a platform admin with no active organization opens `/admin/users` on desktop
- **THEN** the sidebar shows "Organizaciones", "Usuarios" and the selector, the account menu is present, and neither the business line selector nor the bell nor the register button is rendered

### Requirement: A platform admin's profile reflects platform access

The profile screen of a platform admin MUST show their email and state "Administrador de la plataforma" as their access. When they have an active organization in which they hold no membership, it MUST show that organization's name and MUST NOT offer the display name edit, since there is no membership to rename; the password change MUST remain available. When they hold a membership in the active organization, the display name edit MUST behave as for any member.

#### Scenario: Profile inside a foreign organization

- **WHEN** a platform admin inside organization B, where they hold no membership, opens `/profile`
- **THEN** it shows their email, B's name and "Administrador de la plataforma", offers "Cambiar contraseña" and offers no display name edit

#### Scenario: Profile without an active organization

- **WHEN** a platform admin with no active organization opens `/profile`
- **THEN** it shows their email and "Administrador de la plataforma", with no organization name

### Requirement: Platform views fit a phone

At a viewport width of 390 px, the Organizations view, the Users view and both detail screens MUST let the platform admin complete their primary action without horizontal scrolling of the page.

#### Scenario: Platform views at 390 px

- **WHEN** `/admin/organizations`, `/admin/users` and a detail screen of each are opened at 390 px
- **THEN** none of them requires horizontal page scrolling to reach and use its primary action
