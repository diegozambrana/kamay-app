## MODIFIED Requirements

### Requirement: Vistas alternativas y filtros del tablero

El sistema SHALL ofrecer, sobre el mismo conjunto de pedidos, una vista de lista y una vista de calendario ordenada por fecha comprometida, además del tablero. SHALL permitir filtrar los pedidos mostrados y SHALL ofrecer un filtro "Ver archivados" que, desactivado, oculta los pedidos archivados y, activado, los muestra. El cambio de vista SHALL conservar los filtros aplicados.

La vista por omisión —cuando la dirección no declara ninguna— SHALL depender del dispositivo: **lista** en un dispositivo móvil y **tablero** en el resto. El tablero SHALL seguir disponible en móvil como alternativa elegida explícitamente, desplazándose por columnas dentro de sus propios límites. La vista elegida SHALL seguir viviendo en la dirección, de modo que el enlace de un tablero compartido desde un escritorio abra el tablero también en un teléfono.

#### Scenario: Pedido archivado oculto por defecto

- **WHEN** se abre el tablero sin activar "Ver archivados"
- **THEN** los pedidos con `archived_at` no aparecen en ninguna de las tres vistas

#### Scenario: Ver archivados

- **WHEN** se activa el filtro "Ver archivados"
- **THEN** los pedidos archivados aparecen, distinguidos de los activos

#### Scenario: Vista de calendario

- **WHEN** se cambia a la vista de calendario
- **THEN** los pedidos aparecen ubicados por su fecha comprometida y los que no tienen fecha se muestran aparte

#### Scenario: Los filtros sobreviven al cambio de vista

- **WHEN** se aplica un filtro en el tablero y se cambia a la vista de lista
- **THEN** el filtro sigue aplicado

#### Scenario: En móvil la lista es la vista por omisión

- **WHEN** se abre la pantalla de pedidos desde un dispositivo móvil sin declarar vista en la dirección
- **THEN** los pedidos se presentan como lista

#### Scenario: En escritorio el tablero sigue siendo la vista por omisión

- **WHEN** se abre la pantalla de pedidos desde un escritorio sin declarar vista en la dirección
- **THEN** los pedidos se presentan como tablero

#### Scenario: El tablero sigue disponible en móvil

- **WHEN** se elige explícitamente la vista de tablero desde un dispositivo móvil
- **THEN** el tablero se presenta y sus columnas se desplazan horizontalmente dentro del propio tablero

#### Scenario: La vista declarada manda sobre el dispositivo

- **WHEN** se abre desde un dispositivo móvil una dirección que declara la vista de tablero
- **THEN** se presenta el tablero, no la lista
