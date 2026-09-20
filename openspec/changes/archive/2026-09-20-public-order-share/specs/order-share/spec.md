## Purpose

Deja que un cliente vea su pedido —estado, líneas, total, imágenes— y deje un comentario desde un enlace de solo lectura, sin sesión y sin ver nunca un costo, un margen ni un dato de otro pedido.

## ADDED Requirements

### Requirement: Un enlace vigente por pedido, generado y revocado con sesión

El sistema SHALL almacenar en `order_shares` un enlace por pedido: `token_hash bytea` (sha256; el token en claro SHALL NOT guardarse), `expires_at`, `archived_at`, y quién lo generó. Generar, regenerar y revocar SHALL ser escrituras normales de la sesión que las hace, gobernadas por `is_member`, y SHALL NOT depender de ninguna función SQL para esas tres operaciones. Un pedido SHALL tener como máximo un enlace vigente a la vez.

#### Scenario: Generar deja un enlace vigente

- **WHEN** se genera un enlace para un pedido sin ninguno vigente
- **THEN** el pedido queda con exactamente un enlace vigente

#### Scenario: Regenerar invalida el anterior

- **WHEN** se regenera el enlace de un pedido que ya tenía uno vigente
- **THEN** el enlace anterior deja de resolver, y el nuevo sí

#### Scenario: Revocar es archivar, nunca borrar

- **WHEN** se revoca el enlace de un pedido
- **THEN** la fila queda archivada, sigue existiendo, y deja de resolver

### Requirement: La resolución pública no expone nada de más

Una función `security definer` concedida a `anon` SHALL resolver el token y devolver únicamente: el número del pedido, su estado con el nombre configurado, la fecha comprometida, las líneas con su descripción, cantidad y precio unitario, el total y lo pagado (de `order_totals`), y la lista de adjuntos. La función SHALL NOT devolver `orders.notes`, ningún costo, margen, proveedor, último precio pagado, ni ningún dato de otro pedido, contacto o ítem del catálogo. Un token inválido, vencido, revocado, o de un pedido archivado SHALL producir la misma respuesta, sin revelar si la organización o el pedido existen.

#### Scenario: Solo lo público sale de la función

- **WHEN** se resuelve un token vigente
- **THEN** la respuesta contiene únicamente los campos declarados, verificado sobre la forma del objeto y no solo sobre la pantalla

#### Scenario: `orders.notes` nunca aparece

- **WHEN** un pedido con notas internas tiene un enlace vigente y se resuelve su token
- **THEN** la respuesta no incluye `orders.notes` en ninguna forma

#### Scenario: Un mensaje único para todo lo que falla

- **WHEN** se resuelve un token inválido, uno vencido, uno revocado, o uno de un pedido archivado
- **THEN** las cuatro situaciones producen exactamente la misma respuesta

### Requirement: Lo pagado y el saldo se muestran; nada de costo, margen ni proveedor

La resolución pública SHALL incluir lo pagado y el saldo pendiente, derivados de `order_totals` y nunca almacenados. SHALL NOT incluir costo, margen, proveedor, ni último precio pagado por la organización.

#### Scenario: El cliente ve cuánto debe

- **WHEN** un pedido con pagos parciales tiene su token resuelto
- **THEN** la respuesta incluye el total, lo pagado y el saldo pendiente

#### Scenario: Ninguna cifra interna se filtra

- **WHEN** se resuelve el token de un pedido con costos y márgenes calculados internamente
- **THEN** ninguno de esos dos valores aparece en la respuesta

### Requirement: Las imágenes del pedido se leen sin service role, y solo mientras el enlace esté vigente

El sistema SHALL conceder a `anon` una política `select` sobre el bucket `attachments`, respaldada por una función `security definer` que confirme que el objeto pertenece a un pedido con un enlace vigente. La política SHALL NOT conceder `insert`, `update` ni `delete` a `anon`. Revocar el enlace SHALL cortar el acceso a las imágenes de inmediato.

#### Scenario: Con enlace vigente, se lee

- **WHEN** un anónimo con el token de un enlace vigente pide una imagen de ese pedido
- **THEN** la lectura se acepta

#### Scenario: Sin enlace vigente, ni conociendo la ruta

- **WHEN** un anónimo intenta leer la imagen de un pedido sin enlace vigente, con la ruta exacta
- **THEN** la lectura se rechaza

#### Scenario: Revocar corta el acceso de inmediato

- **WHEN** se revoca un enlace y justo después se intenta leer una imagen de ese pedido con el token ya revocado
- **THEN** la lectura se rechaza

### Requirement: Ninguna tabla del esquema `public` gana una política para `anon`

Este cambio SHALL NOT añadir ninguna política de RLS para `anon` sobre ninguna tabla del esquema `public`. La única política nueva para `anon` en todo el cambio SHALL ser la de lectura del bucket `attachments`.

