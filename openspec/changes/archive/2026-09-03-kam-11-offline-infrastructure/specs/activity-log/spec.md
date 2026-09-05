## MODIFIED Requirements

### Requirement: Every INSERT on an audited table produces a created event

For any table carrying the `audit` trigger, an `INSERT` MUST produce exactly one `activity_log` event with action `created`, the acting user as `actor_id`, the record's organization, the audited table's name, the record's id, and the full new row content in `changes`.

The event MUST be dated with the time of the real fact, not the time it reached the server. When the audited table carries an `occurred_at` column, the event's `occurred_at` MUST be the record's own `occurred_at`; otherwise it MUST default to the moment of the insert. Events for `updated`, `status_changed`, `archived` and `unarchived` MUST keep using the moment the change reached the database, since no column carries a client-set time for them.

#### Scenario: Insert is logged with author, organization and content

- **WHEN** an authenticated user inserts a row into an audited table
- **THEN** exactly one `activity_log` event exists for that record with action `created`, `actor_id` equal to the user, `organization_id` equal to the record's organization, and `changes` containing the inserted content

#### Scenario: A record created offline keeps its real time in the log

- **WHEN** a row whose `occurred_at` is 15:40 is inserted at 21:00 into an audited table that has that column
- **THEN** its `created` event in `activity_log` is dated 15:40, while the row's `created_at` remains 21:00

#### Scenario: Audited table without a client-set time

- **WHEN** a row is inserted into an audited table that has no `occurred_at` column
- **THEN** its `created` event is dated with the moment of the insert, as before

#### Scenario: Later changes are dated when they arrive

- **WHEN** a row carrying `occurred_at` is later updated, archived or moved to another status
- **THEN** those events are dated with the moment the change reached the database, not with the record's `occurred_at`
