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

The functions `is_member(org uuid)` and `is_owner(org uuid)` MUST exist and MUST evaluate against the authenticated user (`auth.uid()`). `is_member` MUST return true when the user has an **active** membership (`archived_at IS NULL`) in the organization, and `is_owner` MUST return true when that active membership has the role `owner`. Both MUST additionally return true when the user is an active platform admin, so that a platform admin is authorized as owner in every organization through the same functions every policy already uses.

A third function, `has_active_membership(org uuid)`, MUST return true only for an active membership of the authenticated user in the organization, whatever the platform admin status — it is the strict form wherever actual belonging matters (for example, deciding whether a change is marked as made by the platform admin).

#### Scenario: Active member is recognized

- **WHEN** a user with an active membership in organization A calls `is_member(A)`
- **THEN** the function returns true

#### Scenario: Archived membership grants nothing

- **WHEN** a user who is not platform admin and whose membership in organization A has `archived_at` set calls `is_member(A)` or `is_owner(A)`
- **THEN** both functions return false

#### Scenario: Assistant is not owner

- **WHEN** a user who is not platform admin, with an active `assistant` membership in organization A, calls `is_owner(A)`
- **THEN** the function returns false

#### Scenario: A platform admin is owner everywhere

- **WHEN** an active platform admin with no membership in organization B calls `is_member(B)` and `is_owner(B)`
- **THEN** both functions return true

#### Scenario: A revoked platform admin is back to their memberships

- **WHEN** a user whose platform admin row is archived, and who has no membership in organization B, calls `is_member(B)` or `is_owner(B)`
- **THEN** both functions return false

#### Scenario: Strict membership ignores platform admin

- **WHEN** an active platform admin with no membership in organization B calls `has_active_membership(B)`
- **THEN** the function returns false

### Requirement: Row Level Security isolates organizations completely

RLS MUST be enabled on `organizations` and `memberships` (and on every future table, per project convention). A user who is not an active platform admin, authenticated as member of organization A, MUST obtain **zero rows** belonging to organization B from any query on any existing table, without the application adding filters. The only accounts allowed to read across organizations are active platform admins, and only through the membership helper functions — never through a policy of their own nor a service-role client.

#### Scenario: Cross-organization reads return zero rows

- **WHEN** a user who is not platform admin and is member only of organization A selects from `organizations` and `memberships` while organization B and its memberships exist
- **THEN** every returned row belongs to organization A and zero rows of organization B are returned

#### Scenario: Cross-organization writes are rejected

- **WHEN** a user who is not platform admin and is member only of organization A attempts to insert or update a row tied to organization B
- **THEN** the database rejects the operation under RLS

#### Scenario: The existing isolation suite still passes unchanged

- **WHEN** the existing isolation and role tests run after platform admins are introduced, with at least one active platform admin present in the database
- **THEN** every one of them passes without being modified

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

### Requirement: Every view declares security_invoker

Toda vista de la base de datos MUST declarar `security_invoker = true`. El cumplimiento MUST verificarse de forma automática **sobre el catálogo del sistema**, no contra una lista de vistas escrita a mano, de modo que una vista nueva sin la opción rompa la integración continua el día que se escriba.

#### Scenario: No view lacks the option

- **WHEN** se ejecuta la verificación automática sobre el catálogo de vistas de la base de datos
- **THEN** toda vista declara `security_invoker = true` y la prueba pasa

#### Scenario: A new view without the option fails the build

- **WHEN** una migración crea una vista sin `security_invoker = true`
- **THEN** la verificación automática falla nombrando esa vista

#### Scenario: A view does not widen what its caller may read

- **WHEN** un usuario que pertenece solo a la organización A consulta cualquier vista derivada mientras existe la organización B con datos
- **THEN** obtiene cero filas de la organización B

### Requirement: The pre-production database checklist is verified point by point

Los doce puntos de la lista de verificación antes de producción del anexo de base de datos MUST estar comprobados uno por uno, y cada punto comprobable de forma automática MUST tener su prueba: toda tabla con `organization_id` y RLS activo; ninguna política `DELETE`; toda vista con `security_invoker`; `activity_log` con permisos revocados para `authenticated` y `anon`; disparadores de auditoría en **todas** las tablas auditables; ninguna columna con un valor derivable; importes en `numeric`; rutas de Storage que empiezan por `organization_id` y políticas que lo verifican; aislamiento entre organizaciones en toda tabla y toda vista; el ayudante sin acceso a egresos, activos ni último costo; una venta de feria reenviada dos veces produce una sola fila; e índices que cubren los filtros reales de la interfaz. El resultado de la verificación MUST quedar documentado punto por punto.

#### Scenario: Every table carries organization_id with RLS enabled

- **WHEN** se recorre automáticamente el catálogo de tablas de datos de la aplicación
- **THEN** toda tabla tiene `organization_id` y RLS activo, sin excepción

#### Scenario: Audit triggers cover every auditable table

- **WHEN** se recorre automáticamente el catálogo de tablas auditables
- **THEN** cada una tiene instalado el disparador de auditoría

#### Scenario: Amounts are never floating point

- **WHEN** se recorre automáticamente el catálogo de columnas que representan importes
- **THEN** ninguna usa un tipo de punto flotante

#### Scenario: Storage paths are scoped by organization

- **WHEN** se intenta leer un archivo de Storage cuya ruta pertenece a otra organización
- **THEN** la política lo rechaza

#### Scenario: The checklist result is documented

- **WHEN** se consulta la documentación del cambio
- **THEN** contiene los doce puntos del anexo con su resultado y, para los automatizables, la prueba que los verifica
