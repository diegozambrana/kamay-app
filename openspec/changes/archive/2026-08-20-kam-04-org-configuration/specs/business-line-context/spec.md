## Purpose

Convierte la línea de negocio en el contexto ambiental del sistema: una sola elección en la barra superior que acompaña al usuario por todas las secciones, sobrevive al cierre de sesión y preselecciona la línea en los formularios de creación.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-04; `specs/PRD/kamay-mapa-navegacion-ui.md` §2.2, §4.1.

## ADDED Requirements

### Requirement: The shell offers a global business line selector

The application shell MUST show, on every `(app)` screen, a business line selector listing the option "Todas" plus every active business line of the current organization with its color. Archived lines MUST NOT be offered.

#### Scenario: Selector lists active lines with their colors

- **WHEN** a signed-in member opens any `(app)` screen
- **THEN** the shell shows the line selector with "Todas" and every active line of their organization, each with its color

#### Scenario: Archived lines are not offered

- **WHEN** a business line has been archived
- **THEN** the selector no longer offers it

### Requirement: The active line is resolved on the server before the first render

The active business line MUST be resolved server-side from the persisted selection before a screen renders, so that no screen first renders without a line context and then changes it. An absent or unreadable selection MUST resolve to "Todas".

#### Scenario: Screen renders already scoped to the selected line

- **WHEN** a signed-in user with a selected line opens any `(app)` screen
- **THEN** the screen renders with that line already selected, without an intermediate render showing a different selection

#### Scenario: Missing selection falls back to all lines

- **WHEN** no selection has been persisted for the current organization
- **THEN** the active line resolves to "Todas"

### Requirement: The selection survives navigation between sections

Changing sections MUST NOT reset the selected line. The selection MUST persist for as long as the user stays in the same organization.

#### Scenario: Selection is kept when moving to another section

- **WHEN** a user selects a business line in one section and then navigates to another section
- **THEN** the selector still shows the same line and the new section is scoped to it

### Requirement: The selection survives the end of the session

The selected line MUST be persisted per organization and outlive the session: a user who signs out and signs back in later, in the same browser, MUST find their last selected line still active.

#### Scenario: Selection survives sign-out and sign-in

- **WHEN** a user selects a line, signs out, and signs in again in the same browser
- **THEN** the selector shows the line they had selected

#### Scenario: Each organization keeps its own selection

- **WHEN** a user who belongs to two organizations selects a line in organization A and then switches to organization B
- **THEN** organization B shows its own last selection, not the line selected in A

#### Scenario: A selection pointing at an archived or foreign line is discarded

- **WHEN** the persisted selection refers to a line that has since been archived or that does not belong to the current organization
- **THEN** the stale value is ignored and the active line resolves to "Todas"

### Requirement: The active line preselects the line in creation forms

Every creation form that takes a business line MUST come with the active line preselected. When the active line is "Todas", the form MUST NOT preselect any line and MUST require an explicit choice.

#### Scenario: Creation form opens on the active line

- **WHEN** a user with a specific active line opens a creation form that requires a business line
- **THEN** that line is preselected in the form

#### Scenario: All lines active leaves the choice explicit

- **WHEN** a user whose active line is "Todas" opens a creation form that requires a business line
- **THEN** no line is preselected and the form requires the user to choose one
