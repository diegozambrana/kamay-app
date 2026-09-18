## MODIFIED Requirements

### Requirement: Cliente creado al vuelo desde el pedido

El cliente del pedido SHALL elegirse desde un diálogo, sin abandonar el formulario. Sin cliente elegido, el campo SHALL mostrar un botón «Seleccionar cliente» que abre el diálogo. Con cliente elegido, el campo SHALL mostrar su nombre y, a su lado, dos acciones con nombre accesible: «Cambiar cliente», que abre el diálogo, y «Quitar cliente», que deja el pedido sin cliente.

El diálogo SHALL listar los contactos vigentes con rol de cliente, con un campo de filtro por nombre tolerante a acentos y mayúsculas, y SHALL permitir elegir uno solo. Su pie SHALL ofrecer «Cancelar», que cierra el diálogo sin cambiar el cliente del pedido, y «Seleccionar cliente», deshabilitado mientras no haya uno elegido, que lo asigna al pedido y cierra el diálogo. Al abrirlo para cambiar, el cliente actual SHALL aparecer marcado.

El diálogo SHALL ofrecer siempre la opción «Registrar nuevo cliente» y, cuando el filtro no coincide con ningún cliente, SHALL ofrecer además registrar el texto buscado. Ambas SHALL pasar el diálogo a un modo de registro con los campos nombre (obligatorio), teléfono, correo y dirección (opcionales); el nombre SHALL venir prellenado con el texto del filtro, o vacío si no había. En ese modo el pie SHALL ofrecer «Cancelar», que vuelve a la lista conservando el filtro, y «Crear y seleccionar». El contacto creado SHALL quedar marcado como cliente, seleccionado en el pedido, y el diálogo SHALL cerrarse. Si el registro falla —dato inválido, error del servidor o falta de conexión— el diálogo SHALL permanecer abierto en modo registro, con lo escrito intacto y un mensaje comprensible. El resto del formulario SHALL conservar lo que ya tenía en todos los casos.

#### Scenario: Sin cliente se ofrece seleccionarlo

- **WHEN** el usuario abre el formulario de nuevo pedido
- **THEN** el campo de cliente muestra el botón «Seleccionar cliente» y ningún nombre

#### Scenario: Elegir un cliente de la lista

- **WHEN** el usuario abre el diálogo, filtra por «colegio», marca «Colegio San Andrés» y pulsa «Seleccionar cliente»
- **THEN** el diálogo se cierra y el campo muestra «Colegio San Andrés» con las acciones «Cambiar cliente» y «Quitar cliente»

#### Scenario: Seleccionar deshabilitado sin elección

- **WHEN** el diálogo de cliente está abierto y no hay ningún cliente marcado
- **THEN** el botón «Seleccionar cliente» del diálogo está deshabilitado

#### Scenario: El filtro ignora acentos y mayúsculas

- **WHEN** el usuario escribe «andres» en el filtro del diálogo
- **THEN** la lista muestra «Colegio San Andrés»

#### Scenario: Solo se listan clientes vigentes

- **WHEN** el usuario abre el diálogo de cliente
- **THEN** la lista no incluye contactos archivados ni contactos que solo son proveedores

#### Scenario: Cancelar no cambia el cliente

- **WHEN** el pedido tiene a «Colegio San Andrés» como cliente, el usuario pulsa «Cambiar cliente», marca otro cliente y pulsa «Cancelar»
- **THEN** el diálogo se cierra y el cliente del pedido sigue siendo «Colegio San Andrés»

#### Scenario: Cambiar muestra el cliente actual marcado

- **WHEN** el pedido tiene un cliente y el usuario pulsa «Cambiar cliente»
- **THEN** el diálogo se abre con ese cliente marcado

#### Scenario: Quitar el cliente

- **WHEN** el pedido tiene un cliente y el usuario pulsa «Quitar cliente»
- **THEN** el campo vuelve a mostrar «Seleccionar cliente» y el intento de guardar se impide señalando el campo de cliente

