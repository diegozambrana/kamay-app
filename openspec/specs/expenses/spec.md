# expenses Specification

## Purpose

Registra todo lo que sale de caja —compras que traen insumos y gastos que no traen nada— en una sola bandeja, con su línea de negocio obligatoria y su comprobante. El total de una compra y el último costo de un insumo se derivan de las líneas del documento; nunca se almacenan.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-09; `specs/PRD/kamay-esquema-base-de-datos-supabase.md` §8, §11, §13, §16; `specs/PRD/kamay-especificacion-producto-v6.md` — §6.1 (reglas transversales), V7, V8 y V9; `specs/PRD/kamay-mapa-navegacion-ui.md` §10 y §11; `specs/PRD/ARCHITECTURE.md` (convención 2: `organization_id` en toda tabla; convención 4: nada derivado se almacena; convención 9: UUID y `occurred_at` del cliente).

## Requirements

### Requirement: Modelo de egreso con dos tipos en una sola tabla

El sistema SHALL almacenar compras y gastos en la tabla `expenses` según el esquema canónico, con `kind` restringido a `purchase` o `expense`, `business_line_id` obligatorio, y los campos opcionales `contact_id` (proveedor), `expense_category_id`, `order_id`, `amount`, `note` y `archived_at`. La restricción `purchase_needs_supplier` SHALL exigir `contact_id` cuando `kind = 'purchase'`; `expense_needs_category_and_amount` SHALL exigir `expense_category_id` y `amount` cuando `kind = 'expense'`; `purchase_has_no_own_amount` SHALL rechazar `amount` cuando `kind = 'purchase'`. La tabla SHALL admitir clave primaria generada por el cliente y `occurred_at` fijado por el cliente.

#### Scenario: Gasto sin categoría

- **WHEN** se intenta guardar una fila con `kind = 'expense'`, `amount` presente y `expense_category_id` nulo
- **THEN** la base de datos rechaza la operación por `expense_needs_category_and_amount`

#### Scenario: Gasto sin monto

- **WHEN** se intenta guardar una fila con `kind = 'expense'`, categoría presente y `amount` nulo
- **THEN** la base de datos rechaza la operación por `expense_needs_category_and_amount`

#### Scenario: Compra sin proveedor

- **WHEN** se intenta guardar una fila con `kind = 'purchase'` y `contact_id` nulo
- **THEN** la base de datos rechaza la operación por `purchase_needs_supplier`

#### Scenario: Compra con monto propio

- **WHEN** se intenta guardar una fila con `kind = 'purchase'` y `amount` distinto de nulo
- **THEN** la base de datos rechaza la operación por `purchase_has_no_own_amount`

#### Scenario: Egreso sin línea de negocio

- **WHEN** se intenta guardar un egreso de cualquier tipo con `business_line_id` nulo
- **THEN** la base de datos rechaza la operación

#### Scenario: Identificador y fecha del hecho fijados por el cliente

- **WHEN** se guarda un gasto con un `id` generado por el cliente y un `occurred_at` de ayer
- **THEN** la fila conserva ese `id` y ese `occurred_at`, y `created_at` lo fija el servidor

### Requirement: Líneas de compra con precio propio

El sistema SHALL almacenar las líneas de una compra en la tabla `expense_items`, cada una con `item_id` obligatorio, `variant_id` opcional, `quantity` mayor que cero y `unit_price` mayor o igual a cero. El `unit_price` SHALL quedar registrado en la línea de la compra, de modo que una compra posterior del mismo ítem a otro precio no altere ninguna compra anterior.

#### Scenario: Cantidad no positiva

- **WHEN** se intenta guardar una línea con `quantity` igual a cero o negativa
- **THEN** la base de datos rechaza la operación

#### Scenario: Precio negativo

- **WHEN** se intenta guardar una línea con `unit_price` negativo
- **THEN** la base de datos rechaza la operación

#### Scenario: El precio de una compra posterior no reescribe la anterior

- **WHEN** se registra una segunda compra del mismo insumo a un precio distinto
- **THEN** la línea de la primera compra conserva el `unit_price` con el que se registró

### Requirement: Una compra necesita al menos una línea

El sistema SHALL rechazar guardar una compra sin al menos una línea de insumo, tanto en el formulario —señalando el problema antes de enviar— como en la operación de guardado del servidor, que SHALL rechazar la compra y no dejar ninguna fila a medias.

