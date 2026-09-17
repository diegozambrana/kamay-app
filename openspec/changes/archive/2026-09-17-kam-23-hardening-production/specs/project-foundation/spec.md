# project-foundation Specification (delta)

## ADDED Requirements

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

## MODIFIED Requirements

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
