## ADDED Requirements

### Requirement: Writing assist is activated per organization, off by default

The General section MUST let the owner turn the writing-assist feature on or off for the organization, with **off** as the default for every organization. Turning it on MUST show an explicit notice that task body text will be sent to a third-party model provider. The setting MUST persist to the organization's `settings` and MUST be readable by every member while remaining writable only by the owner.

#### Scenario: Owner turns writing assist on

- **WHEN** an owner turns the writing-assist toggle on in the General section and saves
- **THEN** the setting is stored as on in the organization's `settings`, and the *Mejorar la descripción* action becomes available in that organization's task editor

#### Scenario: The notice appears before turning it on

- **WHEN** an owner opens the writing-assist toggle
- **THEN** the section shows an explicit notice that task body text will be sent to a third-party model provider

#### Scenario: Off by default

- **GIVEN** an organization that never changed this setting
- **WHEN** its settings are read
- **THEN** the writing-assist feature reads as off

#### Scenario: General changes are logged

- **WHEN** an owner saves a change to the writing-assist toggle in the General section
- **THEN** an `activity_log` event with action `updated` records the modified field with its previous and new values

#### Scenario: The assistant cannot change the toggle

- **WHEN** an assistant attempts to write the writing-assist toggle
- **THEN** the write is rejected and the stored setting stays unchanged