#### Scenario: Intento desde el formulario

- **WHEN** se intenta guardar el formulario de compra con proveedor pero sin ninguna línea
- **THEN** se impide con un mensaje claro que señala la tabla de insumos y nada se envía

#### Scenario: Intento contra la operación de guardado

- **WHEN** la operación de guardado recibe una compra con proveedor y una lista de líneas vacía
- **THEN** la rechaza y no existe ninguna fila nueva en `expenses` ni en `expense_items`

#### Scenario: Guardado atómico

- **WHEN** una línea de la compra es inválida y las demás no
- **THEN** no se guarda ni el encabezado ni ninguna de las líneas

### Requirement: El total del egreso se deriva, nunca se almacena

El sistema SHALL exponer el total de cada egreso a través de la vista `expense_totals`, declarada con `security_invoker = true`: para un gasto, su `amount`; para una compra, la suma de `quantity * unit_price` de sus líneas. Ninguna columna de `expenses` SHALL almacenar total, pagado, saldo ni estado de pago.

#### Scenario: Total de una compra con líneas

- **WHEN** una compra tiene dos líneas de 3 × 25 y 1 × 40
- **THEN** `expense_totals` devuelve 115 como total de esa compra

#### Scenario: Total de un gasto

- **WHEN** un gasto tiene `amount = 80`
- **THEN** `expense_totals` devuelve 80 como total de ese gasto

#### Scenario: Compra sin líneas registrada por semilla

- **WHEN** una compra existe sin ninguna línea
- **THEN** `expense_totals` devuelve 0 como total, no nulo

#### Scenario: Coincide con la suma manual

- **WHEN** se suma a mano `quantity * unit_price` de las líneas de cada compra sembrada
- **THEN** el resultado coincide con el `total` que devuelve `expense_totals` para cada una

#### Scenario: Ninguna columna almacena el derivado

- **WHEN** se inspecciona la definición de la tabla `expenses`
- **THEN** no existe ninguna columna de total, pagado, saldo ni estado de pago

### Requirement: El último costo de un ítem se deriva de sus compras

El sistema SHALL exponer, en la vista `item_last_cost` declarada con `security_invoker = true`, el último `unit_price` pagado por cada ítem, junto con la fecha de esa compra y su proveedor. "Último" SHALL decidirse por el `occurred_at` de la compra, no por el orden de registro. Las compras archivadas SHALL NOT contar. Un ítem nunca comprado SHALL NOT tener fila.

#### Scenario: Comprado dos veces

- **WHEN** un insumo se compró a 10 con `occurred_at` de marzo y luego a 12 con `occurred_at` de febrero, registrada esta segunda después
- **THEN** `item_last_cost` devuelve 10, la compra de marzo, aunque se registró antes

#### Scenario: Nunca comprado

- **WHEN** un insumo del catálogo no figura en ninguna compra
- **THEN** `item_last_cost` no devuelve ninguna fila para él

#### Scenario: La compra archivada no cuenta

- **WHEN** se archiva la compra más reciente de un insumo
- **THEN** `item_last_cost` pasa a devolver el precio de la compra anterior vigente

#### Scenario: El ayudante no obtiene costos

- **WHEN** un usuario con rol de ayudante consulta `item_last_cost`
- **THEN** obtiene cero filas

### Requirement: Pista del último precio en el formulario de compra

El formulario de compra SHALL mostrar, junto al campo de precio de cada insumo que ya se compró antes, su último precio conocido con la fecha y el proveedor de esa compra, **como pista**. El campo de precio SHALL permanecer vacío hasta que la persona lo escriba: el sistema SHALL NOT autocompletarlo. Un insumo nunca comprado SHALL NOT mostrar pista.

#### Scenario: Insumo comprado antes

- **WHEN** se agrega a la compra un insumo con fila en `item_last_cost`
- **THEN** junto al precio aparece "Último: <precio> · <fecha> · <proveedor>" y el campo de precio sigue vacío

#### Scenario: Insumo nuevo

- **WHEN** se agrega a la compra un insumo nunca comprado
- **THEN** no aparece ninguna pista y el campo de precio está vacío

#### Scenario: La pista no cambia el valor

