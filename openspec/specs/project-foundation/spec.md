# project-foundation Specification

## Purpose

Garantiza que el repositorio de Kamay ofrece, desde el primer commit, un entorno de desarrollo arrancable, un arnés de pruebas funcional en tres niveles, un entorno de base de datos local reproducible, herramientas de disciplina de trabajo operativas (OpenSpec, Graphify) y una integración continua que rechaza código roto.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-01, criterios de aceptación 1–7; `specs/PRD/ARCHITECTURE.md` §Pruebas, §OpenSpec, §Graphify.

## Requirements

### Requirement: Application shell boots with theme switching
The development server MUST serve the application with an empty shell page, and the page MUST include a working light/dark theme toggle whose selection persists across reloads.

#### Scenario: Dev server serves the empty shell
- **WHEN** a developer runs `npm run dev` and opens the served URL
- **THEN** the application renders an empty page without errors in the console or the server log

#### Scenario: Theme toggle switches and persists
- **WHEN** the user activates the theme toggle on the shell page and reloads the page
- **THEN** the UI switches between light and dark mode and the chosen mode is still applied after the reload

### Requirement: Quality gates run clean on the scaffold
The commands `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` and `npm run test:e2e` MUST all exist and MUST exit with code 0 on the scaffolded repository, even while the suites are nearly empty.

#### Scenario: All quality commands succeed
- **WHEN** each of `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` and `npm run test:e2e` is executed on a clean checkout
- **THEN** every command completes with exit code 0

### Requirement: Test harness proven at every level
The repository MUST contain at least one passing test at each level — unit (Vitest + Testing Library), database (pgTAP via `supabase test db`) and end-to-end (Playwright against the running app) — demonstrating the harness works end to end.

#### Scenario: One passing unit test
- **WHEN** `npm run test:unit` runs
- **THEN** at least one unit test executes and passes

#### Scenario: One passing pgTAP test
- **WHEN** `supabase test db` runs against the local database
- **THEN** at least one pgTAP test executes and passes

#### Scenario: One passing end-to-end test
- **WHEN** `npm run test:e2e` runs
- **THEN** at least one Playwright test executes in a real browser against the app and passes

### Requirement: Local Supabase environment is reproducible
The local Supabase environment MUST start and reset without errors, with the pgTAP extension available for database tests.

#### Scenario: Supabase starts and resets cleanly
- **WHEN** a developer runs `supabase start` followed by `supabase db reset`
- **THEN** both commands complete with exit code 0

### Requirement: OpenSpec project conventions are recorded
The OpenSpec workspace MUST be initialized and `openspec/project.md` MUST record the non-negotiable conventions of `specs/PRD/ARCHITECTURE.md` (layered architecture, RLS everywhere, no DELETE policies, nothing derived is stored, status comparison by `kind`, English identifiers / Spanish user-facing text, migrations only as new timestamped files with pgTAP tests).

#### Scenario: OpenSpec reports the initialized project
- **WHEN** a developer runs `openspec view`
- **THEN** the command shows the initialized project including this change

#### Scenario: Conventions are present in project.md
- **WHEN** `openspec/project.md` is inspected
- **THEN** it contains the non-negotiable conventions listed in ARCHITECTURE.md

### Requirement: Knowledge graph is versioned and self-updating
The Graphify knowledge graph MUST be generated, its output directory `graphify-out/` MUST be tracked in git, and a `post-commit` git hook MUST regenerate the graph after each commit.

#### Scenario: Graph output is tracked
- **WHEN** `git ls-files graphify-out/` is executed
- **THEN** it lists at least one committed graph file

#### Scenario: Post-commit hook updates the graph
- **WHEN** a commit is created in the repository
- **THEN** the `post-commit` hook runs and the graph in `graphify-out/` reflects the committed state

### Requirement: Continuous integration enforces the pipeline
A CI pipeline MUST run on pull requests executing, in order: lint, typecheck, unit tests, Supabase startup, integration tests (pgTAP included), build and end-to-end tests — and MUST fail when any step breaks.

#### Scenario: CI passes on a healthy pull request
- **WHEN** a pull request with passing code is opened
- **THEN** the CI pipeline runs the full sequence and finishes green

#### Scenario: CI fails on a broken typecheck
- **WHEN** a pull request deliberately introduces a TypeScript type error
- **THEN** the CI pipeline fails at the typecheck step
