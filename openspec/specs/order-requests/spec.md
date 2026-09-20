# order-requests Specification

## Purpose

Deja que un cliente mande los detalles de su pedido por sí mismo desde un enlace de un solo uso, sin abrir ninguna puerta a los datos de la organización y sin crear nunca un pedido sin que una persona lo revise primero.

> Origen: `specs/PRD/kamay-backlog-sprint-01.md` — KAM-28; `specs/PRD/kamay-especificacion-producto-v6.md` §6.1 (definición de «solicitud de pedido»); `specs/PRD/ARCHITECTURE.md` (convención nº 2: el service role solo en trabajos programados y generación de notificaciones; convención nº 3: nada se borra, solo se archiva; convención nº 4: el estado siempre se deriva).
>
> Presupone `orders` (el alta de pedido que «Aceptar» reutiliza sin modificar), `catalog-directory` (los contactos que se sugieren por teléfono) y el patrón de `token_hash`/mensaje único de fallo de `user-auth` (`invitations`).

## Requirements

### Requirement: `order_requests` es una sola tabla con estado siempre derivado

El sistema SHALL almacenar cada solicitud en una única tabla `order_requests`, con `organization_id`, `business_line_id`, `token_hash bytea` (sha256; el token en claro SHALL NOT guardarse nunca), `contact_id` opcional, el prellenado de nombre y teléfono, lo declarado por el cliente (nombre, teléfono, nota), `expires_at`, `submitted_at`, `order_id` y `archived_at`. El sistema SHALL NOT almacenar un estado de la solicitud en ninguna columna: el estado SHALL derivarse siempre de `submitted_at`, `expires_at`, `order_id` y `archived_at` en el momento de leerla.

#### Scenario: Los cuatro estados se derivan, no se guardan

- **WHEN** se lee una solicitud sin `submitted_at`, sin vencer y sin archivar
- **THEN** se presenta como «esperando al cliente», calculado a partir de esas columnas y no leído de una columna de estado

#### Scenario: Recibida sin pedido aún

- **WHEN** se lee una solicitud con `submitted_at` pero sin `order_id`
- **THEN** se presenta como «recibida»

#### Scenario: Aceptada o descartada

- **WHEN** se lee una solicitud con `order_id` o con `archived_at`
- **THEN** se presenta como «aceptada» o «descartada» según cuál de las dos columnas esté presente

### Requirement: El enlace es dirigido, de un solo uso y sin verificación anti-bot

Toda solicitud SHALL generarse dentro de la aplicación por una persona con membresía en la organización, para un teléfono concreto. El sistema SHALL NOT ofrecer ningún enlace abierto o publicable que no nazca de una solicitud ya creada. Como el token es la única puerta y cada enlace tiene un dueño identificable, el sistema SHALL NOT requerir captcha ni ningún otro control de verificación humana en el formulario público.

#### Scenario: No existe un enlace genérico

- **WHEN** se busca en la aplicación una forma de publicar un enlace de recepción sin una solicitud concreta detrás
- **THEN** no existe ninguna

#### Scenario: El formulario público no pide verificación humana

- **WHEN** se abre el formulario público con un token válido
- **THEN** no se presenta ningún control de verificación humana antes de poder enviarlo

### Requirement: La resolución pública del token no revela nada de más

Una función SHALL resolver el token y devolver únicamente el nombre de la organización, la línea, el prellenado de nombre y teléfono, y los identificadores de organización y de solicitud necesarios para la subida de imágenes. SHALL NOT devolver ninguna otra columna de la solicitud, ni datos de otra organización. Un token inválido, vencido, ya usado (con `submitted_at`) o de una solicitud archivada SHALL producir la misma respuesta, sin distinguir entre esos casos y sin revelar si la organización existe.

#### Scenario: Solo lo mínimo sale de la función

- **WHEN** se resuelve un token válido
- **THEN** la respuesta contiene el nombre de la organización, la línea, el prellenado y los dos identificadores, y ningún otro campo de la solicitud

#### Scenario: Un mensaje único para todo lo que falla