- **WHEN** la persona escribe 9.50 en el precio de un insumo cuya pista dice 12
- **THEN** se guarda 9.50 y la pista sigue mostrando 12

### Requirement: Formulario de compra (V8)

El formulario de compra SHALL pedir proveedor —con creación al vuelo desde el propio buscador—, fecha del hecho con el día de hoy por defecto, línea de negocio preseleccionada desde la línea activa, una tabla editable de insumos con cantidad y precio unitario por fila, un comprobante opcional y una nota opcional. SHALL mostrar el total calculado en vivo desde las filas. SHALL impedir guardar sin proveedor, sin línea o sin al menos una fila válida, señalando el campo. Al guardar SHALL volver a la bandeja de egresos con la compra visible.

#### Scenario: Compra completa

- **WHEN** se elige un proveedor, se agregan dos insumos con cantidad y precio y se guarda
- **THEN** la compra aparece en la bandeja con su total igual a la suma de las filas

#### Scenario: Sin proveedor

- **WHEN** se intenta guardar con insumos pero sin proveedor
- **THEN** se impide con un mensaje que señala el campo de proveedor

#### Scenario: Proveedor nuevo al vuelo

- **WHEN** se escribe el nombre de un proveedor que no existe y se elige crearlo
- **THEN** se crea con rol de proveedor, queda seleccionado y el formulario conserva las filas ya cargadas

#### Scenario: El total sigue a las filas

- **WHEN** se cambia la cantidad de una fila de 2 a 5
- **THEN** el total mostrado se actualiza sin recargar

#### Scenario: Quitar una fila

- **WHEN** se quita una de tres filas antes de guardar
- **THEN** el total se recalcula y la compra se guarda con dos líneas

### Requirement: Formulario de gasto (V9)

El formulario de gasto SHALL ser deliberadamente corto: el monto SHALL ser el campo dominante y recibir el foco al abrir; las categorías vigentes SHALL ofrecerse como chips de un solo toque; la línea SHALL venir preseleccionada desde la línea activa, y cuando la línea activa sea "Todas" SHALL preseleccionarse la línea compartida (General); la fecha SHALL ser hoy por defecto; nota y comprobante SHALL ser opcionales; la asignación a un pedido SHALL estar plegada y ser opcional. SHALL impedir guardar sin monto, sin categoría o sin línea. Registrar un gasto mínimo SHALL requerir cinco interacciones o menos desde la bandeja, medidas en la prueba de extremo a extremo.

#### Scenario: Gasto mínimo en cinco interacciones o menos

- **WHEN** desde la bandeja se abre el formulario, se escribe el monto, se toca una categoría y se guarda
- **THEN** el gasto queda registrado y la prueba cuenta cinco interacciones o menos

#### Scenario: Sin monto

- **WHEN** se intenta guardar con categoría y línea pero sin monto
- **THEN** se impide con un mensaje que señala el monto

#### Scenario: Sin categoría

- **WHEN** se intenta guardar con monto y línea pero sin categoría
- **THEN** se impide con un mensaje que señala las categorías

#### Scenario: Línea activa "Todas"

- **WHEN** se abre el formulario con la línea activa en "Todas"
- **THEN** la línea compartida (General) aparece preseleccionada y puede cambiarse

#### Scenario: Línea activa concreta

- **WHEN** se abre el formulario con Alfarería activa
- **THEN** Alfarería aparece preseleccionada

#### Scenario: Asignar a un pedido

- **WHEN** se despliega "asignar a un pedido", se elige el pedido #12 y se guarda
- **THEN** el gasto queda con ese `order_id` y su detalle enlaza al pedido

### Requirement: Un gasto de la línea General queda disponible para el reparto posterior

Un gasto registrado en la línea compartida (`is_shared = true`) SHALL guardarse bajo esa línea y bajo ninguna otra. El sistema SHALL NOT asignarlo ni repartirlo entre las líneas concretas: `expense_totals` SHALL devolverlo con la línea compartida como `business_line_id`, para que el reparto proporcional de los reportes lo tome de ahí.

#### Scenario: Gasto en General

- **WHEN** se registra un gasto en la línea General
- **THEN** `expense_totals` lo devuelve con `business_line_id` igual al de la línea compartida

#### Scenario: Filtrado por una línea concreta

- **WHEN** la bandeja se ve con Sublimación activa
- **THEN** el gasto de General no aparece ni suma en los totales del periodo

