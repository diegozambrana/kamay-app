# activity-log Specification

## Purpose

Garantiza que ningún cambio del sistema ocurra sin quedar registrado en un historial único e inmutable (`activity_log`), instalado antes de que exista una sola fila de datos reales — con detección automática de acción, diff de solo los campos modificados, fusión de ruido y lectura restringida al dueño.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-03; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §14, §16; `specs/PRD/ARCHITECTURE.md` (convención 7: un solo historial).

## Requirements

### Requirement: Activity log table stores every audited event

The database MUST contain the table `activity_log` as defined in the canonical schema: identity `bigint` primary key, `organization_id` (not null, references `organizations`), optional `business_line_id`, optional `actor_id` (references `auth.users`) and `actor_label`, `table_name` and `record_id` (both not null), `action` constrained to `created | updated | status_changed | archived | unarchived`, `changes` jsonb, `origin`, and `occurred_at` defaulting to `now()`. The four canonical indexes MUST exist: `(organization_id, occurred_at desc)`, `(table_name, record_id, occurred_at desc)`, `(organization_id, business_line_id, occurred_at desc)`, and a GIN index on `changes`.

#### Scenario: Invalid action is rejected

- **WHEN** a row is inserted into `activity_log` with an `action` outside the allowed set
- **THEN** the database rejects the insert with a check constraint violation

### Requirement: Every INSERT on an audited table produces a created event

For any table carrying the `audit` trigger, an `INSERT` MUST produce exactly one `activity_log` event with action `created`, the acting user as `actor_id`, the record's organization, the audited table's name, the record's id, and the full new row content in `changes`.

#### Scenario: Insert is logged with author, organization and content

- **WHEN** an authenticated user inserts a row into an audited table
- **THEN** exactly one `activity_log` event exists for that record with action `created`, `actor_id` equal to the user, `organization_id` equal to the record's organization, and `changes` containing the inserted content

### Requirement: Updates record only the fields that changed

For an `UPDATE` on an audited table, the logged event MUST contain in `changes` **only** the fields whose value actually changed, each with its previous and new value. The fields `created_at` and `updated_at` MUST always be excluded from the diff.

#### Scenario: Single-field update stores only that field

- **WHEN** an `UPDATE` changes exactly one auditable field of a record
- **THEN** the event's `changes` contains exactly that one field, with its previous value and its new value, and no other keys

#### Scenario: Touching only updated_at produces no event

- **WHEN** an `UPDATE` modifies only the `updated_at` column
- **THEN** no `activity_log` event is created

### Requirement: Action kind is derived from the nature of the change

The trigger MUST classify each `UPDATE`: setting `archived_at` from null to a value logs `archived`; clearing `archived_at` back to null logs `unarchived`; a change of `status_id` logs `status_changed`; any other effective change logs `updated`. Archival MUST NOT be reported as a generic update.

#### Scenario: Archiving is logged as archived, not updated

- **WHEN** a record in an audited table has `archived_at` set from null to a timestamp
- **THEN** the resulting event's action is `archived`

#### Scenario: Unarchiving is logged as unarchived

- **WHEN** a record's `archived_at` is cleared back to null
- **THEN** the resulting event's action is `unarchived`

### Requirement: Successive edits by the same author are merged

Two or more `updated` events for the same actor, same table and same record occurring within 5 minutes MUST be consolidated into a single event whose `changes` contains the merged diff. Events with action `created`, `archived`, `unarchived` or `status_changed` MUST never be merged.

#### Scenario: Two edits within five minutes produce one event

- **WHEN** the same user performs two `UPDATE`s on the same record 2 minutes apart, each changing a different field
- **THEN** exactly one `updated` event exists for that record containing both fields' changes

#### Scenario: Edits by different users are not merged

- **WHEN** two different users each update the same record within 5 minutes
- **THEN** two separate `updated` events exist, one per actor

### Requirement: The activity log is immutable and owner-readable only

RLS MUST be enabled on `activity_log`. Reading MUST be allowed only to organization owners (`is_owner(organization_id)`); assistants and non-members MUST obtain zero rows. `INSERT`, `UPDATE` and `DELETE` privileges MUST be revoked from `authenticated` and `anon`; rows enter only through the `security definer` trigger function.

#### Scenario: Owner cannot alter the log

- **WHEN** an organization owner attempts an `UPDATE` or `DELETE` on `activity_log`
- **THEN** the operation fails with a privilege error

#### Scenario: Assistant reads zero rows

- **WHEN** a user with an active `assistant` membership selects from `activity_log`
- **THEN** zero rows are returned even though events exist for their organization

#### Scenario: Direct insert by a user is rejected

- **WHEN** an authenticated user attempts a direct `INSERT` into `activity_log`
- **THEN** the operation fails with a privilege error

### Requirement: Existing tables are audited and future tables must opt in at creation

The `audit` trigger MUST be attached to `organizations` and `memberships`. The project MUST document the procedure by which every future auditable table attaches the trigger in the same migration that creates the table, so no production row can ever precede its audit coverage.

#### Scenario: Changes to organizations are logged

- **WHEN** an audited operation (insert or update) occurs on `organizations` or `memberships`
- **THEN** a corresponding `activity_log` event exists for that record

#### Scenario: The attachment procedure is documented

- **WHEN** a developer creates a new auditable table following the project documentation
- **THEN** the documented procedure instructs attaching the `audit` trigger in the table's own creation migration
