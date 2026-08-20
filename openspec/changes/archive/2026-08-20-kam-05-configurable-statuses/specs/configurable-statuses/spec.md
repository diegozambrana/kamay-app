## Purpose

Permite que cada línea de negocio tenga su propio flujo de trabajo mediante juegos de estados configurables por organización y personalizables por línea, sin que la flexibilidad rompa alertas, indicadores ni reportes: el `kind` declarado es el único contrato estable.

## ADDED Requirements

### Requirement: Tabla de estados con tipo declarado y alcance

El sistema SHALL almacenar los estados en la tabla `statuses` según el esquema canónico: `flow` restringido a `order` o `task`; `kind` restringido a `initial`, `in_progress`, `waiting`, `final` o `cancelled`; `color`; `position`; `is_queue`; `archived_at`; y alcance dado por `business_line_id` (`null` = juego de la organización, valor = juego propio de esa línea). La unicidad de nombre SHALL aplicar por `(organization_id, business_line_id, flow, name)` tratando los `null` como iguales (`unique nulls not distinct`).

#### Scenario: Nombre duplicado en el mismo juego

- **WHEN** se intenta crear un estado con un nombre ya existente en el mismo juego (misma organización, misma línea —o ambas sin línea—, mismo flujo)
- **THEN** la base de datos rechaza la inserción por la restricción de unicidad

#### Scenario: Mismo nombre en juegos distintos

- **WHEN** se crea un estado "Entregado" en el juego de Sublimación y otro "Entregado" en el juego de Alfarería
- **THEN** ambos se aceptan, porque pertenecen a juegos distintos

### Requirement: Solo un estado de espera puede ser cola

El sistema SHALL rechazar a nivel de base de datos todo estado con `is_queue = true` cuyo `kind` no sea `waiting` (restricción `queue_only_when_waiting`).

#### Scenario: Cola sobre un estado que no es de espera

- **WHEN** se intenta guardar un estado con `is_queue = true` y `kind = 'in_progress'`
- **THEN** la restricción de la base de datos rechaza la operación

#### Scenario: Cola sobre un estado de espera

- **WHEN** se guarda un estado con `is_queue = true` y `kind = 'waiting'`
- **THEN** la operación se acepta

### Requirement: Resolución del juego aplicable

El sistema SHALL resolver qué juego de estados aplica a una línea mediante la función de base de datos `resolve_statuses(org, line, p_flow)`: si existen estados activos con `business_line_id = <línea>` para ese flujo, se devuelve ese juego completo y el de la organización se ignora por completo; si no, se devuelve el juego de la organización (`business_line_id is null`). El resultado SHALL excluir estados archivados y ordenarse por `position`. Todo servicio de la aplicación SHALL obtener los estados vigentes a través de esta función, sin reimplementar la resolución.

#### Scenario: Línea sin juego propio

- **WHEN** se resuelven los estados de una línea que no tiene juego propio para ese flujo
- **THEN** se devuelve el juego de la organización

#### Scenario: Línea con juego propio

- **WHEN** se resuelven los estados de una línea que tiene juego propio para ese flujo
- **THEN** se devuelve únicamente su juego y ningún estado del juego de la organización aparece en el resultado

#### Scenario: Estados archivados excluidos

- **WHEN** un estado del juego aplicable tiene `archived_at` no nulo
- **THEN** no aparece en el resultado de `resolve_statuses`

### Requirement: Integridad del juego — al menos un inicial y un final

El sistema SHALL garantizar, mediante un trigger sobre `statuses` que se evalúa tras cada inserción, actualización o borrado, que todo juego activo conserva al menos un estado `initial` y al menos un estado `final`. Si una operación deja un juego inválido, SHALL fallar con un mensaje comprensible. La interfaz avisa antes, pero la base de datos no confía en eso.

#### Scenario: Guardar un juego sin estado final

- **WHEN** se intenta archivar o modificar estados de modo que un juego activo quede sin ningún estado `final`
- **THEN** la operación falla con un mensaje comprensible y el juego queda como estaba

#### Scenario: Guardar un juego sin estado inicial

- **WHEN** se intenta dejar un juego activo sin ningún estado `initial`
- **THEN** la operación falla con un mensaje comprensible

### Requirement: Archivar un estado en uso exige reasignación

Cuando se archiva un estado que tiene registros asignados, el sistema SHALL exigir indicar a qué estado del mismo juego se mueven esos registros, y SHALL efectuar la reasignación de modo que ningún registro quede apuntando a un estado archivado. Los estados nunca se borran: se archivan con `archived_at` (no existe política `DELETE`).

#### Scenario: Archivar con registros pendientes

- **WHEN** el dueño archiva un estado en uso e indica el estado de destino
- **THEN** todos los registros que lo tenían pasan al estado de destino y ninguno queda huérfano

