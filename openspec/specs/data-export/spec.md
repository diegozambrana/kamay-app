# data-export Specification

## Purpose

Permite que una organización saque en cualquier momento todos sus datos —bitácora incluida, también el detalle que la retención ya vació— en un único archivo que se abre en cualquier hoja de cálculo, para respaldarlos, llevarlos a contabilidad externa o analizarlos fuera del sistema, con el mismo alcance de organización y de rol que rige el resto de la aplicación.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-23, alcance «exportación completa de todos los datos a hoja de cálculo» y criterio 5; KAM-22 (`design.md` — la descarga de las exportaciones de retención «pertenece a la exportación completa de KAM-23»); `specs/PRD/kamay-especificacion-producto-v6.md` §9 (exportación completa en cualquier momento), §10 (exportación a hoja de cálculo), §8 (la bitácora registra las exportaciones); `specs/PRD/ARCHITECTURE.md` (convención 2: el cliente de service role jamás en una acción disparada por el usuario).

## Requirements

### Requirement: A full export produces every table the requester can read

La exportación completa MUST producir **un único archivo comprimido** que contenga un archivo CSV por cada tabla de datos de la organización que quien exporta puede leer —directorio, catálogo, egresos, inventario, activos, pedidos, cobros y pagos, tareas con sus vínculos y entregables, adjuntos, avisos, configuración y **bitácora**—, cada uno con sus filas y encabezados legibles. Ninguna tabla MAY exportarse truncada: si una tabla tiene más filas de las que caben en una sola lectura, la exportación MUST leerlas todas por páginas.

#### Scenario: Every table is present in the export

- **WHEN** la persona dueña de una organización con datos en todos los dominios solicita la exportación completa
- **THEN** el archivo resultante contiene un CSV por cada tabla de datos de la organización, incluida la bitácora

#### Scenario: An empty table still appears

- **WHEN** una organización sin ningún egreso solicita la exportación completa
- **THEN** el CSV de egresos aparece con sus encabezados y sin filas, en lugar de omitirse

#### Scenario: A large table is exported whole

- **WHEN** una organización tiene en una tabla muchas más filas que el tamaño de una página de lectura y solicita la exportación completa
- **THEN** el CSV de esa tabla contiene todas sus filas, sin tope ni corte silencioso

### Requirement: The export includes the activity detail already purged by retention

Cuando la retención ya vació el detalle de eventos antiguos, la exportación completa de la persona dueña MUST incluir, además del CSV de la bitácora, **las exportaciones de la purga** de su organización tal como la rutina de retención las escribió, de modo que el antes y el después de cada cambio siga recuperable. Ese acceso MUST concederse por una política de seguridad limitada a la persona dueña de la organización a la que pertenece cada archivo, y MUST NOT obtenerse con credenciales elevadas.

#### Scenario: Purged detail travels with the export

- **WHEN** la persona dueña de una organización cuya bitácora ya pasó por una purga solicita la exportación completa
- **THEN** el archivo contiene las exportaciones de la purga de esa organización, sin alterar

#### Scenario: Another organization's purge exports are unreachable

- **WHEN** la persona dueña de la organización A intenta leer una exportación de la purga guardada bajo la carpeta de la organización B
- **THEN** la política la rechaza

#### Scenario: An assistant cannot read purge exports

- **WHEN** un ayudante intenta leer una exportación de la purga de su propia organización
- **THEN** la política la rechaza, igual que le rechaza la bitácora

### Requirement: The export never exceeds what the requester may read

La exportación MUST construirse con los permisos de quien la solicita. MUST NOT usar credenciales elevadas ni omitir las políticas de seguridad a nivel de fila. Ninguna exportación MAY contener una sola fila de otra organización.

#### Scenario: Cross-organization data never leaks into an export

- **WHEN** un usuario que pertenece solo a la organización A solicita la exportación completa mientras existe la organización B con datos
- **THEN** el archivo no contiene ninguna fila de la organización B

#### Scenario: An assistant exports without cost information

- **WHEN** un usuario con rol de ayudante solicita la exportación completa
- **THEN** el archivo omite egresos, costos, márgenes, activos y bitácora, exactamente igual que las vistas que ese rol puede abrir

### Requirement: Exporting is recorded in the activity log

Toda exportación MUST generar un evento en la bitácora identificando quién la solicitó y cuándo. El fallo al registrar el evento MUST NOT impedir ni deshacer la exportación.

#### Scenario: A completed export leaves a trace

- **WHEN** un usuario completa una exportación
- **THEN** la bitácora contiene un evento de exportación con su autor y su fecha y hora

### Requirement: The export is available at any moment and reports its progress

La exportación MUST poder solicitarse en cualquier momento desde la configuración de la organización, sin depender de ningún trabajo programado. Mientras se prepara, la interfaz MUST indicar que está en curso, y al terminar MUST entregar el archivo o explicar el fallo en lenguaje humano.

#### Scenario: Export is requested on demand

- **WHEN** la persona dueña abre la configuración de la organización y solicita la exportación completa
- **THEN** la exportación se inicia en ese momento sin esperar a ningún proceso programado

#### Scenario: A failed export explains itself

- **WHEN** la preparación de la exportación falla
- **THEN** la interfaz explica el fallo en lenguaje humano y ofrece reintentar, sin mostrar códigos técnicos

### Requirement: Exported values preserve their meaning

Cada CSV MUST abrirse en una hoja de cálculo común conservando los caracteres acentuados. Los importes MUST exportarse como números con su precisión íntegra, sin formato de moneda, redondeo ni notación abreviada, de modo que la columna se pueda sumar. Las fechas y horas MUST exportarse en un formato interpretable sin ambigüedad. Las referencias entre tablas MUST conservar el identificador que permite reconstruir el vínculo, además del texto legible.

#### Scenario: Accents survive opening the file

- **WHEN** se abre en una hoja de cálculo el CSV de líneas de negocio de una organización con una línea llamada «Sublimación»
- **THEN** el nombre se muestra como «Sublimación», sin caracteres corruptos

#### Scenario: Amounts survive the round trip

- **WHEN** se exporta un cobro con decimales
- **THEN** el valor en el archivo coincide exactamente con el almacenado, sin pérdida de precisión ni formato de moneda

#### Scenario: A relation can be reconstructed from the file

- **WHEN** se exportan pedidos y sus cobros
- **THEN** cada cobro conserva el identificador del pedido al que corresponde, además del texto legible que lo identifica
