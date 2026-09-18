# view-states Specification

## Purpose

Define los cuatro estados que toda vista con datos debe presentar cuando no tiene contenido que mostrar —vacío inicial, cargando, error y sin resultados tras filtrar—, con un tratamiento único y reutilizado en toda la aplicación, para que ninguna pantalla deje al usuario frente a un espacio en blanco sin explicación ni salida.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-23, criterio 2; `specs/PRD/kamay-mapa-navegacion-ui.md` §12 (estados transversales) y §14 (lista de verificación); `specs/PRD/kamay-especificacion-producto-v6.md` §11 (mensajes de error en lenguaje humano).

## ADDED Requirements

### Requirement: Every data view presents an initial empty state

Toda vista que muestre datos MUST presentar, cuando no existe ningún registro y no hay filtro aplicado, un mensaje breve y neutro acompañado de la acción que corresponde a esa vista. El estado vacío inicial MUST NOT incluir ilustraciones ni textos motivacionales.

#### Scenario: Empty view offers its creation action

- **WHEN** una organización sin ningún pedido abre el tablero de pedidos sin filtros aplicados
- **THEN** la vista muestra un mensaje breve indicando que aún no hay pedidos y ofrece la acción de crear un pedido

#### Scenario: Empty state carries no decoration

- **WHEN** cualquier vista con datos se presenta en su estado vacío inicial
- **THEN** el contenido se limita al mensaje y a la acción, sin ilustración ni texto motivacional

### Requirement: Every data view presents a loading state with skeletons

Toda vista que muestre datos MUST presentar, mientras sus datos se cargan, esqueletos con la forma del contenido real. Las vistas MUST NOT usar giradores ni indicadores genéricos de progreso como estado de carga de contenido.

#### Scenario: Loading shows the shape of the content

- **WHEN** una vista con datos se abre y sus datos aún no han llegado
- **THEN** se presentan esqueletos cuya disposición corresponde a la del contenido que se está cargando

#### Scenario: No spinner replaces the content

- **WHEN** cualquier vista con datos está en estado de carga
- **THEN** no se presenta ningún girador como sustituto del contenido

### Requirement: Every data view presents a human error state with retry

Toda vista que muestre datos MUST presentar, cuando la carga falla, una explicación en lenguaje humano y una acción de reintentar que vuelva a solicitar los datos sin recargar la aplicación. El estado de error MUST NOT mostrar códigos técnicos, nombres de excepción, trazas ni identificadores internos.

#### Scenario: Failed load explains itself and offers retry

- **WHEN** la carga de datos de una vista falla
- **THEN** la vista muestra una explicación en lenguaje humano y una acción de reintentar

#### Scenario: Retry recovers without a full reload

- **WHEN** el usuario activa la acción de reintentar tras un fallo y la nueva solicitud tiene éxito
- **THEN** la vista presenta los datos sin que la aplicación se haya recargado por completo

#### Scenario: No technical detail reaches the user

- **WHEN** una vista presenta su estado de error
- **THEN** el texto visible no contiene códigos, nombres de excepción, trazas ni identificadores internos

### Requirement: Filtered-empty is distinct from initially-empty and offers to clear filters

Cuando una vista tiene al menos un filtro aplicado y el resultado no contiene filas, la vista MUST presentar un estado distinto del vacío inicial, y ese estado MUST ofrecer una acción de quitar filtros que devuelva la vista a su consulta sin filtrar.

#### Scenario: Filtering to zero results shows the filtered-empty state

- **WHEN** una vista con registros existentes recibe un filtro que no deja ninguna fila
- **THEN** presenta el estado de sin resultados tras filtrar, distinto en texto y en acción del vacío inicial

#### Scenario: Clearing filters restores the unfiltered view

- **WHEN** el usuario activa la acción de quitar filtros desde el estado de sin resultados
- **THEN** todos los filtros de la vista quedan sin aplicar y la vista presenta de nuevo sus registros

#### Scenario: An empty organization never shows the filtered-empty state

- **WHEN** una organización sin ningún registro abre la vista sin filtros
- **THEN** se presenta el vacío inicial y no el estado de sin resultados tras filtrar

### Requirement: The four states are consistent across the application

Los cuatro estados MUST presentarse con el mismo tratamiento visual y la misma estructura de contenido en toda vista con datos, de modo que el usuario reconozca la situación sin releer. Una vista nueva MUST adoptar ese tratamiento en lugar de resolver el caso por su cuenta.

#### Scenario: Two different views present the same state identically

- **WHEN** se comparan los estados vacío inicial de dos vistas con datos distintas
- **THEN** ambos presentan la misma estructura de mensaje y acción, variando solo el texto y el destino de la acción

### Requirement: The offline indicator is not one of these states

El indicador de sin conexión MUST permanecer como aviso persistente y no bloqueante, y MUST NOT sustituir el contenido de una vista ni presentarse como estado de error. Una vista que ya tiene datos cargados MUST seguir mostrándolos al perderse la conexión.

#### Scenario: Losing connection does not blank the view

- **WHEN** el dispositivo pierde la conexión mientras una vista con datos ya cargados está abierta
- **THEN** la vista sigue mostrando sus datos y el indicador de sin conexión aparece sin reemplazarlos
