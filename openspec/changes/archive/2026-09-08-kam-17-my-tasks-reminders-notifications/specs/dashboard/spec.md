## ADDED Requirements

### Requirement: Tarjeta de pendientes con los tres conteos

El panel SHALL mostrar, en la ranura que hasta ahora ocupaba el marcador de posición de pendientes, el número de tareas **vencidas**, las que vencen **hoy** y las de los **próximos 7 días**, con las vencidas destacadas en rojo. Los conteos SHALL respetar el alcance del rol de quien mira, igual que la pantalla de pendientes, y SHALL ignorar el selector de línea, porque cuentan lo mismo que ella. Activar la tarjeta SHALL abrir la pantalla de pendientes. Una organización sin ninguna tarea pendiente SHALL ver la tarjeta declarándolo, con ceros reales y no con un marcador.

#### Scenario: Los tres conteos

- **WHEN** el dueño abre el panel de una organización con dos tareas vencidas, una de hoy y tres de la semana
- **THEN** la tarjeta muestra 2, 1 y 3, con el 2 destacado en rojo

#### Scenario: El ayudante cuenta lo suyo

- **WHEN** un ayudante abre el panel
- **THEN** los conteos incluyen solo las tareas de su línea y las asignadas a él

#### Scenario: El selector no altera la cuenta

- **WHEN** se selecciona una línea concreta y se observa la tarjeta
- **THEN** los conteos no cambian, igual que en la pantalla de pendientes

#### Scenario: De la tarjeta a los pendientes

- **WHEN** se activa la tarjeta de pendientes
- **THEN** se abre la pantalla de pendientes

#### Scenario: Sin nada pendiente

- **WHEN** no hay ninguna tarea pendiente en el alcance de quien mira
- **THEN** la tarjeta lo declara con ceros reales, y no como marcador de posición

### Requirement: Marcador de posición de insumos bajo mínimo

El panel SHALL reservar el sitio de la única pieza cuyo contenido sigue llegando en una tarea posterior —la tarjeta de insumos bajo mínimo— rindiéndola con su rótulo definitivo y una leyenda visible de que aún no está disponible. Ese marcador SHALL NOT ofrecer una acción que no funcione ni presentar cifras inventadas, y SHALL ocupar la misma ranura que ocupará su contenido definitivo.

#### Scenario: El marcador que queda está rotulado

- **WHEN** se abre el panel con cualquiera de los dos roles
- **THEN** la tarjeta de insumos bajo mínimo aparece con su rótulo y su leyenda de no disponible

#### Scenario: El marcador no engaña

- **WHEN** se observa el marcador de insumos bajo mínimo
- **THEN** no muestra ningún número ni ofrece ningún control que no lleve a ninguna parte

#### Scenario: Pendientes ya no es marcador

- **WHEN** se abre el panel con cualquiera de los dos roles
- **THEN** la tarjeta de pendientes muestra sus conteos y enlaza a su pantalla, sin leyenda de no disponible

## REMOVED Requirements

### Requirement: Marcadores de posición declarados

**Reason**: El requisito hablaba de **dos** marcadores —pendientes e insumos bajo mínimo— y exigía que ninguno mostrara cifras ni ofreciera acción. La tarjeta de pendientes deja de serlo en este cambio: ahora muestra tres conteos reales y enlaza a V20. Mantener el requisito obligaría a afirmar a la vez que esa tarjeta no muestra números y que muestra tres.

**Migration**: Lo que seguía siendo cierto se conserva sin pérdida en dos requisitos nuevos de este mismo delta: *Marcador de posición de insumos bajo mínimo* recoge la regla completa para la pieza que sigue pendiente —rótulo definitivo, leyenda de no disponible, ninguna cifra, ningún control, misma ranura—, y *Tarjeta de pendientes con los tres conteos* define la conducta que la sustituye. `PENDING_TASKS_PLACEHOLDER` desaparece del código; `LOW_STOCK_PLACEHOLDER` permanece intacto hasta KAM-18.