- **WHEN** se resuelve un token vencido, uno ya usado, uno de una solicitud archivada, o uno que no existe
- **THEN** las cuatro situaciones producen exactamente la misma respuesta de «enlace no válido»

### Requirement: El formulario público solo captura datos de contacto, nota e imágenes

El formulario público SHALL pedir nombre y teléfono (obligatorios, el teléfono prellenado y corregible), una nota (opcional) e imágenes de referencia (opcionales, hasta un tope por solicitud). SHALL NOT ofrecer selección de productos, cantidades ni precios, ni mostrar el catálogo, los contactos o cualquier otra solicitud de la organización.

#### Scenario: Nada del catálogo es visible

- **WHEN** se abre el formulario público con un token válido
- **THEN** no aparece ningún producto, precio, contacto ni otra solicitud de la organización

#### Scenario: Falta el nombre o el teléfono

- **WHEN** se intenta enviar el formulario sin nombre o sin teléfono
- **THEN** el envío se impide y el mensaje señala el campo que falta

### Requirement: Enviar marca la solicitud como recibida sin crear pedido ni contacto

Una función SHALL recibir el envío del formulario, guardar lo declarado por el cliente y marcar `submitted_at`. SHALL NOT crear ninguna fila en `orders` ni en `contacts` como parte de ese envío.

#### Scenario: Recibida, nada más

- **WHEN** alguien sin sesión envía el formulario con nombre, teléfono y nota
- **THEN** la solicitud queda marcada como recibida, y no se crea ningún pedido ni ningún contacto

### Requirement: La subida de imágenes vive en una cuarentena acotada a su propia solicitud

El sistema SHALL usar un bucket privado `order-requests` con una única política de `insert` para `anon` sobre `storage.objects`, que solo permita escribir dentro de `<organization_id>/<request_id>/` de una solicitud que siga esperando al cliente y no haya vencido. El sistema SHALL NOT conceder a `anon` ningún privilegio de `select`, `update` ni `delete` sobre ese bucket.

#### Scenario: Solo la carpeta propia, mientras espera

- **WHEN** alguien con un token válido sube una imagen a la carpeta de su propia solicitud, que todavía espera al cliente
- **THEN** la subida se acepta

#### Scenario: Ni leer, ni sobrescribir, ni cruzar de carpeta

- **WHEN** ese mismo `anon` intenta leer lo subido, sobrescribirlo, o escribir en la carpeta de otra solicitud o de otra organización
- **THEN** las cuatro operaciones fallan

#### Scenario: Recibida o vencida, la carpeta se cierra

- **WHEN** se intenta subir una imagen a una solicitud ya recibida o ya vencida
- **THEN** la subida falla

### Requirement: Ninguna tabla del esquema `public` gana una política para `anon`

Este cambio SHALL NOT añadir ninguna política de RLS para el rol `anon` sobre ninguna tabla del esquema `public`. La única política nueva para `anon` en todo el cambio SHALL ser la de `storage.objects` de la cuarentena.

#### Scenario: El catálogo de políticas lo confirma

- **WHEN** se revisa el catálogo de políticas de RLS del esquema `public` tras este cambio
- **THEN** ninguna de ellas está concedida al rol `anon`

### Requirement: La bitácora identifica el envío público sin `actor_id`

Cuando una solicitud se marca como recibida, la bitácora SHALL registrar el evento con `actor_label = 'Formulario público'` y `actor_id` nulo.

#### Scenario: El origen queda escrito, no adivinado

- **WHEN** una solicitud se recibe desde el formulario público
- **THEN** el evento de bitácora correspondiente lleva `actor_label` «Formulario público» y ningún `actor_id`

### Requirement: La bandeja está abierta a cualquier persona con membresía

Dentro de la aplicación, cualquier persona con membresía en la organización —dueño o ayudante— SHALL poder leer la bandeja de solicitudes con sus imágenes, generar un enlace nuevo y aceptar o descartar una solicitud. Esa apertura SHALL estar garantizada por la política de acceso, no solo porque la pantalla no la oculte.

#### Scenario: Un ayudante acepta de punta a punta

- **WHEN** un ayudante abre la bandeja, revisa una solicitud recibida y la acepta
- **THEN** la operación se completa igual que si la hiciera el dueño