#### Scenario: Filtrado por "Todas"

- **WHEN** la bandeja se ve con "Todas" activa
- **THEN** el gasto de General aparece y suma en los totales del periodo

### Requirement: Comprobante comprimido en el cliente y subido en segundo plano

El sistema SHALL aceptar un comprobante fotográfico (JPEG, PNG, WebP o AVIF) de hasta 20 MB de entrada, SHALL comprimirlo en el navegador hasta que pese 5 MB o menos antes de subirlo, y SHALL subirlo al bucket privado `receipts` como adjunto del egreso con `entity_type = 'expense'`. El guardado del egreso SHALL NOT esperar a la compresión ni a la subida: el egreso SHALL aparecer en la bandeja de inmediato, con un indicador mientras el comprobante sube. Si la subida falla, el sistema SHALL avisar y permitir reintentarla desde el detalle. Un egreso sin comprobante SHALL guardarse igual.

#### Scenario: Foto de 8 MB

- **WHEN** se adjunta una foto de 8 MB y se guarda el gasto
- **THEN** el archivo que llega al bucket pesa 5 MB o menos

#### Scenario: El guardado no espera

- **WHEN** se guarda un gasto con una foto adjunta
- **THEN** el gasto aparece en la bandeja antes de que la subida termine, con un indicador de comprobante en curso

#### Scenario: La subida falla

- **WHEN** la subida del comprobante falla después de guardar el egreso
- **THEN** el egreso sigue guardado, se muestra un aviso y el detalle ofrece volver a adjuntar

#### Scenario: Formato no admitido

- **WHEN** se intenta adjuntar un archivo que no es una imagen admitida
- **THEN** se rechaza antes de guardar con un mensaje que nombra los formatos válidos

#### Scenario: Solo la propia organización ve el comprobante

- **WHEN** un miembro de otra organización intenta leer el objeto del comprobante por su ruta
- **THEN** la lectura se rechaza

### Requirement: Bandeja de egresos (V7)

La bandeja SHALL ser una página completa, solo del dueño, con compras y gastos en una sola lista cronológica descendente por `occurred_at`. Cada fila SHALL mostrar fecha, tipo, proveedor (compra) o categoría (gasto), línea y monto total. SHALL filtrar por tipo, proveedor, categoría y periodo —el mes en curso por defecto—, además de la línea activa del selector global, y SHALL mostrar los totales del periodo filtrado: compras, gastos y total. Los filtros SHALL vivir en la dirección para que la bandeja sea enlazable. SHALL ofrecer "Ver archivados", desactivado por defecto. La fila SHALL abrir el detalle en un panel lateral. En móvil SHALL mostrar tarjetas apiladas en vez de tabla.

#### Scenario: Periodo por defecto y totales

- **WHEN** se abre la bandeja sin filtros
- **THEN** muestra los egresos del mes en curso y sus totales coinciden con la suma manual de los `total` de `expense_totals` de ese periodo

#### Scenario: Filtro por tipo

- **WHEN** se filtra por "Gastos"
- **THEN** solo aparecen filas con `kind = 'expense'` y los totales se recalculan sobre ellas

#### Scenario: Filtro por proveedor

- **WHEN** se filtra por un proveedor
- **THEN** solo aparecen sus compras

#### Scenario: La línea activa filtra

- **WHEN** se cambia el selector global a Alfarería
- **THEN** la bandeja muestra solo egresos de Alfarería y los totales se recalculan

#### Scenario: Archivados ocultos por defecto

- **WHEN** se abre la bandeja sin activar "Ver archivados"
- **THEN** los egresos con `archived_at` no aparecen ni suman

#### Scenario: Ver archivados

- **WHEN** se activa "Ver archivados"
- **THEN** los egresos archivados aparecen distinguidos de los vigentes

#### Scenario: Abrir el detalle

- **WHEN** se activa una fila
- **THEN** se abre el detalle de ese egreso en un panel lateral sin abandonar la bandeja

#### Scenario: Móvil

- **WHEN** la bandeja se ve en un ancho de móvil
- **THEN** cada egreso es una tarjeta apilada con los mismos datos

### Requirement: Detalle del egreso

