## MODIFIED Requirements

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
