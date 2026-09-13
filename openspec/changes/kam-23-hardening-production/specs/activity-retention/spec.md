## RENAMED Requirements

- FROM: `### Requirement: La retención solo la ejecuta el sistema, y nunca por sí sola en esta entrega`
- TO: `### Requirement: La retención solo la ejecuta el sistema, y en producción se ejecuta sola`

## MODIFIED Requirements

### Requirement: La retención solo la ejecuta el sistema, y en producción se ejecuta sola

La rutina de retención SHALL ejecutarse con privilegio de sistema y SHALL NOT ser invocable por un usuario autenticado, ni dueño ni ayudante. En producción la rutina SHALL dispararse sola, una vez al mes y organización por organización, conforme a los trabajos programados de `production-operations`. En un ambiente donde no está programada, su ausencia SHALL NOT dejar la bitácora en un estado inconsistente.

#### Scenario: Un usuario no puede purgar

- **WHEN** un usuario autenticado, incluso dueño, intenta ejecutar la rutina de retención
- **THEN** la operación falla por privilegios

#### Scenario: Nada se purga sin ejecutarla

- **WHEN** pasa el plazo de retención en un ambiente donde la rutina no está programada
- **THEN** los eventos vencidos conservan su detalle y el sistema funciona con normalidad

#### Scenario: El procedimiento de activación está documentado

- **WHEN** se consulta la documentación del proyecto sobre la retención
- **THEN** describe con qué programador y con qué periodicidad corre la rutina en producción, por qué ese programador, y cómo vigilar su resultado