#### Scenario: Sin coincidencias se ofrece registrar lo buscado

- **WHEN** el usuario escribe «Florería Luna» en el filtro y ningún cliente coincide
- **THEN** el diálogo ofrece registrar «Florería Luna»

#### Scenario: Registrar lo buscado prellena el nombre

- **WHEN** el usuario elige registrar «Florería Luna» desde la lista sin coincidencias
- **THEN** el diálogo muestra el formulario de registro con el nombre «Florería Luna» y los botones «Cancelar» y «Crear y seleccionar»

#### Scenario: Registrar sin buscar primero

- **WHEN** el usuario abre el diálogo y, sin escribir nada, pulsa «Registrar nuevo cliente»
- **THEN** el diálogo muestra el formulario de registro con el nombre vacío

#### Scenario: Creación con nombre y teléfono

- **WHEN** el usuario, en modo registro, indica nombre «Florería Luna» y un teléfono y pulsa «Crear y seleccionar»
- **THEN** el contacto se crea con ese nombre y ese teléfono, el diálogo se cierra, queda seleccionado como cliente del pedido y el usuario sigue en el formulario

#### Scenario: Nombre obligatorio al registrar

- **WHEN** el usuario, en modo registro, deja el nombre vacío y pulsa «Crear y seleccionar»
- **THEN** no se envía nada, el diálogo sigue abierto y el mensaje señala el nombre

#### Scenario: Cancelar el registro vuelve a la lista

- **WHEN** el usuario, en modo registro abierto desde el filtro «Florería Luna», pulsa «Cancelar»
- **THEN** el diálogo vuelve a la lista con el filtro «Florería Luna» y no se crea ningún contacto

#### Scenario: El registro fallido conserva lo escrito

- **WHEN** el usuario pulsa «Crear y seleccionar» y el servidor rechaza el registro o no hay conexión
- **THEN** el diálogo sigue en modo registro con los datos escritos y muestra un mensaje comprensible, y el pedido sigue sin ese cliente

#### Scenario: El formulario conserva lo escrito

- **WHEN** el usuario ya había agregado dos líneas y una nota y crea el cliente desde el diálogo
- **THEN** las dos líneas y la nota siguen en el formulario tras la creación

#### Scenario: El contacto es un cliente

- **WHEN** se crea un contacto desde el diálogo de cliente del pedido
- **THEN** aparece en el directorio con el rol de cliente marcado y con el correo y la dirección indicados

### Requirement: Líneas desde el catálogo con precio prellenado y editable

El formulario SHALL permitir agregar líneas desde el catálogo mediante un botón «Agregar del catálogo» que abre un diálogo. El diálogo SHALL listar los productos vigentes elegibles —los de la línea del pedido y los compartidos entre líneas— con un campo de filtro por nombre tolerante a acentos y mayúsculas, y SHALL permitir **selección múltiple**. Un producto con variantes vigentes SHALL presentarse como una opción por variante, identificada con el nombre del producto y de la variante, y SHALL NOT poder elegirse sin variante. Cada opción SHALL mostrar su precio de venta referencial cuando lo tiene. Marcar opciones y luego cambiar el filtro SHALL conservar lo ya marcado.

El pie del diálogo SHALL ofrecer «Cancelar» y «Agregar». «Agregar» SHALL estar deshabilitado mientras no haya ninguna opción marcada e indicar cuántas hay marcadas; al pulsarlo SHALL agregar una línea por cada opción marcada, en el orden de la lista, y cerrar el diálogo. «Cancelar» —y cualquier otro cierre del diálogo— SHALL descartar lo marcado sin agregar nada; al volver a abrirlo no SHALL haber nada marcado. Elegir un producto que ya está en el pedido SHALL agregar una línea más.

