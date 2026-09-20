# tenant-tools Specification

## Purpose

Permite que una organización active herramientas que el núcleo de Kamay no trae, elegidas de un catálogo igual para todas, sin que ninguna pueda alterar cómo funciona la plataforma: una herramienta es código revisado de este repositorio, solo guarda sus parámetros, y todo lo que produce entra por las operaciones que el núcleo ya ofrece.

> Origen: `specs/PRD/kamay-backlog-sprint-01.md` — KAM-27; `specs/PRD/kamay-especificacion-producto-v6.md` — §6.1 (concepto *Herramienta*), V4 y V15; `specs/PRD/ARCHITECTURE.md` (convenciones 1, 2, 3, 4, 7 y 11).

## Requirements

### Requirement: La activación de herramientas se guarda por organización

El sistema SHALL guardar, por organización y por herramienta, una sola fila con el identificador (`slug`) de la herramienta, sus parámetros y su marca de archivado. Una herramienta está **activa** para una organización cuando su fila existe y no está archivada. Desactivar SHALL archivar la fila, nunca borrarla, y SHALL conservar sus parámetros; reactivar SHALL devolverla con los mismos parámetros. No SHALL existir más de una fila por organización y herramienta. La activación es por organización: no SHALL variar por línea de negocio.

#### Scenario: Activar por primera vez

- **WHEN** la dueña activa una herramienta que su organización nunca tuvo
- **THEN** la herramienta queda activa con los parámetros por defecto de su manifiesto

#### Scenario: Desactivar conserva los parámetros

- **WHEN** la dueña cambia un parámetro de una herramienta activa, la desactiva y la vuelve a activar
- **THEN** la herramienta vuelve con el parámetro que ella había dejado, no con el valor por defecto

#### Scenario: No hay duplicados

- **WHEN** se intenta crear una segunda fila para la misma organización y la misma herramienta
- **THEN** la base la rechaza

### Requirement: Solo la dueña lee y escribe la activación; los miembros solo saben qué está activo

Las filas de activación SHALL ser legibles y modificables únicamente por la dueña de la organización, porque los parámetros de una herramienta pueden contener costos y márgenes. No SHALL existir política de borrado. Cualquier miembro de la organización SHALL poder conocer únicamente **los identificadores de las herramientas activas** de su organización, sin sus parámetros. Nadie SHALL obtener filas ni identificadores de una organización a la que no pertenece.

#### Scenario: Aislamiento entre organizaciones

- **WHEN** la organización A tiene una herramienta activa y una persona de la organización B consulta las activaciones
- **THEN** obtiene cero filas y cero identificadores de A

#### Scenario: El ayudante no lee parámetros

- **WHEN** un ayudante consulta las filas de activación de su propia organización
- **THEN** obtiene cero filas

#### Scenario: El ayudante sí sabe qué está activo

- **WHEN** un ayudante pide los identificadores de las herramientas activas de su organización
- **THEN** recibe los identificadores, sin parámetros

#### Scenario: Nadie borra

- **WHEN** la dueña intenta borrar una fila de activación
- **THEN** la base lo rechaza

### Requirement: Activar, desactivar y cambiar parámetros queda en la bitácora

Cada activación, desactivación, reactivación y cambio de parámetros SHALL quedar registrado en la bitácora de actividad de la organización por el mismo mecanismo que el resto de las tablas.

#### Scenario: Cambio de parámetros

- **WHEN** la dueña guarda parámetros nuevos de una herramienta
- **THEN** la bitácora registra una modificación de esa activación con el antes y el después

#### Scenario: Desactivación

- **WHEN** la dueña desactiva una herramienta
- **THEN** la bitácora registra el archivado de esa activación

### Requirement: La activación sale en la exportación

La tabla de activaciones SHALL formar parte de la exportación completa de la organización, con sus columnas declaradas, y SHALL salir solo en la exportación de la dueña.

#### Scenario: El manifiesto de exportación la incluye

- **WHEN** se compara el manifiesto de exportación con el catálogo de la base
- **THEN** la tabla de activaciones y todas sus columnas están declaradas

#### Scenario: El ayudante no la recibe

- **WHEN** un ayudante genera su exportación
- **THEN** el archivo de activaciones de herramientas no aparece

### Requirement: Las herramientas disponibles salen de un registro en código

El conjunto de herramientas que existen SHALL estar definido en el código del repositorio y SHALL ser el mismo para todas las organizaciones. Nada de lo que una herramienta hace SHALL resolverse en tiempo de ejecución a partir de datos guardados: los datos solo dicen **cuál** está activa y **con qué parámetros**. Una fila de activación cuyo identificador ya no corresponde a ninguna herramienta del registro SHALL ignorarse en el catálogo, en la navegación y en los puntos de enganche, sin que ninguna pantalla falle.

#### Scenario: Catálogo igual para todas

- **WHEN** dos organizaciones distintas abren el catálogo
- **THEN** ven la misma lista de herramientas

#### Scenario: Herramienta retirada del registro

