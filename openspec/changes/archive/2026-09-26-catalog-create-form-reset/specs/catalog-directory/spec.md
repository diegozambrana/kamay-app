## ADDED Requirements

### Requirement: Los formularios de alta del catálogo se abren en blanco

Cada vez que se abre el formulario de alta de ítem del catálogo (V10) —desde el botón «Nuevo insumo», «Nuevo producto» o «Nuevo activo», o desde la acción del vacío inicial— SHALL empezar sin ningún valor de un alta anterior: nombre, descripción, precio de venta referencial, mínimo y atributos vacíos; sin foto elegida; unidad y categoría sin elegir; y sin mensaje de error. La línea inicial SHALL ser la del filtro de línea vigente del catálogo al abrirse, o «Compartido» cuando el filtro no fija una línea, y el tipo SHALL ser el de la pestaña activa al abrirse. Esto SHALL cumplirse sin importar cómo se cerró la apertura anterior: tras guardar con éxito, tras cancelar o cerrar con datos a medio llenar, o tras un error de validación o de guardado.

El formulario de alta de variante del detalle de ítem (V11) SHALL seguir la misma regla: cada apertura empieza sin los valores, los atributos ni el error de una apertura anterior.

Los formularios de edición de ítem y de variante SHALL seguir abriéndose con los datos del registro que se edita.

#### Scenario: La foto del producto anterior no pasa al siguiente

- **WHEN** el usuario crea un producto con una foto y, a continuación, pulsa «Nuevo producto» otra vez
- **THEN** el formulario no tiene ninguna foto elegida, y guardar el segundo producto sin elegir foto no le sube ninguna

#### Scenario: Los datos del alta anterior no se conservan

- **WHEN** el usuario crea un insumo con línea «Impresión 3D», unidad «kg» y categoría «Filamento», con el filtro de línea en «Todas», y vuelve a pulsar «Nuevo insumo»
- **THEN** el formulario tiene el nombre vacío, la línea en «Compartido», y la unidad y la categoría sin elegir

#### Scenario: Cancelar descarta lo llenado

- **WHEN** el usuario abre «Nuevo producto», escribe un nombre, elige una foto y una categoría, cierra el diálogo sin guardar y lo vuelve a abrir
- **THEN** el formulario está en blanco y sin foto

#### Scenario: El error anterior no reaparece

- **WHEN** un alta falla con un mensaje de error, el usuario cierra el diálogo y lo vuelve a abrir
- **THEN** el formulario no muestra ningún mensaje de error

#### Scenario: El alta toma la pestaña vigente

- **WHEN** el usuario abre «Nuevo insumo», elige una categoría de insumo, cierra el diálogo, cambia a la pestaña de productos y pulsa «Nuevo producto»
- **THEN** el formulario es de producto y la categoría está sin elegir

#### Scenario: El alta toma la línea filtrada vigente

- **WHEN** el usuario filtra el catálogo por la línea «Tazas» y pulsa el botón de alta
- **THEN** el formulario se abre con la línea «Tazas» elegida, aunque el alta anterior se hiciera con otra línea

#### Scenario: El alta de variante empieza en blanco

- **WHEN** el usuario añade una variante con nombre y atributos a un ítem y vuelve a pulsar el alta de variante
- **THEN** el formulario de variante tiene el nombre y los atributos vacíos y ningún mensaje de error

#### Scenario: La edición sigue trayendo los datos del registro

- **WHEN** el usuario, después de crear un producto con foto, elige «Editar» en la fila de otro producto
- **THEN** el formulario muestra los datos de ese otro producto y ninguna foto nueva elegida
