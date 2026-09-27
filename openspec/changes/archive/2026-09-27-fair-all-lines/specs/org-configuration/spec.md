## ADDED Requirements

### Requirement: Fair mode can show every line, off by default

The General section MUST let the owner turn the setting «Venta rápida con todas las líneas» on or off for the organization, with **off** as the default for every organization. The section MUST explain, next to the toggle, that with the setting on each product sold in fair mode is recorded in its own line and shared products in the line chosen when opening the fair. The setting MUST persist to the organization's `settings`, MUST be readable by every member and MUST be writable only by the owner. Changing it MUST NOT alter any sale already recorded.

#### Scenario: Owner turns it on

- **WHEN** an owner turns the «Venta rápida con todas las líneas» toggle on in the General section and saves
- **THEN** the setting is stored as on in the organization's `settings`, and the next time fair mode is opened its grid shows the products of every active line

#### Scenario: Off by default

- **GIVEN** an organization that never changed this setting
- **WHEN** its settings are read
- **THEN** the setting reads as off and fair mode shows only the products of the fair's line and shared products

#### Scenario: The explanation is shown with the toggle

- **WHEN** an owner opens the General section
- **THEN** the toggle is accompanied by the explanation of which line each sale is recorded in

#### Scenario: Other settings are preserved

- **WHEN** an owner changes this toggle
- **THEN** the other values of the organization's `settings` (allocation rule, retention, writing assist) stay unchanged

#### Scenario: Changes are logged

- **WHEN** an owner saves a change to this toggle
- **THEN** an `activity_log` event with action `updated` records the modified field with its previous and new values

#### Scenario: The assistant cannot change the toggle

- **WHEN** an assistant attempts to write this setting
- **THEN** the write is rejected and the stored setting stays unchanged
