# org-configuration Specification

## Purpose

Permite que una organización defina sin programar sus propias líneas de negocio, canales de venta, categorías de gasto y unidades de medida, y que solo el dueño pueda hacerlo — con archivado que nunca rompe la historia ya registrada.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-04; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §6, §16, §18; `specs/PRD/kamay-mapa-navegacion-ui.md` — V15.

## Requirements

### Requirement: Configuration tables exist with the canonical shape

The database MUST contain the five configuration tables of the canonical schema §6 and §7, each with `organization_id` (not null, referencing `organizations`) and `archived_at`:

- `business_lines`: `name`, `color` (default `zinc`), `icon`, `is_shared` (default false), `position`, `created_at`, `updated_at`, unique `(organization_id, name)`.
- `sales_channels`: `name`, `position`, unique `(organization_id, name)`.
- `expense_categories`: `name`, unique `(organization_id, name)`.
- `units`: `code`, `name`, unique `(organization_id, code)`.
- `item_categories`: `kind` (restricted to `supply`, `product` or `asset`), `name`, `created_at`, `updated_at`, unique per `(organization_id, kind)` on the name compared without case or surrounding spaces, and unique `(id, organization_id, kind)` so items can reference it together with their organization and kind.

Each table MUST carry the `audit` trigger from its creation migration, per the activity-log attachment procedure.

#### Scenario: Duplicate name in the same organization is rejected

- **WHEN** a second `business_lines` row is inserted with a name that already exists in the same organization
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: The same name is allowed in a different organization

- **WHEN** two organizations each create a business line named `Sublimación`
- **THEN** both inserts succeed

#### Scenario: Creating a configuration row is logged

- **WHEN** an owner creates a business line, a sales channel, an expense category, a unit or an item category
- **THEN** an `activity_log` event with action `created` exists for that record, with the acting user as author

#### Scenario: An item category outside the allowed kinds is rejected

- **WHEN** an `item_categories` row is inserted with a `kind` other than `supply`, `product` or `asset`
- **THEN** the database rejects the insert

#### Scenario: An item category name differing only in case is rejected

- **WHEN** an `item_categories` row named `sustratos` is inserted for the same organization and kind as an existing `Sustratos`
- **THEN** the database rejects the insert with a unique constraint violation

### Requirement: Only the owner writes configuration; every member reads it

RLS MUST be enabled on the five configuration tables. `SELECT` MUST be granted to any active member of the organization (`is_member`). `INSERT` and `UPDATE` MUST be restricted to `is_owner`. No `DELETE` policy MUST exist on any of them.

#### Scenario: Assistant reads configuration

- **WHEN** a user with role `assistant` queries `business_lines`, `sales_channels`, `expense_categories`, `units` or `item_categories` of their organization
- **THEN** the active rows of their organization are returned

#### Scenario: Assistant cannot write configuration

- **WHEN** a user with role `assistant` attempts to insert or update a row in any of the five configuration tables
- **THEN** the database rejects the operation under RLS

#### Scenario: Configuration of another organization is invisible

- **WHEN** an owner of organization A queries any of the five configuration tables
- **THEN** zero rows of organization B are returned

#### Scenario: No one can delete configuration

- **WHEN** any authenticated user attempts a `DELETE` on any of the five configuration tables
- **THEN** the database rejects the operation

### Requirement: Item categories are defined per item kind

The organization MUST be able to define its own item categories, each belonging to exactly one item kind: `supply`, `product` or `asset`. The same name MAY exist once per kind (for example «Embalaje» as a supply category and as a product category). The kind of a category MUST be fixed when it is created and MUST NOT change afterwards. Names MUST be stored without leading or trailing spaces and MUST NOT be empty.

The Item categories section of `/settings` MUST offer tabs for Insumos, Productos and Activos, like the catalog. The section MUST list and create categories of the selected tab only, and the selected tab MUST travel in the address. Archiving a category MUST stop it from being offered in item forms and catalog filters while every item that already uses it keeps it and keeps showing its name.

#### Scenario: The same name in two kinds

- **WHEN** an owner creates «Embalaje» in the Insumos tab and again in the Productos tab
- **THEN** both categories are created, one of each kind

#### Scenario: Duplicate name in the same kind ignores case and spaces

- **WHEN** an owner creates the supply category «sustratos » while «Sustratos» already exists as a supply category of the organization
- **THEN** the creation is rejected with an understandable message inside the dialog, and no second category is created

#### Scenario: A category is created in the selected tab

- **WHEN** an owner opens the Activos tab of the Item categories section, creates «Maquinaria» and returns to the Insumos tab
- **THEN** «Maquinaria» is listed in the Activos tab and not in the Insumos tab

#### Scenario: The kind of a category cannot change

- **WHEN** an update tries to change the kind of an item category
- **THEN** the category keeps its original kind

#### Scenario: Archiving a category keeps it on its items

- **WHEN** an owner archives the supply category «Embalaje», which two supplies use
- **THEN** both supplies keep «Embalaje» and show its name, and the category is no longer offered in item forms or in the catalog filter

### Requirement: Exactly one shared business line exists and cannot be archived

Each organization MUST have exactly one `business_lines` row with `is_shared = true` (General/Compartido). The database MUST reject a second shared line in the same organization, and MUST reject setting `archived_at` on the shared line.

#### Scenario: A second shared line is rejected

