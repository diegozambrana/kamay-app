## RENAMED Requirements

- FROM: `### Requirement: Registrar está a dos toques desde cualquier pantalla móvil`
- TO: `### Requirement: Registrar está a dos toques desde cualquier pantalla`

## MODIFIED Requirements

### Requirement: Registrar está a dos toques desde cualquier pantalla

El sistema SHALL ofrecer, en toda pantalla del área autenticada y **en cualquier tamaño de pantalla**, un control *+ Registrar* que abre el mismo menú de destinos de la retícula de `/quick`, filtrado por el mismo rol. Desde cualquier pantalla, alcanzar el formulario de un destino disponible SHALL requerir como máximo dos interacciones: abrir el menú y elegir el destino. El control SHALL ausentarse únicamente de las pantallas de captura a pantalla completa, donde taparía las acciones de guardar y ofrecería una salida que se saltaría la confirmación de descarte. El control SHALL NOT tapar ni desplazar el indicador de registros por sincronizar, ni el contenido de la pantalla sobre la que flota en escritorio.

El menú SHALL ser uno solo: los destinos, su orden y su filtrado por rol SHALL salir de la misma declaración en ambas superficies, sin que ninguna pueda ofrecer un destino que la otra no.

#### Scenario: Registrar un gasto desde el catálogo

- **WHEN** una persona dueña está en el catálogo en un viewport móvil y activa *+ Registrar* y luego *Gasto*
- **THEN** llega al formulario de nuevo gasto en dos interacciones

#### Scenario: Registrar un pedido desde los egresos

- **WHEN** una persona dueña está en la bandeja de egresos en un viewport móvil y activa *+ Registrar* y luego *Pedido*
- **THEN** llega al formulario de nuevo pedido en dos interacciones

#### Scenario: El menú respeta el rol

- **WHEN** un ayudante abre el menú de *+ Registrar*
- **THEN** los destinos Compra y Gasto no aparecen en el menú

#### Scenario: Las pantallas de captura no lo muestran

- **WHEN** se abre el formulario de nuevo pedido en un viewport móvil
- **THEN** el control *+ Registrar* no se rinde

#### Scenario: En escritorio no aparece

- **WHEN** se abre el formulario de nuevo pedido en un viewport de escritorio
- **THEN** el control *+ Registrar* no se rinde, porque la regla de las pantallas de captura vale en las dos superficies

#### Scenario: Registrar una compra desde el panel en escritorio

- **WHEN** una persona dueña está en el panel principal en un viewport de escritorio y activa *+ Registrar* y luego *Compra*
- **THEN** llega al formulario de nueva compra en dos interacciones

#### Scenario: Un solo menú para las dos superficies

- **WHEN** se compara el menú de *+ Registrar* en móvil y en escritorio para el mismo rol
- **THEN** ofrece exactamente los mismos destinos en el mismo orden

#### Scenario: El indicador de sincronización sigue alcanzable

- **WHEN** hay registros pendientes y se abre una pantalla del área autenticada en un viewport móvil
- **THEN** el indicador de registros por sincronizar sigue visible y se puede activar con el control *+ Registrar* en pantalla
