# tenant-isolation Specification

## Purpose

Garantiza que todo dato de Kamay pertenece a una organización y que un usuario solo puede ver y modificar datos de organizaciones a las que pertenece activamente, con el archivado como única forma de eliminación — verificado por pruebas pgTAP, no por convención.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-02, criterios de aceptación 4–5; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §5, §16; `specs/PRD/ARCHITECTURE.md` §Base de datos.

## Requirements

### Requirement: Organizations and memberships model the tenant

The database MUST contain the tables `organizations` and `memberships` as defined in the canonical schema: a membership links one user to one organization with role `owner` or `assistant`, the pair (organization, user) MUST be unique, and both tables MUST carry `archived_at` instead of supporting deletion.

#### Scenario: Membership roles are constrained

- **WHEN** a row is inserted into `memberships` with a role other than `owner` or `assistant`
- **THEN** the database rejects the insert with a check constraint violation

#### Scenario: A user cannot be member of the same organization twice

- **WHEN** a second membership is inserted for the same `(organization_id, user_id)` pair
- **THEN** the database rejects the insert with a uniqueness violation

### Requirement: Membership helper functions decide all access

The functions `is_member(org uuid)` and `is_owner(org uuid)` MUST exist, MUST evaluate against the authenticated user (`auth.uid()`), and MUST return true only for **active** memberships (`archived_at IS NULL`). `is_owner` MUST additionally require the role `owner`.

#### Scenario: Active member is recognized

- **WHEN** a user with an active membership in organization A calls `is_member(A)`
- **THEN** the function returns true

#### Scenario: Archived membership grants nothing

- **WHEN** a user whose membership in organization A has `archived_at` set calls `is_member(A)` or `is_owner(A)`
- **THEN** both functions return false

#### Scenario: Assistant is not owner

- **WHEN** a user with an active `assistant` membership in organization A calls `is_owner(A)`
- **THEN** the function returns false

### Requirement: Row Level Security isolates organizations completely

RLS MUST be enabled on `organizations` and `memberships` (and on every future table, per project convention). A user authenticated as member of organization A MUST obtain **zero rows** belonging to organization B from any query on any existing table, without the application adding filters.

#### Scenario: Cross-organization reads return zero rows

- **WHEN** a user who is member only of organization A selects from `organizations` and `memberships` while organization B and its memberships exist
- **THEN** every returned row belongs to organization A and zero rows of organization B are returned

#### Scenario: Cross-organization writes are rejected

- **WHEN** a user who is member only of organization A attempts to insert or update a row tied to organization B
- **THEN** the database rejects the operation under RLS

### Requirement: No authenticated user can delete anything

No table SHALL have a `DELETE` policy for the `authenticated` role. Any `DELETE` issued by an authenticated user against any existing table MUST affect zero rows; records are only ever archived via `archived_at`.

#### Scenario: DELETE affects zero rows

- **WHEN** an authenticated user — including an organization owner — executes `DELETE` against `organizations` or `memberships`
- **THEN** zero rows are deleted

### Requirement: Write access to tenant tables is owner-only

Per the access matrix of the canonical schema, any active member MAY read their organization's rows in `organizations` and `memberships`, but INSERT and UPDATE on both tables MUST be restricted to users for whom `is_owner(organization_id)` is true.

#### Scenario: Assistant cannot modify the organization

- **WHEN** a user with role `assistant` attempts to update their organization's row or insert a new membership in it
- **THEN** the database rejects the operation under RLS

#### Scenario: Owner can manage memberships

- **WHEN** a user with role `owner` inserts a membership for their own organization
- **THEN** the insert succeeds