- **WHEN** an owner inserts a second `business_lines` row with `is_shared = true` in an organization that already has one
- **THEN** the database rejects the insert

#### Scenario: The shared line cannot be archived

- **WHEN** an owner attempts to set `archived_at` on the row with `is_shared = true`
- **THEN** the database rejects the update and the row remains active

#### Scenario: The shared line is not offered for archiving in the interface

- **WHEN** an owner opens the "⋯" actions menu of the shared line in the Business lines section of `/settings`
- **THEN** the menu offers «Editar» and does not offer «Archivar»

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

The route `/settings` MUST render the configuration page (V15) with the sections General, Business lines, Channels, Expense categories, Item categories, Units, Statuses, Users and roles, Notification preferences, and Retention. The expense categories section MUST be labelled «Categorías de gasto» in the menu and on its page, and the item categories section «Categorías de ítem», so neither is mistaken for the other. A user with role `assistant` MUST be redirected away when opening `/settings` by direct address, and the entry MUST NOT appear in their menu.

The Retention section MUST be reserved to the owner by its own guard, not by the page's: it MUST resolve an owner context for itself and send anyone else away, exactly as every other owner-only section does. The Item categories section MUST guard itself the same way.

#### Scenario: Owner opens settings

- **WHEN** a signed-in owner navigates to `/settings`
- **THEN** the configuration page renders with the Retention section among its sections

#### Scenario: Assistant is redirected from settings

- **WHEN** a signed-in assistant opens `/settings` by direct address
- **THEN** they are redirected away from the page and do not see its content

#### Scenario: Settings is absent from the assistant menu

- **WHEN** a signed-in assistant views the application shell
- **THEN** no navigation entry points to `/settings`

#### Scenario: The Retention section states what expiry does

- **WHEN** an owner opens the Retention section
- **THEN** it shows the organization's retention period and explains that once it elapses the detail of each change is released while the event itself is kept

#### Scenario: The Retention section guards itself

- **WHEN** an assistant opens the Retention section by direct address
- **THEN** they are sent away and the section's content is never rendered

#### Scenario: The two kinds of categories are named apart

- **WHEN** an owner opens the settings menu
- **THEN** it offers «Categorías de gasto» and «Categorías de ítem» as two separate entries, and no entry is labelled just «Categorías»

#### Scenario: The Item categories section guards itself

- **WHEN** an assistant opens `/settings/item-categories` by direct address
- **THEN** they are sent away and the section's content is never rendered

### Requirement: A new business line is usable immediately

When an owner creates a business line, it MUST become available in the global line selector — with the color that was assigned — without the user reloading the application or signing in again.

#### Scenario: New line appears in the selector with its color

- **WHEN** an owner creates a business line with a given name and color in `/settings`
- **THEN** the global line selector offers that line with that color right away

### Requirement: General settings of the organization are editable

The General section MUST let the owner edit the organization's `name`, `currency`, `timezone` and `logo_path`, and MUST persist those values to the `organizations` row.

The General section MUST also let the owner choose the **shared expense allocation rule** — proportional to revenue, equal shares, or manual — and, for the manual rule, declare a percentage per non-shared business line. The rule and its percentages MUST persist to the organization's `settings`, MUST NOT be stored on any business line row, and MUST be readable by every member while remaining writable only by the owner.

Saving a manual rule whose percentages do not add up to exactly 100 MUST fail with a message stating the current sum, and MUST leave the previously stored rule unchanged. When a non-shared business line has no declared percentage under the manual rule, the section MUST warn that the line is missing its share.

#### Scenario: Owner renames the organization

- **WHEN** an owner changes the organization name in the General section and saves
- **THEN** the new name is stored and the shell shows it

#### Scenario: General changes are logged

- **WHEN** an owner saves a change in the General section
- **THEN** an `activity_log` event with action `updated` records the modified fields with their previous and new values

#### Scenario: Owner switches the allocation rule

- **WHEN** an owner selects the equal-shares rule in the General section and saves
- **THEN** the rule is stored in the organization's `settings` and every report that allocates shared expenses uses it on its next read

#### Scenario: Manual percentages must add up

- **WHEN** an owner saves manual percentages of 50, 30 and 10
- **THEN** the save fails with a message stating that they add up to 90, and the previously stored rule stays in effect

#### Scenario: A line without a declared percentage

- **WHEN** the manual rule is in effect and a fourth business line is created
- **THEN** the General section warns that the new line has no percentage assigned

#### Scenario: The assistant cannot change the rule

- **WHEN** an assistant attempts to write the allocation rule
- **THEN** the write is rejected and the stored rule stays unchanged

### Requirement: Geeko Store is seeded with its real lines and channels

After `supabase db reset`, the database MUST contain the organization Geeko Store with exactly four business lines — Sublimación (`blue`), Impresión 3D (`violet`), Alfarería (`orange`) and General (`zinc`, `is_shared = true`) — and the four sales channels Feria, Redes, Pedido directo and Mostrador. Seeding MUST NOT remove the existing test organizations.

#### Scenario: Reset leaves Geeko Store ready

- **WHEN** `supabase db reset` completes
- **THEN** Geeko Store exists with its four business lines and their colors, and with its four sales channels

#### Scenario: Existing test organizations survive the seed

- **WHEN** `supabase db reset` completes
- **THEN** the organizations used by the authentication tests still exist with their memberships
