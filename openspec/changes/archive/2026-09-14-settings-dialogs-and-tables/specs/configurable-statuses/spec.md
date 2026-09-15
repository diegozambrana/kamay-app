## MODIFIED Requirements

### Requirement: Pantalla de configuración de estados (V22)

El sistema SHALL ofrecer una pantalla de configuración de estados accesible solo para el dueño, con: selector de flujo (Pedidos / Tareas) y de alcance (organización o línea específica); lista ordenable por arrastre con nombre, color, tipo declarado y marca opcional de "columna en cola"; agregar; editar; archivar pidiendo a dónde mover lo que quedaba; restaurar valores por defecto; *usar el juego de la organización* (descartar el juego propio de la línea); y el aviso visible "Los cambios no afectan la historia de pedidos y tareas anteriores". La pantalla SHALL validar al menos un `initial` y un `final` antes de enviar.

La lista SHALL seguir siendo una lista ordenable por arrastre (no una tabla). Cada fila SHALL conservar su asa de arrastre y SHALL ofrecer sus acciones —«Editar» y «Archivar»— solo desde un menú «⋯» al final de la fila, cuyo nombre accesible identifica el estado; la fila SHALL NOT tener botones de acción sueltos ni desplegar formularios dentro de sí.

- *Agregar* («Agregar estado») y *Editar* SHALL abrir un diálogo con el formulario —nombre, tipo, color y «Columna en cola»—, su botón de acción y «Cancelar». Si la validación del juego o el servidor lo rechazan, el diálogo SHALL quedarse abierto con lo escrito y mostrar el error dentro.
- *Archivar* SHALL abrir un diálogo de confirmación que contiene la elección de a dónde mover los registros que usaban el estado; el estado solo se archiva al pulsar «Archivar estado».
- *Restaurar valores por defecto*, *Crear el juego por defecto*, *Crear juego propio para esta línea* y *Usar el juego de la organización* SHALL pedir confirmación en un diálogo que explique la consecuencia, con el botón de la acción y «Cancelar»; «Cancelar» no cambia nada.

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

#### Scenario: Las acciones de un estado están en su menú

- **WHEN** el dueño abre el menú «⋯» de un estado activo
- **THEN** el menú ofrece «Editar» y «Archivar», y la fila no muestra otros botones de acción

#### Scenario: Editar un estado en un diálogo

- **WHEN** el dueño elige «Editar» en un estado, cambia su nombre en el diálogo y pulsa «Guardar cambios»
- **THEN** el diálogo se cierra y la fila muestra el nombre nuevo

#### Scenario: El diálogo no deja un juego sin estado final

- **WHEN** el dueño edita el único estado de tipo final de un juego y le pone otro tipo
- **THEN** el diálogo se queda abierto y avisa que todo juego necesita al menos un estado inicial y uno final, y nada se guarda

#### Scenario: Archivar pide a dónde mover dentro de la confirmación

- **WHEN** el dueño elige «Archivar» en un estado
- **THEN** se abre un diálogo de confirmación con la elección de a dónde mover los registros que lo usaban, y el estado no se archiva hasta pulsar «Archivar estado»

#### Scenario: Cancelar la restauración no cambia nada

- **WHEN** el dueño pulsa «Restaurar valores por defecto» y luego «Cancelar» en el diálogo de confirmación
- **THEN** el juego de estados queda exactamente como estaba
