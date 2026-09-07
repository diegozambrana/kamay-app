## ADDED Requirements

### Requirement: The owner assigns business lines to a membership

The Users and roles section MUST let the owner declare which business lines a membership covers, and MUST let the owner clear that declaration. A membership with no line declared MUST be treated as covering every line of the organization, so that assigning lines is a restriction the owner states explicitly and never a permission that has to be granted before an assistant can work. The line assignment MUST be readable by the member it belongs to and writable only by the owner, and every change MUST be recorded in the activity log.

The assignment MUST be the single source of what "their line" means wherever the system restricts an assistant by business line.

#### Scenario: Owner restricts an assistant to one line

- **WHEN** an owner assigns the Alfarería line to an assistant's membership
- **THEN** that membership covers Alfarería only, and the change is recorded in the activity log

#### Scenario: A membership with no line covers every line

- **WHEN** an assistant's membership has no business line assigned
- **THEN** it covers every line of the organization

#### Scenario: Clearing the assignment restores full coverage

- **WHEN** an owner removes every line assigned to a membership
- **THEN** that membership covers every line again

#### Scenario: Only the owner assigns lines

- **WHEN** an assistant attempts to assign a business line to any membership, including their own
- **THEN** the operation is rejected and no assignment changes

#### Scenario: A member reads their own assignment

- **WHEN** an assistant reads the line assignment of their own membership
- **THEN** the assigned lines are returned

#### Scenario: Assignments do not cross organizations

- **WHEN** a member of organization A reads line assignments
- **THEN** no assignment of organization B is returned
