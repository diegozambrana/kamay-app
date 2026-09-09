## MODIFIED Requirements

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
