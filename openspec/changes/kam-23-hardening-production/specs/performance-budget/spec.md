# performance-budget Specification

## Purpose

Fija un presupuesto de carga verificable para la aplicación en el dispositivo real del taller —un móvil de gama media, con doce meses de datos acumulados— y las reglas que lo sostienen: ninguna lista se carga entera y las imágenes viajan optimizadas.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-23, alcance «rendimiento» y criterio 7; `specs/PRD/kamay-especificacion-producto-v6.md` §11 (rendimiento: la bitácora se consulta con filtros y por páginas, nunca se carga entera); `specs/PRD/ARCHITECTURE.md` (convención 4: nada derivado se almacena — los totales se derivan en vistas, y su costo entra en este presupuesto).

## ADDED Requirements

### Requirement: The dashboard loads within its budget on a mid-range phone

El panel principal MUST quedar utilizable en menos de **2 segundos** sobre un perfil de móvil de gama media con red móvil restringida, partiendo de una organización sembrada con **12 meses de datos**. La medición MUST ejecutarse de forma automática y reproducible, y MUST fallar si el presupuesto se supera.

#### Scenario: Dashboard meets the budget with a year of data

- **WHEN** se mide la carga del panel principal bajo el perfil de móvil de gama media contra una organización con doce meses de pedidos, egresos, cobros y tareas
- **THEN** el panel queda utilizable en menos de 2 segundos

#### Scenario: A regression fails the measurement

- **WHEN** un cambio hace que el panel principal supere el presupuesto bajo el mismo perfil y la misma semilla
- **THEN** la medición automática falla e identifica el presupuesto incumplido

### Requirement: The performance seed contains twelve months of data

MUST existir una semilla de rendimiento reproducible que genere una organización con doce meses de actividad —pedidos, egresos, cobros, tareas y bitácora— sobre la que se ejecuta la medición. La semilla MUST crear su propia organización, como toda prueba del proyecto.

#### Scenario: The seed produces a year of activity in its own organization

- **WHEN** se ejecuta la semilla de rendimiento
- **THEN** se crea una organización propia con registros distribuidos a lo largo de doce meses en cada dominio medido

### Requirement: No data view loads an entire table

Ninguna vista con datos MAY solicitar la totalidad de una tabla. Toda lista MUST pedir sus filas por páginas o por ventana acotada, con un límite explícito por petición, y MUST ofrecer al usuario la forma de traer el resto sin recargar la vista.

#### Scenario: A list requests a bounded page

- **WHEN** una vista de lista carga sus datos sobre una organización con muchos más registros que el límite de página
- **THEN** la petición devuelve como máximo el límite de página y la vista ofrece traer más

#### Scenario: The activity log is never loaded whole

- **WHEN** se consulta la bitácora sobre una organización con un volumen alto de eventos
- **THEN** la consulta se resuelve por página y filtros, y en ningún caso se solicitan todos los eventos

### Requirement: Images are served optimized

Las imágenes de catálogo y las miniaturas de adjuntos MUST servirse en un formato y a un tamaño adecuados al espacio donde se presentan, y MUST reservar su espacio en la disposición antes de cargarse para que el contenido no se desplace.

#### Scenario: A thumbnail is not the full-size image

- **WHEN** se presenta una miniatura de catálogo o de adjunto
- **THEN** la imagen transferida corresponde al tamaño en que se muestra y no al archivo original completo

#### Scenario: Layout does not shift on image load

- **WHEN** una vista con imágenes termina de cargarlas
- **THEN** el contenido alrededor no se desplaza respecto de la posición que ocupaba antes
