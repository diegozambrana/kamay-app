## MODIFIED Requirements

### Requirement: The settings screen is a full page reserved to the owner

The route `/settings` MUST render the configuration page (V15) with the sections General, Business lines, Channels, Categories, Units, Statuses, Users and roles, Notification preferences, and Retention. A user with role `assistant` MUST be redirected away when opening `/settings` by direct address, and the entry MUST NOT appear in their menu.

The Retention section MUST be reserved to the owner by its own guard, not by the page's: it MUST resolve an owner context for itself and send anyone else away, exactly as every other owner-only section does.

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
