## Purpose

Permite que una organización defina sin programar sus propias líneas de negocio, canales de venta, categorías de gasto y unidades de medida, y que solo el dueño pueda hacerlo — con archivado que nunca rompe la historia ya registrada.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-04; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §6, §16, §18; `specs/PRD/kamay-mapa-navegacion-ui.md` — V15.

## ADDED Requirements

### Requirement: Configuration tables exist with the canonical shape

The database MUST contain the four configuration tables of the canonical schema §6, each with `organization_id` (not null, referencing `organizations`) and `archived_at`:

- `business_lines`: `name`, `color` (default `zinc`), `icon`, `is_shared` (default false), `position`, `created_at`, `updated_at`, unique `(organization_id, name)`.
- `sales_channels`: `name`, `position`, unique `(organization_id, name)`.
- `expense_categories`: `name`, unique `(organization_id, name)`.
- `units`: `code`, `name`, unique `(organization_id, code)`.

Each table MUST carry the `audit` trigger from its creation migration, per the activity-log attachment procedure.

#### Scenario: Duplicate name in the same organization is rejected

- **WHEN** a second `business_lines` row is inserted with a name that already exists in the same organization
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: The same name is allowed in a different organization

- **WHEN** two organizations each create a business line named `Sublimación`
- **THEN** both inserts succeed

#### Scenario: Creating a configuration row is logged

- **WHEN** an owner creates a business line, a sales channel, an expense category or a unit
- **THEN** an `activity_log` event with action `created` exists for that record, with the acting user as author

### Requirement: Only the owner writes configuration; every member reads it

RLS MUST be enabled on the four configuration tables. `SELECT` MUST be granted to any active member of the organization (`is_member`). `INSERT` and `UPDATE` MUST be restricted to `is_owner`. No `DELETE` policy MUST exist on any of them.

#### Scenario: Assistant reads configuration

- **WHEN** a user with role `assistant` queries `business_lines`, `sales_channels`, `expense_categories` or `units` of their organization
- **THEN** the active rows of their organization are returned

#### Scenario: Assistant cannot write configuration

- **WHEN** a user with role `assistant` attempts to insert or update a row in any of the four configuration tables
- **THEN** the database rejects the operation under RLS

#### Scenario: Configuration of another organization is invisible

- **WHEN** an owner of organization A queries any of the four configuration tables
- **THEN** zero rows of organization B are returned

#### Scenario: No one can delete configuration

- **WHEN** any authenticated user attempts a `DELETE` on any of the four configuration tables
- **THEN** the database rejects the operation

### Requirement: Exactly one shared business line exists and cannot be archived

Each organization MUST have exactly one `business_lines` row with `is_shared = true` (General/Compartido). The database MUST reject a second shared line in the same organization, and MUST reject setting `archived_at` on the shared line.

#### Scenario: A second shared line is rejected

- **WHEN** an owner inserts a second `business_lines` row with `is_shared = true` in an organization that already has one
- **THEN** the database rejects the insert

#### Scenario: The shared line cannot be archived

- **WHEN** an owner attempts to set `archived_at` on the row with `is_shared = true`
- **THEN** the database rejects the update and the row remains active

#### Scenario: The shared line is not offered for archiving in the interface

- **WHEN** an owner opens the Business lines section of `/settings`
- **THEN** the shared line is listed without an archive control

### Requirement: Archiving hides a line from new work without erasing its history

Setting `archived_at` on a configuration row MUST remove it from the global line selector and from the option lists of every creation form. Records already referencing an archived row MUST keep displaying that row's name and color unchanged.

#### Scenario: Archived line disappears from new forms

- **WHEN** an owner archives a business line
- **THEN** that line is no longer offered in the global line selector nor in the options of any creation form

#### Scenario: Historical records still show the archived line

- **WHEN** a record created while the line was active is displayed after the line was archived
- **THEN** the record still shows the line's name and color

#### Scenario: Archiving is logged as archived

- **WHEN** an owner archives a configuration row
- **THEN** the resulting `activity_log` event has action `archived`

### Requirement: The settings screen is a full page reserved to the owner

The route `/settings` MUST render the configuration page (V15) with the sections General, Business lines, Channels, Categories, Units, and Users and roles. A user with role `assistant` MUST be redirected away when opening `/settings` by direct address, and the entry MUST NOT appear in their menu.

#### Scenario: Owner opens settings

- **WHEN** a signed-in owner navigates to `/settings`
- **THEN** the configuration page renders with its six sections

#### Scenario: Assistant is redirected from settings

- **WHEN** a signed-in assistant opens `/settings` by direct address
- **THEN** they are redirected away from the page and do not see its content

#### Scenario: Settings is absent from the assistant menu

- **WHEN** a signed-in assistant views the application shell
- **THEN** no navigation entry points to `/settings`

### Requirement: A new business line is usable immediately

When an owner creates a business line, it MUST become available in the global line selector — with the color that was assigned — without the user reloading the application or signing in again.

#### Scenario: New line appears in the selector with its color

- **WHEN** an owner creates a business line with a given name and color in `/settings`
- **THEN** the global line selector offers that line with that color right away

### Requirement: General settings of the organization are editable

The General section MUST let the owner edit the organization's `name`, `currency`, `timezone` and `logo_path`, and MUST persist those values to the `organizations` row.

#### Scenario: Owner renames the organization

- **WHEN** an owner changes the organization name in the General section and saves
- **THEN** the new name is stored and the shell shows it

#### Scenario: General changes are logged

- **WHEN** an owner saves a change in the General section
- **THEN** an `activity_log` event with action `updated` records the modified fields with their previous and new values

### Requirement: Geeko Store is seeded with its real lines and channels

After `supabase db reset`, the database MUST contain the organization Geeko Store with exactly four business lines — Sublimación (`blue`), Impresión 3D (`violet`), Alfarería (`orange`) and General (`zinc`, `is_shared = true`) — and the four sales channels Feria, Redes, Pedido directo and Mostrador. Seeding MUST NOT remove the existing test organizations.

#### Scenario: Reset leaves Geeko Store ready

- **WHEN** `supabase db reset` completes
- **THEN** Geeko Store exists with its four business lines and their colors, and with its four sales channels

#### Scenario: Existing test organizations survive the seed

- **WHEN** `supabase db reset` completes
- **THEN** the organizations used by the authentication tests still exist with their memberships
