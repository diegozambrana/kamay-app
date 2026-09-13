# tenant-isolation Specification (delta)

## ADDED Requirements

### Requirement: Every view declares security_invoker

Toda vista de la base de datos MUST declarar `security_invoker = true`. El cumplimiento MUST verificarse de forma automática **sobre el catálogo del sistema**, no contra una lista de vistas escrita a mano, de modo que una vista nueva sin la opción rompa la integración continua el día que se escriba.

#### Scenario: No view lacks the option

- **WHEN** se ejecuta la verificación automática sobre el catálogo de vistas de la base de datos
- **THEN** toda vista declara `security_invoker = true` y la prueba pasa

#### Scenario: A new view without the option fails the build

- **WHEN** una migración crea una vista sin `security_invoker = true`
- **THEN** la verificación automática falla nombrando esa vista

#### Scenario: A view does not widen what its caller may read

- **WHEN** un usuario que pertenece solo a la organización A consulta cualquier vista derivada mientras existe la organización B con datos
- **THEN** obtiene cero filas de la organización B

### Requirement: The pre-production database checklist is verified point by point

Los doce puntos de la lista de verificación antes de producción del anexo de base de datos MUST estar comprobados uno por uno, y cada punto comprobable de forma automática MUST tener su prueba: toda tabla con `organization_id` y RLS activo; ninguna política `DELETE`; toda vista con `security_invoker`; `activity_log` con permisos revocados para `authenticated` y `anon`; disparadores de auditoría en **todas** las tablas auditables; ninguna columna con un valor derivable; importes en `numeric`; rutas de Storage que empiezan por `organization_id` y políticas que lo verifican; aislamiento entre organizaciones en toda tabla y toda vista; el ayudante sin acceso a egresos, activos ni último costo; una venta de feria reenviada dos veces produce una sola fila; e índices que cubren los filtros reales de la interfaz. El resultado de la verificación MUST quedar documentado punto por punto.

#### Scenario: Every table carries organization_id with RLS enabled

- **WHEN** se recorre automáticamente el catálogo de tablas de datos de la aplicación
- **THEN** toda tabla tiene `organization_id` y RLS activo, sin excepción

#### Scenario: Audit triggers cover every auditable table

- **WHEN** se recorre automáticamente el catálogo de tablas auditables
- **THEN** cada una tiene instalado el disparador de auditoría

#### Scenario: Amounts are never floating point

- **WHEN** se recorre automáticamente el catálogo de columnas que representan importes
- **THEN** ninguna usa un tipo de punto flotante

#### Scenario: Storage paths are scoped by organization

- **WHEN** se intenta leer un archivo de Storage cuya ruta pertenece a otra organización
- **THEN** la política lo rechaza

#### Scenario: The checklist result is documented

- **WHEN** se consulta la documentación del cambio
- **THEN** contiene los doce puntos del anexo con su resultado y, para los automatizables, la prueba que los verifica