### Requirement: Descartar archiva, nunca borra

Descartar una solicitud SHALL fijar `archived_at` y SHALL NOT borrar la fila. Una solicitud archivada SHALL dejar de aparecer en la bandeja activa.

#### Scenario: Desaparece de la bandeja, no del sistema

- **WHEN** se descarta una solicitud recibida
- **THEN** queda archivada, sigue existiendo en la base, y ya no aparece en la bandeja

### Requirement: Aceptar reutiliza el alta de pedido existente y traslada las imágenes

Aceptar una solicitud SHALL abrir el alta de pedido existente prellenada con el nombre, el teléfono y la nota, sin modificar esa acción ni sus reglas. Si la solicitud tiene un `contact_id` prellenado, ese contacto SHALL quedar preseleccionado; si no lo tiene, el sistema SHALL sugerir contactos existentes cuyo teléfono coincida, sin fusionar ni crear nada automáticamente. Una vez creado el pedido, sus imágenes SHALL copiarse (no moverse) de la cuarentena a `attachments` como adjuntos del pedido, y `order_id` SHALL fijarse en la solicitud solo al concluir esa copia. El paso de copiar SHALL poder reintentarse sin duplicar adjuntos.

#### Scenario: El alta llega prellenada

- **WHEN** se acepta una solicitud con nombre, teléfono y nota
- **THEN** el alta de pedido se abre con esos tres datos ya escritos

#### Scenario: Contacto sugerido por teléfono

- **WHEN** se acepta una solicitud sin `contact_id` y existe un contacto con un teléfono equivalente
- **THEN** ese contacto aparece sugerido en el selector, sin quedar elegido automáticamente

#### Scenario: Las imágenes llegan como adjuntos del pedido

- **WHEN** se completa la aceptación de una solicitud con imágenes
- **THEN** esas imágenes aparecen como adjuntos del pedido creado, y siguen existiendo en la cuarentena

#### Scenario: Reintentar la copia no duplica

- **WHEN** el paso de copiar las imágenes se ejecuta dos veces sobre la misma solicitud aceptada
- **THEN** el pedido conserva un solo adjunto por imagen, no dos

### Requirement: Generar y enviar abre WhatsApp sin API ni credencial

Generar una solicitud desde la aplicación SHALL crear la fila con el teléfono prellenado y SHALL ofrecer abrir WhatsApp mediante un enlace `wa.me` con el mensaje y el enlace público, sin usar ninguna API ni credencial de mensajería.

#### Scenario: El enlace de WhatsApp se arma sin credencial

- **WHEN** se genera una solicitud y se elige «enviar por WhatsApp»
- **THEN** se abre un enlace `wa.me` con el mensaje y el enlace público, sin que la operación dependa de ninguna credencial de mensajería

### Requirement: Abrir el enlace no lo consume

Abrir la página pública sin enviar el formulario SHALL NOT cambiar el estado de la solicitud ni consumir el token. Cualquier número de aperturas antes del envío SHALL dejar la solicitud igual de disponible.

#### Scenario: La vista previa de un mensajero no rompe el enlace

- **WHEN** el enlace se abre varias veces sin que se envíe el formulario, como ocurre con la vista previa de un mensajero
- **THEN** la solicitud sigue esperando al cliente y el enlace sigue funcionando

### Requirement: El enlace vence a los 7 días y se puede regenerar mientras espera

Una solicitud SHALL vencer 7 días después de generarse. Mientras siga esperando al cliente —sin `submitted_at` y sin `archived_at`—, SHALL poder regenerarse: la regeneración SHALL sustituir `token_hash` y `expires_at` en la misma fila, y el enlace anterior SHALL dejar de servir de inmediato.

#### Scenario: Vence a los 7 días

- **WHEN** pasan 7 días desde que se generó una solicitud sin que el cliente la haya enviado
- **THEN** el enlace deja de servir

#### Scenario: Regenerar invalida el enlace anterior

- **WHEN** se regenera una solicitud que todavía espera al cliente
- **THEN** el enlace anterior deja de resolver, y el nuevo enlace resuelve con la misma solicitud
