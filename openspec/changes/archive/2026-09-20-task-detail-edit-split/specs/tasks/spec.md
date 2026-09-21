## ADDED Requirements

### Requirement: Cambiar la línea de una tarea reubica su estado en el juego de la línea nueva

Cuando la línea de negocio de una tarea cambia, el sistema SHALL reubicar su estado en el primer estado —en el orden declarado— del mismo tipo dentro del juego que resuelve para la línea nueva en el flujo `task`. El tipo SHALL ser el criterio de la correspondencia, nunca el nombre del estado. Si el juego de la línea nueva no tiene ningún estado de ese tipo, el cambio de línea SHALL rechazarse con un mensaje que lo explique, y la tarea SHALL conservar su línea y su estado anteriores.

Una tarea SHALL NOT quedar nunca con un estado que no pertenece al juego de su línea. Este requisito completa «El estado inicial lo asigna la base resolviendo el juego de la línea», que gobierna solo el alta.

El cambio de línea y el de estado que lo acompaña SHALL quedar ambos registrados en la bitácora.

#### Scenario: La tarea aparece en el tablero de su línea nueva

- **GIVEN** una tarea de Sublimación en un estado de tipo `in_progress`, cuyo juego de Alfarería tiene «Modelado» como primer estado de ese tipo
- **WHEN** su línea cambia a Alfarería
- **THEN** la tarea queda en «Modelado» y aparece en esa columna del tablero de Alfarería

#### Scenario: El nombre del estado no decide el destino

- **GIVEN** dos líneas cuyos estados de tipo `waiting` se llaman distinto
- **WHEN** una tarea en espera pasa de una línea a la otra
- **THEN** queda en el estado de tipo `waiting` de la línea nueva, sin que la diferencia de nombres lo impida

#### Scenario: Varios estados del mismo tipo

- **GIVEN** una línea con dos estados de tipo `in_progress`, «Diseño» y luego «Impresión»
- **WHEN** una tarea en curso pasa a esa línea
- **THEN** queda en «Diseño», el primero de ese tipo en el orden declarado

#### Scenario: La línea nueva no tiene ese tipo

- **GIVEN** una tarea en un estado de tipo `waiting` y una línea destino sin ningún estado de ese tipo
- **WHEN** se intenta cambiarle la línea a esa
- **THEN** el cambio se rechaza con un mensaje que lo explica, y la tarea conserva su línea y su estado anteriores

#### Scenario: Ambos cambios quedan en la bitácora

- **WHEN** una tarea cambia de línea y su estado se reubica
- **THEN** la bitácora registra el cambio de línea y el de estado, cada uno con su valor anterior y el nuevo