#### Scenario: El catálogo de políticas lo confirma

- **WHEN** se revisa el catálogo de políticas de RLS del esquema `public` tras este cambio
- **THEN** ninguna de ellas está concedida a `anon`

### Requirement: El comentario del cliente se recibe sin sesión, se lee en el detalle, y es inmutable

Una función `security definer` concedida a `anon` SHALL recibir un comentario con el nombre declarado y el cuerpo, y SHALL guardarlo en `order_comments` asociado al pedido —no a la fila `order_shares` que lo recibió—, de modo que sobreviva a una regeneración del enlace. Un comentario SHALL NOT poder editarse ni borrarse por quien lo escribió; la organización SHALL poder archivarlo, nunca borrarlo. La bitácora SHALL registrar el comentario con `actor_label = 'Cliente'` y `actor_id` nulo.

#### Scenario: El comentario llega y se lee en el detalle

- **WHEN** un cliente sin sesión deja un comentario con su nombre
- **THEN** el comentario aparece en el detalle del pedido dentro de la aplicación

#### Scenario: Sobrevive a regenerar el enlace

- **WHEN** se regenera el enlace de un pedido que ya tenía comentarios
- **THEN** esos comentarios siguen visibles en el detalle

#### Scenario: Inmutable para quien lo escribió

- **WHEN** se intenta modificar o borrar un comentario ya enviado
- **THEN** la operación no está disponible para quien lo escribió

#### Scenario: La organización archiva, no borra

- **WHEN** la organización retira un comentario
- **THEN** queda archivado y deja de mostrarse, sin borrarse

#### Scenario: La bitácora identifica al cliente sin `actor_id`

- **WHEN** se recibe un comentario
- **THEN** el evento de bitácora lleva `actor_label` «Cliente» y ningún `actor_id`

### Requirement: Un límite de comentarios por pedido y ventana de tiempo

El sistema SHALL rechazar un comentario cuando el pedido ya haya recibido el máximo de comentarios dentro de la ventana de tiempo vigente, con un mensaje sobrio. El límite SHALL contarse por pedido, no por generación del enlace: regenerarlo SHALL NOT reiniciar el conteo.

#### Scenario: Dentro del límite, se acepta

- **WHEN** un pedido tiene menos comentarios que el máximo dentro de la ventana
- **THEN** un comentario nuevo se acepta

#### Scenario: Fuera del límite, se rechaza

- **WHEN** un pedido ya alcanzó el máximo de comentarios dentro de la ventana
- **THEN** un comentario adicional se rechaza con un mensaje sobrio

#### Scenario: Regenerar no reinicia el conteo

- **WHEN** un pedido alcanzó el límite y su enlace se regenera
- **THEN** el conteo sigue considerando los comentarios ya recibidos, no se reinicia

### Requirement: El detalle del pedido ofrece generar, ver, copiar, compartir y revocar

El detalle del pedido SHALL ofrecer generar un enlace cuando no exista ninguno vigente, SHALL mostrar una vista previa exacta del contenido público antes de activarlo, y activar SHALL requerir una acción explícita. Con un enlace vigente, el detalle SHALL mostrar su URL —mientras siga en el estado que la generó o la regeneró—, un botón de copiar, y un botón de compartir cuando el dispositivo ofrezca esa capacidad, con respaldo a copiar cuando no la ofrezca.

#### Scenario: Sin enlace, se ofrece generar

- **WHEN** se abre el detalle de un pedido sin enlace vigente
- **THEN** se ofrece generarlo, y no se muestra ninguna URL

#### Scenario: La vista previa antecede a activar

- **WHEN** se genera un enlace
- **THEN** antes de activarse se muestra exactamente lo que el cliente verá, y activar exige una acción explícita

#### Scenario: Copiar deja la URL en el portapapeles

- **WHEN** se pulsa copiar con un enlace recién generado
- **THEN** la URL queda en el portapapeles

#### Scenario: Compartir usa la capacidad del dispositivo, o se repliega a copiar

- **WHEN** el dispositivo ofrece una función de compartir del sistema
- **THEN** el botón de compartir la invoca con la URL

#### Scenario: Sin capacidad de compartir, solo copiar

- **WHEN** el dispositivo no ofrece función de compartir
- **THEN** el botón de compartir no se ofrece, y copiar sigue disponible

### Requirement: Ambas tablas se declaran en la exportación completa

`order_shares` y `order_comments` SHALL declararse en `lib/export/tables.ts` con todas sus columnas, y `token_hash` SHALL figurar en `EXCLUDED_COLUMNS` con su motivo.

#### Scenario: Las dos tablas salen en la exportación, sin el token

- **WHEN** una organización con enlaces y comentarios solicita la exportación completa
- **THEN** los CSV de `order_shares` y `order_comments` aparecen con sus columnas, y ninguno contiene `token_hash`
