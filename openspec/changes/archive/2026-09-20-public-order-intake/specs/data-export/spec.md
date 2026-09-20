## ADDED Requirements

### Requirement: El material de token nunca sale en una exportación

Cuando una tabla declarada en la exportación completa guarde un resumen de token (`token_hash` u otro material equivalente que sirva para autenticar un enlace de un solo uso), la exportación MUST omitir esa columna, con el motivo escrito en el código junto a la exclusión. El resto de las columnas de esa tabla MUST exportarse con normalidad.

#### Scenario: `order_requests` sale sin su token

- **WHEN** una organización con solicitudes de pedido solicita la exportación completa
- **THEN** el CSV de solicitudes contiene sus demás columnas, y no contiene `token_hash`

#### Scenario: El resto de la tabla no se pierde por la exclusión

- **WHEN** se exporta la tabla de solicitudes de pedido
- **THEN** el CSV conserva el nombre, el teléfono, la nota, las fechas y el resto de sus columnas declaradas
