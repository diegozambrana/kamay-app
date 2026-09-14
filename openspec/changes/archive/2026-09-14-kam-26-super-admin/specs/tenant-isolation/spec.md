## MODIFIED Requirements

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
