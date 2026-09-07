## ADDED Requirements

### Requirement: Recent activity is read through one bounded, owner-only query

The system MUST offer one way to read the most recent activity of a whole organization: a bounded query that takes a maximum number of events, orders them from newest to oldest, and optionally restricts them to one business line. Every screen showing organization-wide recent activity MUST read through it — record-scoped history keeps reading the same log for its own record — so no second organization-wide reading path can drift from the log's rules.

The query MUST NOT relax the log's access rules: it MUST return only events of the caller's organization, and an assistant MUST obtain zero rows. The caller MUST NOT be able to request an unbounded number of events.

#### Scenario: Newest first, capped

- **WHEN** an owner requests the 5 most recent events of an organization that has 20
- **THEN** exactly 5 events are returned, ordered from newest to oldest

#### Scenario: Restricted to one business line

- **WHEN** an owner requests recent events restricted to one business line
- **THEN** only events of that line are returned

#### Scenario: Assistant still reads nothing

- **WHEN** an assistant requests recent events of their organization
- **THEN** zero rows are returned

#### Scenario: Another organization's events never appear

- **WHEN** an owner of one organization requests recent events
- **THEN** no event of any other organization is returned

### Requirement: An event can be rendered as a natural-language sentence

The system MUST be able to turn any stored event into a sentence a shop owner can read — who did it, what happened and to which record — without exposing table names, column names or raw change payloads. An event whose actor is not a person MUST be attributed to its recorded label rather than left blank, and an action the renderer does not recognise MUST still produce a readable sentence instead of failing or printing an identifier.

#### Scenario: A status change reads as a sentence

- **WHEN** a `status_changed` event on an order is rendered
- **THEN** the result names the person, the action and the order, with no table or column name in the text

#### Scenario: A system actor is named

- **WHEN** an event has no user actor but carries an actor label
- **THEN** the sentence attributes the action to that label

#### Scenario: An unknown action degrades gracefully

- **WHEN** an event carries an action the renderer has no specific wording for
- **THEN** a readable generic sentence is produced and no identifier leaks into the text