#### Scenario: Archivar sin indicar destino

- **WHEN** se intenta archivar un estado en uso sin indicar a dónde mover sus registros
- **THEN** la operación se rechaza y se pide el estado de destino

### Requirement: Los cambios de configuración no reescriben la historia

Un cambio en la configuración de estados (renombrar, recolorear, reordenar, archivar, restaurar valores por defecto) SHALL dejar intactos los estados que los registros anteriores ya tenían, y SHALL quedar registrado en la bitácora (`activity_log`) mediante el trigger de auditoría, de modo que la historia lo demuestre.

#### Scenario: Renombrar un estado con historia

- **WHEN** el dueño renombra un estado que registros antiguos referencian
- **THEN** esos registros conservan su referencia al mismo estado (que ahora muestra el nombre nuevo) y la bitácora registra el cambio de nombre con valor anterior y nuevo

#### Scenario: Auditoría de la configuración

- **WHEN** se crea, modifica o archiva un estado
- **THEN** la bitácora registra el evento con autor, momento y campos cambiados

### Requirement: Comparación por tipo, nunca por nombre

Ninguna consulta ni lógica de la aplicación SHALL comparar estados por su nombre; toda condición sobre estados SHALL usar `kind`. Los nombres son configurables por organización y por línea y pueden cambiar en cualquier momento.

#### Scenario: Lógica dependiente del estado

- **WHEN** el código necesita distinguir, por ejemplo, pedidos terminados de pendientes
- **THEN** la condición se expresa sobre `kind` (`final`, `cancelled`, etc.) y sigue funcionando aunque el dueño renombre todos los estados

### Requirement: Aislamiento y permisos de la tabla de estados

La tabla `statuses` SHALL tener RLS activa con el patrón del proyecto: los miembros de la organización pueden leer sus estados; solo el dueño puede crearlos, modificarlos y archivarlos; no existe política `DELETE`; ninguna fila de otra organización es visible ni alcanzable.

#### Scenario: Ayudante intenta modificar estados

- **WHEN** un usuario con rol de ayudante intenta crear o modificar un estado
- **THEN** la operación es rechazada por RLS

#### Scenario: Estados de otra organización

- **WHEN** un usuario consulta estados perteneciendo a otra organización
- **THEN** no obtiene ninguna fila de la organización ajena

### Requirement: Pantalla de configuración de estados (V22)

El sistema SHALL ofrecer una pantalla de configuración de estados accesible solo para el dueño, con: selector de flujo (Pedidos / Tareas) y de alcance (organización o línea específica); lista ordenable por arrastre con nombre, color, tipo declarado y marca opcional de "columna en cola"; edición en el sitio; agregar; archivar pidiendo a dónde mover lo que quedaba; restaurar valores por defecto; *usar el juego de la organización* (descartar el juego propio de la línea); y el aviso visible "Los cambios no afectan la historia de pedidos y tareas anteriores". La pantalla SHALL validar al menos un `initial` y un `final` antes de enviar.

#### Scenario: Ayudante intenta abrir la pantalla

- **WHEN** un ayudante navega a la dirección de configuración de estados
- **THEN** es redirigido y la opción no aparece en su menú

#### Scenario: Personalizar una línea sin afectar a las demás

- **WHEN** el dueño crea un juego propio para Alfarería y lo edita
- **THEN** los juegos de las demás líneas y el de la organización quedan exactamente como estaban

#### Scenario: Reordenar por arrastre

- **WHEN** el dueño arrastra un estado a otra posición de la lista
- **THEN** el nuevo orden se persiste en `position` y se refleja al recargar

#### Scenario: Volver al juego de la organización

- **WHEN** el dueño elige *usar el juego de la organización* en una línea con juego propio y confirma la reasignación de los registros que usaban estados propios
- **THEN** el juego propio queda archivado y la línea vuelve a resolver el juego de la organización

### Requirement: Semilla de estados de Geeko Store

Tras `supabase db reset`, Geeko Store SHALL quedar sembrada con: los cuatro estados de tarea como juego de la organización (Por hacer · Haciendo · En revisión · Hecho); el juego de pedido de Sublimación (Registrado · En diseño · En cola [única columna con `is_queue`] · Sublimando · Listo para entrega · Entregado · Cancelado); el juego mínimo de Alfarería (Reservado · Listo para entrega · Entregado · Cancelado); y el juego provisional de 3D (Registrado · En cola [`is_queue`] · Imprimiendo · Post-proceso · Listo para entrega · Entregado · Cancelado), cada uno con su `kind` correcto y su orden.

#### Scenario: Reinicio de la base local

- **WHEN** se ejecuta `supabase db reset`
- **THEN** los cuatro juegos quedan creados, `resolve_statuses` devuelve el juego de Sublimación para pedidos de esa línea y el juego de organización para tareas de cualquier línea