Cada línea agregada SHALL iniciar con cantidad 1 y con el precio de venta referencial de la variante elegida o, si no lo tiene, el del producto; sin precio referencial SHALL iniciar en 0. Cantidad y precio SHALL ser editables. Los botones «Agregar del catálogo» y «Línea libre» SHALL mostrarse juntos al final de la lista de líneas. «Línea libre» SHALL agregar una línea con descripción y sin producto, y cualquier línea SHALL admitir una descripción opcional. El formulario SHALL mostrar el total como suma de cantidad por precio de las líneas, recalculado al editar; ese total SHALL NOT enviarse ni guardarse.

#### Scenario: Elegir un producto prellena el precio

- **WHEN** el usuario abre «Agregar del catálogo», marca un producto sin variantes con precio de venta referencial 45 y pulsa «Agregar»
- **THEN** se agrega una línea con cantidad 1 y precio 45, ambos editables

#### Scenario: Selección múltiple

- **WHEN** el usuario marca tres productos en el diálogo y pulsa «Agregar»
- **THEN** el diálogo se cierra y el pedido tiene tres líneas nuevas, cada una con cantidad 1 y el precio referencial de su producto

#### Scenario: Agregar deshabilitado sin selección

- **WHEN** el diálogo de catálogo está abierto y no hay ninguna opción marcada
- **THEN** el botón «Agregar» está deshabilitado

#### Scenario: Cancelar descarta la selección

- **WHEN** el usuario marca dos productos y pulsa «Cancelar»
- **THEN** el diálogo se cierra, no se agrega ninguna línea y, al volver a abrirlo, no hay nada marcado

#### Scenario: El filtro conserva lo marcado

- **WHEN** el usuario marca «Taza blanca», cambia el filtro a «maceta», marca «Maceta de barro» y pulsa «Agregar»
- **THEN** se agregan las dos líneas

#### Scenario: El filtro ignora acentos y mayúsculas

- **WHEN** el usuario escribe «sublimacion» en el filtro del diálogo
- **THEN** la lista muestra «Taza para sublimación»

#### Scenario: Producto con variantes

- **WHEN** el usuario abre el diálogo y el catálogo tiene un producto con variantes vigentes
- **THEN** el producto aparece como una opción por variante y no como una opción sin variante, y al agregar una de ellas el precio se prellena desde esa variante, o desde el producto si la variante no tiene precio

#### Scenario: Producto sin precio referencial

- **WHEN** el usuario agrega un producto que no tiene precio de venta referencial
- **THEN** la línea se agrega con cantidad 1 y precio 0, editable

#### Scenario: Producto ya presente en el pedido

- **WHEN** el pedido ya tiene una línea de «Maceta de barro» y el usuario la vuelve a agregar desde el diálogo
- **THEN** el pedido queda con dos líneas de «Maceta de barro»

#### Scenario: Acciones al final de las líneas

- **WHEN** el formulario tiene líneas agregadas
- **THEN** los botones «Agregar del catálogo» y «Línea libre» aparecen juntos después de la última línea

#### Scenario: El precio editado es el que se guarda

- **WHEN** el usuario cambia el precio prellenado de 45 a 40 y guarda
- **THEN** la línea del pedido queda con precio 40 y el precio del producto en el catálogo sigue siendo 45

#### Scenario: Línea libre

- **WHEN** el usuario agrega una línea libre con descripción «Pieza a medida», cantidad 1 y precio 120
- **THEN** el pedido se guarda con esa línea sin producto asociado y el detalle la muestra con su descripción

#### Scenario: Productos fuera de alcance no se ofrecen

- **WHEN** el usuario abre el diálogo de catálogo en un pedido de Alfarería
- **THEN** la lista no ofrece productos archivados ni productos asignados exclusivamente a otra línea, y sí ofrece los compartidos

#### Scenario: El total en pantalla sigue a las líneas

- **WHEN** el formulario tiene una línea de 3 × 45 y el usuario cambia la cantidad a 4
- **THEN** el total mostrado pasa de 135 a 180 sin guardar nada
