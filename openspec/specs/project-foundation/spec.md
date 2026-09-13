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
A CI pipeline MUST run on pull requests executing, in order: lint, typecheck, unit tests, Supabase startup, integration tests (pgTAP included), build and end-to-end tests — and MUST fail when any step breaks. The end-to-end step MUST run the seven declared journeys and the automated accessibility audit, failing on any violation of critical or serious severity. A separate stability job MUST run the full end-to-end suite without retries and repeatedly, together with the dashboard performance measurement, on the main branch and on demand — not on every pull request, because shared runners make timings too noisy to gate a pull request on — and MUST fail when any run is inconsistent or the measurement exceeds its declared budget.

#### Scenario: CI passes on a healthy pull request
- **WHEN** a pull request with passing code is opened
- **THEN** the CI pipeline runs the full sequence and finishes green

#### Scenario: CI fails on a broken typecheck
- **WHEN** a pull request deliberately introduces a TypeScript type error
- **THEN** the CI pipeline fails at the typecheck step

#### Scenario: CI fails on a critical accessibility violation
- **WHEN** a pull request introduces a control without an accessible name
- **THEN** the CI pipeline fails at the accessibility audit step naming the offending view and element

#### Scenario: The stability job fails when the dashboard exceeds its budget
- **WHEN** the stability job runs on code that makes the dashboard exceed its declared load budget under the mid-range mobile profile
- **THEN** the stability job fails at the performance measurement step

#### Scenario: The stability job fails on an intermittent test
- **WHEN** the stability job runs the suite repeatedly without retries and one test passes in some runs and fails in others
- **THEN** the stability job fails naming the inconsistent test

### Requirement: The seven end-to-end journeys are covered and pass

La suite de extremo a extremo MUST cubrir los siete recorridos que ARCHITECTURE.md declara —autenticación, ciclo de vida del pedido, feria sin conexión, entregables de tarea, permisos del ayudante, configuración de estados y archivado/desarchivado— y todos MUST pasar en la integración continua. El recorrido de entregables MUST incluir sus tres casos: cerrar creando todos los entregables, creando algunos y **cerrando sin crear ninguno**.

#### Scenario: All seven journeys run and pass

- **WHEN** se ejecuta la suite de extremo a extremo en la integración continua
- **THEN** los siete recorridos declarados se ejecutan y todos pasan

#### Scenario: Closing without deliverables is exercised

- **WHEN** se ejecuta el recorrido de entregables de tarea
- **THEN** cubre el cierre creando todos los entregables, el cierre creando algunos y el cierre sin crear ninguno

#### Scenario: The assistant journey covers every restricted route

- **WHEN** se ejecuta el recorrido de permisos del ayudante
- **THEN** comprueba, para cada ruta reservada a la persona dueña, que no aparece en el menú y que el acceso por dirección directa redirige

### Requirement: The end-to-end suite is stable, not merely green

La suite de extremo a extremo MUST NOT depender de esperas por tiempo fijo: toda espera MUST anclarse a un estado observable de la aplicación. Cada prueba MUST crear su propia organización y MUST poder ejecutarse en paralelo y en cualquier orden sin afectar a las demás. La estabilidad MUST demostrarse con ejecuciones repetidas, no suponerse por una ejecución verde.

#### Scenario: Repeated runs give the same result

- **WHEN** la suite completa se ejecuta varias veces consecutivas sobre el mismo código
- **THEN** todas las ejecuciones producen el mismo resultado, sin fallos intermitentes

#### Scenario: No arbitrary timed waits remain

- **WHEN** se inspecciona el código de las pruebas de extremo a extremo
- **THEN** no contiene esperas por tiempo fijo arbitrario como sustituto de una condición observable

#### Scenario: Tests do not interfere with each other

- **WHEN** la suite se ejecuta en paralelo
- **THEN** ninguna prueba falla por datos creados o modificados por otra

### Requirement: The pgTAP catalog is complete

`supabase/tests/` MUST contener cada prueba pgTAP que ARCHITECTURE.md enumera, incluida `views_security.test.sql`. Una prueba declarada en ARCHITECTURE.md y ausente del repositorio MUST considerarse un incumplimiento del arnés, no una omisión menor.

#### Scenario: Every declared pgTAP test exists

- **WHEN** se compara el catálogo de pruebas pgTAP de ARCHITECTURE.md con el contenido de `supabase/tests/`
- **THEN** toda prueba declarada existe en el repositorio y se ejecuta con `supabase test db`
