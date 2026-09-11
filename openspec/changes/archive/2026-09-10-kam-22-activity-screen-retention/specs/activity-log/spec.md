## MODIFIED Requirements

### Requirement: Recent activity is read through one bounded, owner-only query

The system MUST offer one way to read the activity of a whole organization: a bounded query that takes a maximum number of events, orders them from newest to oldest, and optionally narrows them. Every screen showing organization-wide activity MUST read through it — record-scoped history keeps reading the same log for its own record — so no second organization-wide reading path can drift from the log's rules.

The query MUST support narrowing by business line, by date range, by actor, by audited table, by action, and by a single record, and MUST support continuing from a cursor so a caller can walk a large result page by page without re-reading what it already read. The ordering MUST be total and stable across calls, so that paging never repeats or skips an event.

The query MUST NOT relax the log's access rules: it MUST return only events of the caller's organization, and an assistant MUST obtain zero rows. The caller MUST NOT be able to request an unbounded number of events, with or without a cursor.

#### Scenario: Newest first, capped

- **WHEN** an owner requests the 5 most recent events of an organization that has 20
- **THEN** exactly 5 events are returned, ordered from newest to oldest

#### Scenario: Restricted to one business line

- **WHEN** an owner requests recent events restricted to one business line
- **THEN** only events of that line are returned

#### Scenario: Narrowed by actor, action and date range

- **WHEN** an owner requests events narrowed by actor, by action and by a date range
- **THEN** only events satisfying all three conditions are returned

#### Scenario: Narrowed to one record

- **WHEN** an owner requests the events of one record of one audited table
- **THEN** only that record's events are returned, newest first

#### Scenario: A cursor continues exactly where the page ended

- **WHEN** an owner requests a page and then requests the next one from the returned cursor
- **THEN** the second page continues immediately after the first, with no event repeated and none skipped

#### Scenario: The cap cannot be lifted by paging

- **WHEN** a caller requests a page larger than the system's cap, with or without a cursor
- **THEN** at most the capped number of events is returned

#### Scenario: Assistant still reads nothing

- **WHEN** an assistant requests recent events of their organization
- **THEN** zero rows are returned

#### Scenario: Another organization's events never appear

- **WHEN** an owner of one organization requests recent events
- **THEN** no event of any other organization is returned

### Requirement: The activity log is immutable and owner-readable only

RLS MUST be enabled on `activity_log`. Reading MUST be allowed only to organization owners (`is_owner(organization_id)`); assistants and non-members MUST obtain zero rows. `INSERT`, `UPDATE` and `DELETE` privileges MUST be revoked from `authenticated` and `anon`; rows enter only through the `security definer` trigger function.

The single exception to immutability is the retention routine, which runs with system privilege and is never reachable from a user session: it MAY clear the `changes` payload of events older than the organization's retention period, and nothing else. No routine, privileged or not, may delete a row of `activity_log` or alter any other column of an existing event. Who did what, to which record, and when is permanent.

#### Scenario: Owner cannot alter the log

- **WHEN** an organization owner attempts an `UPDATE` or `DELETE` on `activity_log`
- **THEN** the operation fails with a privilege error

#### Scenario: Assistant reads zero rows

- **WHEN** a user with an active `assistant` membership selects from `activity_log`
- **THEN** zero rows are returned even though events exist for their organization

#### Scenario: Direct insert by a user is rejected

- **WHEN** an authenticated user attempts a direct `INSERT` into `activity_log`
- **THEN** the operation fails with a privilege error

#### Scenario: Retention may only empty the payload

- **WHEN** the retention routine runs over events older than the retention period
- **THEN** only their `changes` payload becomes empty, every other column keeps its value, and no row is removed

#### Scenario: No row ever disappears

- **WHEN** any routine of the system finishes running against `activity_log`
- **THEN** the number of events of an organization is never lower than before it ran

### Requirement: An event can be rendered as a natural-language sentence

The system MUST be able to turn any stored event into a sentence a shop owner can read — who did it, what happened and to which record — without exposing table names, column names or raw change payloads. An event whose actor is not a person MUST be attributed to its recorded label rather than left blank, and an action the renderer does not recognise MUST still produce a readable sentence instead of failing or printing an identifier.

The same rule MUST hold for the detail of an event, not only for its headline: the system MUST be able to render an event's recorded changes as a field-by-field before-and-after that names each field in the product's visible language, presents referenced records by their name rather than by their identifier, and shows an absent value as an explicit blank. A field the renderer has no name for MUST still be presented readably, and MUST NOT leak the raw column name. An event whose payload was emptied by retention MUST render as a stated absence of detail, not as an empty table or an error.

#### Scenario: A status change reads as a sentence

- **WHEN** a `status_changed` event on an order is rendered
- **THEN** the result names the person, the action and the order, with no table or column name in the text

#### Scenario: A system actor is named

- **WHEN** an event has no user actor but carries an actor label
- **THEN** the sentence attributes the action to that label

#### Scenario: An unknown action degrades gracefully

- **WHEN** an event carries an action the renderer has no specific wording for
- **THEN** a readable generic sentence is produced and no identifier leaks into the text

#### Scenario: The detail names its fields in the product's language

- **WHEN** an event's recorded changes are rendered as a before-and-after
- **THEN** every field is named in the product's visible language and no database column name appears

#### Scenario: A referenced record reads by its name

- **WHEN** a change whose value is a reference to another record is rendered
- **THEN** the before and after show that record's name, not its identifier

#### Scenario: An unknown field still renders

- **WHEN** a change carries a field the renderer has no name for
- **THEN** the field is presented readably and its raw column name is not shown

#### Scenario: An emptied payload states its absence

- **WHEN** the detail of an event whose payload was cleared by retention is rendered
- **THEN** the result states that the detail is no longer available and the headline still reads normally