- **WHEN** una organización tiene activa una herramienta cuyo identificador ya no está en el registro
- **THEN** la herramienta no aparece en el catálogo, en el menú ni en el detalle del pedido, su dirección responde «no encontrada», y el resto de las pantallas funciona

### Requirement: Cada herramienta declara su contrato

Toda herramienta del registro SHALL declarar: identificador único, nombre, descripción para el catálogo, rol mínimo que puede usarla (`owner` o `assistant`), sus puntos de enganche, sus capacidades (si sale a internet, si guarda credenciales, qué produce), el esquema de sus **parámetros** con valores por defecto, el esquema de sus **entradas**, el esquema de sus **salidas**, y sus **tablas relacionadas**: las que lee y aquellas sobre las que escribe, nombrando la operación del núcleo por la que lo hace. En este cambio ninguna herramienta SHALL declarar que sale a internet ni que guarda credenciales.

El contrato SHALL verificarse automáticamente sobre **todas** las herramientas del registro, de modo que una herramienta nueva quede cubierta sin escribir pruebas de contrato propias:

- los identificadores son únicos y con forma de `slug`;
- los valores por defecto cumplen el esquema de parámetros;
- una ejecución con los casos de referencia de la herramienta produce una salida que cumple el esquema de salidas;
- toda tabla relacionada existe en el manifiesto de exportación;
- toda operación del núcleo que la herramienta usa está declarada, y toda la declarada se usa;
- los puntos de enganche pertenecen a la lista cerrada.

#### Scenario: Valores por defecto inválidos

- **WHEN** una herramienta declara un valor por defecto que su propio esquema de parámetros rechaza
- **THEN** la verificación del contrato falla y nombra la herramienta

#### Scenario: Tabla relacionada que no existe

- **WHEN** una herramienta declara una tabla relacionada que no está en el manifiesto de exportación
- **THEN** la verificación del contrato falla

#### Scenario: Operación usada y no declarada

- **WHEN** el código de una herramienta usa una operación del núcleo que su manifiesto no declara
- **THEN** la verificación del contrato falla y nombra la operación

#### Scenario: Identificador repetido

- **WHEN** dos herramientas declaran el mismo identificador
- **THEN** la verificación del contrato falla

### Requirement: Cada herramienta trae su documentación y sus pruebas

Toda herramienta SHALL traer, junto a su código, un documento `README.md` con estas secciones: qué hace, parámetros, entradas, salidas, tablas relacionadas, puntos de enganche y cómo se prueba. Las secciones de parámetros, entradas y salidas SHALL nombrar todos los campos de los esquemas correspondientes. Toda herramienta SHALL traer además pruebas unitarias propias de su lógica y un conjunto de casos de referencia. La verificación del contrato SHALL comprobar las tres cosas.

#### Scenario: Falta el README

- **WHEN** una herramienta del registro no trae su `README.md`
- **THEN** la verificación del contrato falla y nombra la herramienta

#### Scenario: El README quedó atrás

- **WHEN** se añade un campo al esquema de entradas de una herramienta y su README no lo nombra
- **THEN** la verificación del contrato falla y nombra el campo

#### Scenario: Falta la prueba propia

- **WHEN** una herramienta del registro no trae ningún archivo de prueba de su lógica
- **THEN** la verificación del contrato falla

### Requirement: Una herramienta no accede a los datos por su cuenta

Ningún archivo de una herramienta SHALL usar un cliente de base de datos, el cliente con privilegios de servicio, SQL, ni la capa de servicios del núcleo. Toda lectura le llega como dato ya resuelto por el núcleo, y toda escritura SHALL pasar por una operación del núcleo declarada en su manifiesto, con la sesión de la persona, su rol, el aislamiento de su organización y la bitácora. Una herramienta SHALL NOT tener tablas propias. La frontera SHALL verificarse automáticamente, incluidos los archivos todavía sin añadir al control de versiones.

#### Scenario: Importación prohibida

- **WHEN** un archivo del directorio de herramientas importa un cliente de base de datos o la capa de servicios
- **THEN** la verificación de la frontera falla y nombra el archivo

#### Scenario: Registro limpio

- **WHEN** se verifica la frontera sobre el registro tal como queda en este cambio
- **THEN** no hay ningún infractor

### Requirement: El catálogo vive en la configuración y es de la dueña

La configuración de la organización SHALL ofrecer una sección **Herramientas** en `/settings/tools`, reservada a la dueña por su propia guarda. La sección SHALL listar todas las herramientas del registro con su nombre, su descripción y si está activa, y SHALL ofrecer para cada una un detalle con lo que hace, sus capacidades dichas en lenguaje llano, el rol que puede usarla y dónde aparece. Desde ahí la dueña SHALL poder activarla, desactivarla —con confirmación— y editar sus parámetros.

#### Scenario: Organización sin herramientas

- **WHEN** la dueña de una organización sin herramientas activas abre `/settings/tools`
- **THEN** ve la calculadora de impresión 3D con su descripción y sus capacidades, marcada como no activa

#### Scenario: El ayudante no entra

