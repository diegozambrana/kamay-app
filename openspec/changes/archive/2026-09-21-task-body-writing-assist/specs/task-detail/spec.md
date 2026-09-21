## ADDED Requirements

### Requirement: El editor ofrece mejorar la descripción con un modelo

El editor del cuerpo SHALL ofrecer una acción *Mejorar la descripción*, visible junto al resto de la barra de herramientas, solo cuando el borrador no está vacío y la organización activó la asistencia de redacción. Activarla SHALL abrir un panel que muestra la propuesta junto al texto actual del borrador, con *Aceptar* y *Descartar*; ninguna de las dos opciones SHALL alterar el borrador salvo *Aceptar*, y ninguna SHALL guardar el cuerpo por sí misma. El resto del ciclo de edición —*Guardar*, *Cancelar* y su confirmación cuando hay cambios sin guardar— SHALL seguir aplicándose sin cambios sobre un borrador que provenga de una propuesta aceptada.

#### Scenario: La acción aparece junto a la barra de herramientas

- **GIVEN** un editor abierto con un cuerpo no vacío, en una organización con la asistencia activada
- **WHEN** se observa la barra de herramientas del editor
- **THEN** la acción *Mejorar la descripción* está visible junto al resto de las herramientas

#### Scenario: La organización sin la asistencia activada no ve la acción

- **GIVEN** un editor abierto con un cuerpo no vacío, en una organización que no activó la asistencia
- **WHEN** se observa la barra de herramientas del editor
- **THEN** la acción *Mejorar la descripción* no aparece

#### Scenario: Cancelar tras aceptar una propuesta descarta también la propuesta

- **GIVEN** una propuesta aceptada que reemplazó el borrador del editor
- **WHEN** se pulsa *Cancelar* y se confirma el descarte
- **THEN** el editor se cierra y el cuerpo guardado de la tarea sigue siendo el que tenía antes de abrir el editor
