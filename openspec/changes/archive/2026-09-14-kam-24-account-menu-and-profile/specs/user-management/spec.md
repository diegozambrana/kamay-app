## ADDED Requirements

### Requirement: A member edits their own display name

Any signed-in member MUST be able to change their own `display_name` within their active organization, from the profile screen. This is narrower than the owner's ability to edit any membership: a member editing their own row MUST NOT be able to change their `role` or `archived_at`, and MUST NOT be able to change any other member's `display_name`. The change MUST take effect immediately for that membership and MUST be recorded in the activity log like any other change to `memberships`.

#### Scenario: A member renames themselves

- **WHEN** a signed-in assistant sets a new display name from the profile screen
- **THEN** their own membership's `display_name` is updated in the active organization

#### Scenario: A member cannot change their own role this way

- **WHEN** a signed-in member attempts to set their own `role` or `archived_at` through the self-service name change
- **THEN** the operation only ever affects `display_name` and neither `role` nor `archived_at` changes

#### Scenario: A member cannot rename someone else

- **WHEN** a signed-in member attempts to change another member's `display_name`
- **THEN** the operation is rejected and the other member's `display_name` stays unchanged

#### Scenario: The change does not cross organizations

- **WHEN** a member belonging to organizations A and B renames themselves while organization A is active
- **THEN** only the membership of organization A is updated, and the membership of organization B keeps its previous name

#### Scenario: Renaming oneself is logged

- **WHEN** a member changes their own display name
- **THEN** an `activity_log` event records the change with the previous and the new name and the acting user as author