- **WHEN** un ayudante abre `/settings/tools` por dirección directa
- **THEN** es enviado fuera y el contenido de la sección nunca se pinta

#### Scenario: Desactivar pide confirmación

- **WHEN** la dueña elige desactivar una herramienta
- **THEN** se le pide confirmar y se le dice que sus parámetros se conservan

### Requirement: Los parámetros se editan en un formulario derivado del esquema

El formulario de parámetros de una herramienta SHALL derivarse de su esquema de parámetros: un campo por parámetro, con su rótulo, su ayuda y su unidad, precargado con los valores de la organización. El formulario SHALL cubrir números, porcentajes, texto, sí/no, opciones cerradas y **listas de filas** cuyos campos sean de esos mismos tipos. Un valor que el esquema rechaza SHALL impedir guardar y SHALL mostrar el motivo junto al campo. La validación SHALL repetirse en el servidor con el mismo esquema.

#### Scenario: Guardar parámetros válidos

- **WHEN** la dueña cambia un parámetro por un valor válido y guarda
- **THEN** el valor queda guardado y la herramienta lo usa desde el siguiente cálculo

#### Scenario: Valor rechazado

- **WHEN** la dueña escribe un valor que el esquema rechaza y guarda
- **THEN** nada se guarda y el motivo aparece junto al campo

#### Scenario: Lista de filas

- **WHEN** un parámetro es una lista de filas
- **THEN** la dueña puede añadir, editar y quitar filas antes de guardar

#### Scenario: El servidor no confía en el formulario

- **WHEN** llega al servidor un guardado de parámetros que el esquema rechaza
- **THEN** el servidor lo rechaza aunque el formulario lo haya dejado pasar

### Requirement: Una herramienta activa tiene página propia

Toda herramienta que declare el enganche de página SHALL responder en `/extensions/<slug>` únicamente cuando esté en el registro, esté activa para la organización de la persona y el rol de la persona alcance el mínimo declarado. En cualquier otro caso la dirección SHALL responder «no encontrada», sin revelar si la herramienta existe para otra organización.

#### Scenario: Activa y con rol suficiente

- **WHEN** la dueña abre `/extensions/print-cost-3d` con la calculadora activa
- **THEN** la página de la herramienta se muestra

#### Scenario: No activa

- **WHEN** la calculadora está desactivada y alguien abre `/extensions/print-cost-3d`
- **THEN** obtiene «no encontrada»

#### Scenario: Activa en otra organización

- **WHEN** la organización A tiene la calculadora activa, la B no, y una persona de B abre `/extensions/print-cost-3d`
- **THEN** obtiene «no encontrada»

#### Scenario: Rol insuficiente

- **WHEN** un ayudante abre la página de una herramienta activa cuyo rol mínimo es `owner`
- **THEN** obtiene «no encontrada»

#### Scenario: Rol suficiente para el ayudante

- **WHEN** un ayudante abre la página de una herramienta activa cuyo rol mínimo es `assistant`
- **THEN** la página de la herramienta se muestra

### Requirement: La navegación muestra una sección Herramientas solo cuando hay algo que mostrar

El menú lateral SHALL mostrar una sección **Herramientas**, con una entrada por cada herramienta activa que declare página propia y que el rol de la persona pueda usar. Cuando no haya ninguna, la sección SHALL NOT aparecer, ni siquiera como título vacío. En el celular esas entradas SHALL vivir en el panel «Más» y nunca SHALL ocupar una ranura de la barra inferior. El menú lateral, la barra inferior y el panel «Más» SHALL seguir saliendo de una misma declaración.

#### Scenario: Sin herramientas activas

- **WHEN** una organización no tiene herramientas activas
- **THEN** el menú lateral no muestra ninguna sección «Herramientas»

#### Scenario: Con la calculadora activa

- **WHEN** la dueña activa la calculadora
- **THEN** el menú lateral muestra la sección «Herramientas» con la entrada de la calculadora, que lleva a `/extensions/print-cost-3d`

#### Scenario: Tras desactivar

- **WHEN** la dueña desactiva la única herramienta activa
- **THEN** la entrada y la sección desaparecen del menú

#### Scenario: El rol filtra

- **WHEN** un ayudante mira el menú y la única herramienta activa exige el rol `owner`
- **THEN** no ve la sección «Herramientas»

#### Scenario: En el celular

- **WHEN** la dueña abre el panel «Más» en un celular con la calculadora activa
- **THEN** la entrada de la calculadora está ahí y la barra inferior conserva sus tres ranuras de siempre

### Requirement: Los puntos de enganche son una lista cerrada

Una herramienta SHALL poder aparecer únicamente en dos lugares: su página propia y una acción en el detalle del pedido. Ninguna herramienta SHALL añadir nada al panel, al catálogo de ítems, a las tareas, a los egresos ni a ninguna otra pantalla.

#### Scenario: Enganche desconocido

- **WHEN** una herramienta declara un punto de enganche que no es ninguno de los dos
- **THEN** la verificación del contrato falla