El detalle SHALL mostrar tipo, fecha del hecho, proveedor enlazado a su ficha (compra) o categoría (gasto), línea, las líneas de compra con cantidad y precio unitario, el total derivado, la nota, el pedido asignado enlazado si existe, los comprobantes y el historial leído de la bitácora. SHALL permitir archivar y desarchivar, y adjuntar un comprobante. El mismo detalle SHALL abrirse por enlace directo en `/expenses/[id]`.

#### Scenario: Compra completa

- **WHEN** se abre el detalle de una compra con líneas y comprobante
- **THEN** se muestran sus líneas, el total calculado y el comprobante

#### Scenario: Gasto asignado a un pedido

- **WHEN** se abre el detalle de un gasto con `order_id`
- **THEN** muestra el número del pedido enlazado a su detalle

#### Scenario: Historial

- **WHEN** un egreso se registró y luego se archivó
- **THEN** su historial muestra ambos eventos en orden cronológico, leídos de la bitácora

#### Scenario: Enlace directo

- **WHEN** se abre `/expenses/<id>` de un egreso de la propia organización
- **THEN** se muestra el mismo detalle que el panel de la bandeja

### Requirement: Aislamiento, roles y archivado de egresos

Las tablas `expenses` y `expense_items` SHALL tener RLS activo y políticas solo para el dueño de la organización: el ayudante SHALL NOT leer, crear ni editar egresos ni líneas, y SHALL obtener cero filas de `expense_totals` e `item_last_cost`. Ninguna de las dos tablas SHALL tener política `DELETE`. Un egreso SHALL retirarse marcando `archived_at`, nunca eliminándose; un egreso archivado SHALL NOT editarse sin desarchivarlo, y SHALL desaparecer de `expense_totals` y de `item_last_cost` mientras esté archivado.

#### Scenario: El ayudante consulta egresos

- **WHEN** un usuario con rol de ayudante consulta `expenses`, `expense_items` o `expense_totals` de su organización
- **THEN** obtiene cero filas

#### Scenario: El ayudante intenta registrar

- **WHEN** un ayudante intenta insertar un gasto en su organización
- **THEN** la operación se rechaza

#### Scenario: Miembro de otra organización

- **WHEN** un dueño consulta egresos de una organización a la que no pertenece
- **THEN** no obtiene ninguna fila

#### Scenario: Intento de borrado

- **WHEN** un dueño intenta eliminar un egreso o una de sus líneas
- **THEN** la operación se rechaza porque no existe política `DELETE`

#### Scenario: El egreso archivado conserva su historia

- **WHEN** se archiva una compra
- **THEN** desaparece de la bandeja activa y de `expense_totals`, pero sigue consultable con "Ver archivados" con sus líneas y su historial intactos

#### Scenario: Desarchivar

- **WHEN** se desarchiva esa compra
- **THEN** vuelve a la bandeja activa, a `expense_totals` y a `item_last_cost` con los mismos datos

### Requirement: Egresos solo en el menú del dueño y redirección por dirección directa

La entrada "Egresos" SHALL aparecer en el menú del dueño y SHALL NOT aparecer en el del ayudante. Un ayudante que abra por dirección directa `/expenses`, `/expenses/purchases/new`, `/expenses/costs/new` o `/expenses/<id>` SHALL ser redirigido a su aterrizaje habitual, sin pantalla de "no autorizado".

#### Scenario: Menú del ayudante

- **WHEN** un ayudante abre la aplicación
- **THEN** su menú no contiene "Egresos"

#### Scenario: Ayudante por dirección directa

- **WHEN** un ayudante abre `/expenses/costs/new` escribiendo la dirección
- **THEN** termina en su aterrizaje habitual

#### Scenario: Menú del dueño

- **WHEN** un dueño abre la aplicación
- **THEN** su menú contiene "Egresos" y lleva a la bandeja

### Requirement: Semilla de egresos de Geeko Store

Tras reiniciar la base de datos local, la organización de ejemplo SHALL contar con egresos suficientes para ejercitar las tres pantallas y las pruebas sin capturar datos a mano: al menos una compra con varias líneas, un insumo comprado dos veces a precios distintos y en fechas distintas, un gasto en la línea General, un gasto asignado a un pedido y un egreso archivado.

#### Scenario: Reinicio local

- **WHEN** se ejecuta `supabase db reset`
- **THEN** existen en Geeko Store los egresos descritos, y una prueba de base de datos verifica que sigan existiendo
