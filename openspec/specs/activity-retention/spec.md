# activity-retention Specification

## Purpose

Pone un plazo a lo que la bitácora conserva en detalle sin que conservar menos signifique perder: la organización fija cuántos meses guarda el antes y el después de cada cambio, y cuando ese plazo se cumple el sistema exporta primero, verifica que la exportación quedó escrita y solo entonces suelta el detalle —sin borrar jamás una fila, de modo que quién hizo qué y cuándo sobrevive para siempre—.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-22 (política de retención de 12 meses en V15, con exportación automática previa a cualquier purga); `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §14 «Retención»; `specs/PRD/kamay-especificacion-producto-v6.md` §9 (volumen de la bitácora).
>
> Presupone la bitácora de KAM-03 y la configuración de organización de KAM-04: el plazo vive en `organizations.settings`.

## Requirements

### Requirement: La retención es una política de la organización, configurable y con valor por defecto

Cada organización SHALL tener un plazo de retención del detalle de su bitácora, expresado en meses, con un valor por defecto de doce meses cuando nunca se ha configurado. La persona dueña SHALL poder cambiarlo desde la configuración de la organización. El plazo SHALL ser un número positivo de meses; un valor no positivo o no numérico SHALL NOT guardarse. Un ayudante SHALL NOT poder cambiarlo.

#### Scenario: Sin configurar, doce meses

- **WHEN** se consulta el plazo de retención de una organización que nunca lo configuró
- **THEN** el plazo vigente es de doce meses

#### Scenario: La persona dueña cambia el plazo

- **WHEN** una persona dueña guarda un plazo distinto
- **THEN** el plazo queda guardado y es el que rige a partir de ese momento

#### Scenario: Un plazo inválido se rechaza

- **WHEN** se intenta guardar un plazo de cero meses o un valor no numérico
- **THEN** la operación falla con un mensaje comprensible y el plazo anterior sigue vigente

#### Scenario: El ayudante no cambia la política

- **WHEN** un ayudante intenta guardar un plazo de retención
- **THEN** la operación falla y el plazo no cambia

### Requirement: La purga exporta y verifica antes de vaciar el detalle

La rutina de retención de una organización SHALL, en este orden: reunir los eventos más antiguos que el plazo vigente cuyo detalle siga presente, producir con ellos una exportación persistida fuera de la tabla, **verificar que esa exportación quedó efectivamente escrita y es legible**, y solo entonces vaciar el detalle de esos eventos. La rutina SHALL informar cuántos eventos exportó y cuántos vació, y dónde quedó la exportación.

#### Scenario: Primero exporta, después vacía

- **WHEN** se ejecuta la retención sobre una organización con eventos más antiguos que su plazo
- **THEN** existe una exportación legible con esos eventos y sus detalles, y solo después el detalle de esos eventos queda vacío en la tabla

#### Scenario: La rutina informa lo que hizo

- **WHEN** termina una ejecución de la retención
- **THEN** informa el número de eventos exportados, el número de eventos vaciados y la ubicación de la exportación

### Requirement: Si la exportación falla, no se vacía nada

Cuando la exportación no se produce, no se puede escribir o no supera la verificación, la rutina SHALL abortar sin vaciar el detalle de ningún evento y SHALL informar el fallo. El estado de la bitácora tras un fallo SHALL ser idéntico al que tenía antes de intentarlo.

#### Scenario: Exportación fallida, bitácora intacta

- **WHEN** la escritura de la exportación falla durante la retención
- **THEN** ningún evento queda con su detalle vaciado y la rutina informa el fallo

#### Scenario: Exportación no verificable, bitácora intacta

- **WHEN** la exportación se escribe pero no supera la verificación de que quedó legible
- **THEN** ningún evento queda con su detalle vaciado y la rutina informa el fallo

### Requirement: La purga resume, nunca borra

La rutina de retención SHALL NOT eliminar ninguna fila de la bitácora y SHALL NOT modificar ningún campo salvo el detalle del cambio. El autor, la organización, la línea, la tabla, el registro, la acción, el origen y el momento del evento SHALL permanecer intactos para siempre.

#### Scenario: El número de eventos no cambia

- **WHEN** se ejecuta la retención sobre una organización con eventos vencidos
- **THEN** la bitácora conserva exactamente el mismo número de eventos que antes

#### Scenario: Todo salvo el detalle sobrevive

- **WHEN** se compara un evento vaciado con lo que era antes de la purga
- **THEN** solo su detalle cambió; autor, organización, línea, tabla, registro, acción, origen y momento son los mismos

### Requirement: Solo se vacían los eventos vencidos de la organización tratada

La rutina SHALL vaciar únicamente eventos cuyo momento sea anterior al plazo vigente **de la organización sobre la que se ejecuta**. Un evento dentro del plazo SHALL conservar su detalle. Un evento de otra organización SHALL NOT verse afectado, aunque esté vencido según el plazo de la organización tratada.

#### Scenario: Lo reciente conserva su detalle

- **WHEN** se ejecuta la retención sobre una organización con eventos dentro y fuera del plazo
- **THEN** solo los eventos anteriores al plazo quedan sin detalle

#### Scenario: Otra organización no se toca

- **WHEN** se ejecuta la retención sobre una organización
- **THEN** ningún evento de otra organización pierde su detalle

#### Scenario: Cada organización se rige por su propio plazo

- **WHEN** dos organizaciones tienen plazos distintos y se ejecuta la retención sobre ambas
- **THEN** cada una vacía según su propio plazo y no según el de la otra

### Requirement: Un evento purgado se sigue leyendo

Un evento cuyo detalle fue vaciado SHALL seguir apareciendo en la bitácora y en el historial de su registro, SHALL seguir leyéndose como frase en lenguaje natural con su autor, su acción y su registro, y SHALL declarar que su detalle ya no está disponible cuando se le pida. Un evento purgado SHALL NOT rendirse como un error ni desaparecer de la lista.

#### Scenario: Sigue en la lista y se lee

- **WHEN** se lista la bitácora tras una purga
- **THEN** los eventos purgados aparecen con su frase, su autor y su fecha

#### Scenario: El detalle ausente se declara

- **WHEN** se pide el detalle de un evento purgado
- **THEN** el sistema declara que ya no está disponible por la política de retención

### Requirement: La retención solo la ejecuta el sistema, y nunca por sí sola en esta entrega

La rutina de retención SHALL ejecutarse con privilegio de sistema y SHALL NOT ser invocable por un usuario autenticado, ni dueño ni ayudante. En esta entrega la rutina SHALL NOT dispararse por sí sola: su activación programada queda documentada para la puesta en producción, y su ausencia SHALL NOT dejar la bitácora en un estado inconsistente.

#### Scenario: Un usuario no puede purgar

- **WHEN** un usuario autenticado, incluso dueño, intenta ejecutar la rutina de retención
- **THEN** la operación falla por privilegios

#### Scenario: Nada se purga sin ejecutarla

- **WHEN** pasa el plazo de retención sin que nadie ejecute la rutina
- **THEN** los eventos vencidos conservan su detalle y el sistema funciona con normalidad

#### Scenario: El procedimiento de activación está documentado

- **WHEN** se consulta la documentación del proyecto sobre la retención
- **THEN** describe cómo se agenda la rutina en producción y por qué no se agenda en esta entrega
