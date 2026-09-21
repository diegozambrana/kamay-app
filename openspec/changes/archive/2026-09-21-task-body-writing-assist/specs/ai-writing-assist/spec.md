## Purpose

Provee el puerto hacia un modelo de lenguaje y el flujo por el cual una persona pide, revisa y decide aceptar o descartar una propuesta de redacción para el cuerpo de una tarea, sin que el modelo escriba nada sin permiso explícito.

## ADDED Requirements

### Requirement: Una propuesta nunca reemplaza el texto sin una decisión explícita

Pedir una mejora SHALL mostrar la propuesta junto al texto actual, en un panel de comparación, sin alterar el borrador del editor. El borrador SHALL cambiar al texto de la propuesta únicamente cuando la persona pulsa *Aceptar*; pulsar *Descartar* SHALL cerrar el panel de comparación y SHALL dejar el borrador exactamente como estaba, carácter por carácter. La persistencia del cuerpo SHALL seguir dependiendo únicamente de la acción *Guardar* del editor, sin un segundo camino de guardado.

#### Scenario: Mejorar muestra la propuesta sin tocar el borrador

- **GIVEN** un cuerpo escrito en el editor
- **WHEN** se activa *Mejorar la descripción*
- **THEN** se muestra la propuesta junto al texto actual, el borrador del editor no cambia y nada se guarda

#### Scenario: Descartar conserva el borrador intacto

- **GIVEN** una propuesta mostrada en el panel de comparación
- **WHEN** se pulsa *Descartar*
- **THEN** el panel se cierra y el borrador del editor queda exactamente igual a como estaba, carácter por carácter

#### Scenario: Aceptar reemplaza el borrador, no la base de datos

- **GIVEN** una propuesta mostrada en el panel de comparación
- **WHEN** se pulsa *Aceptar*
- **THEN** el borrador del editor pasa a ser el texto de la propuesta y el cuerpo guardado de la tarea no cambia hasta que se pulse *Guardar*

### Requirement: La acción no está disponible sobre un cuerpo vacío

*Mejorar la descripción* SHALL NOT ofrecerse cuando el cuerpo del editor está vacío.

#### Scenario: Cuerpo vacío sin acción de mejorar

- **GIVEN** un editor sin ningún texto escrito
- **WHEN** se abre la barra de herramientas del editor
- **THEN** la acción *Mejorar la descripción* no aparece

### Requirement: Una propuesta que pierde ítems de verificación se advierte antes de aceptar

El sistema SHALL comparar, ítem por ítem, las líneas de lista de verificación del texto actual con las de la propuesta. Cuando la propuesta carezca de un ítem presente en el original, el panel de comparación SHALL mostrar una advertencia y SHALL impedir pulsar *Aceptar* hasta que la persona la reconozca explícitamente.

#### Scenario: Se detecta la pérdida de un ítem de verificación

- **GIVEN** un cuerpo con tres ítems de lista de verificación, uno marcado
- **WHEN** se pide una mejora y la propuesta vuelve con solo dos de esos ítems
- **THEN** el panel advierte que se perdió un ítem y *Aceptar* queda deshabilitado hasta que la persona reconozca la advertencia

#### Scenario: Sin pérdida de ítems no hay advertencia

- **GIVEN** un cuerpo con dos ítems de lista de verificación
- **WHEN** la propuesta conserva ambos, con el mismo estado marcado o no marcado
- **THEN** no se muestra ninguna advertencia y *Aceptar* está disponible de inmediato

### Requirement: Un proveedor que falla o tarda se degrada sin arriesgar el texto

Cuando el proveedor del modelo falle o no responda dentro de un plazo definido, el sistema SHALL informar el problema en lenguaje llano y el editor SHALL seguir usable con el texto del borrador intacto.

#### Scenario: El proveedor falla

- **GIVEN** un proveedor de modelo que devuelve un error
- **WHEN** se pide una mejora
- **THEN** se muestra un aviso en lenguaje llano, no se abre ningún panel de comparación y el borrador sigue intacto

#### Scenario: El proveedor tarda más del plazo

- **GIVEN** un proveedor de modelo que no responde dentro del plazo definido
- **WHEN** se pide una mejora
- **THEN** se muestra un aviso de demora, la solicitud se da por no cumplida y el borrador sigue intacto

### Requirement: Sin conexión la acción se muestra no disponible, no fallida

Cuando el dispositivo no tiene conexión de red, *Mejorar la descripción* SHALL mostrarse como no disponible por falta de conexión, sin ofrecer un intento que termine en error.

#### Scenario: Sin conexión no se ofrece un intento fallido

- **GIVEN** un dispositivo sin conexión de red
- **WHEN** se abre la barra de herramientas del editor con un cuerpo no vacío
- **THEN** *Mejorar la descripción* se muestra como no disponible por falta de conexión, no como una acción que al pulsarse fallaría

### Requirement: Solo las organizaciones que activaron la asistencia pueden usarla

La acción de servidor que genera una propuesta SHALL rechazar toda solicitud de una organización que no activó la asistencia de redacción, incluso si la solicitud no pasa por la interfaz.

#### Scenario: La interfaz no ofrece la acción

- **GIVEN** una organización que no activó la asistencia de redacción
- **WHEN** se abre el editor de una tarea con cuerpo no vacío
- **THEN** *Mejorar la descripción* no aparece

#### Scenario: La acción de servidor rechaza igual

- **GIVEN** una organización que no activó la asistencia de redacción
- **WHEN** se invoca directamente la acción de servidor que genera la propuesta, sin pasar por la interfaz
- **THEN** la acción rechaza la solicitud

### Requirement: La función se apaga por completo si falta su configuración

Cuando la variable de entorno que habilita la conexión al modelo está ausente, la aplicación SHALL compilar y arrancar sin error, y la asistencia de redacción SHALL quedar apagada para todas las organizaciones, sin importar su interruptor propio.

#### Scenario: Variable ausente no rompe el arranque

- **GIVEN** un entorno sin la variable de conexión al modelo configurada
- **WHEN** la aplicación compila y arranca
- **THEN** no hay error de arranque y la asistencia de redacción está apagada para toda organización, aunque alguna la tenga activada en su configuración

### Requirement: Una propuesta aceptada y guardada queda registrada como asistida

Cuando el cuerpo guardado de una tarea proviene de una propuesta aceptada en esa misma sesión de edición, la bitácora SHALL dejar constancia de que el cambio fue asistido, y el autor del evento SHALL seguir siendo la persona que pulsó *Guardar*.

#### Scenario: Guardar una propuesta aceptada deja constancia

- **GIVEN** una propuesta aceptada que reemplazó el borrador del editor
- **WHEN** se pulsa *Guardar*
- **THEN** el evento de la bitácora registra el cambio del cuerpo con la marca de que fue asistido, y su autor es la persona que guardó

#### Scenario: Un guardado sin propuesta aceptada no lleva la marca

- **GIVEN** un cuerpo editado a mano, sin haber aceptado ninguna propuesta
- **WHEN** se pulsa *Guardar*
- **THEN** el evento de la bitácora no lleva la marca de asistido

### Requirement: La salida del modelo se sanea igual que cualquier cuerpo

El texto de una propuesta SHALL pasar por el mismo saneamiento que cualquier cuerpo de tarea antes de mostrarse: ninguna etiqueta HTML de la propuesta SHALL ejecutarse ni rendirse como elemento, y ningún enlace con esquema peligroso SHALL conservar su destino.

#### Scenario: Una propuesta con HTML peligroso no se ejecuta

- **GIVEN** una propuesta cuyo texto contiene `<script>alert(1)</script>`
- **WHEN** se muestra en el panel de comparación
- **THEN** no se ejecuta nada y la etiqueta no aparece en el documento rendido

#### Scenario: Una propuesta con un enlace peligroso no navega

- **GIVEN** una propuesta cuyo texto contiene un enlace con destino `javascript:`
- **WHEN** se muestra en el panel de comparación
- **THEN** el enlace rendido no conserva ese destino

### Requirement: El límite de uso por organización y por periodo se hace cumplir

La acción de servidor SHALL contar las solicitudes de mejora por organización dentro de un periodo, y SHALL rechazar con un mensaje sobrio toda solicitud que supere el límite configurado para esa organización, sin importar si la solicitud llega desde la interfaz o directamente.

#### Scenario: Se rechaza al superar el límite

- **GIVEN** una organización que ya alcanzó su límite de uso del periodo
- **WHEN** se pide una nueva mejora
- **THEN** la acción rechaza la solicitud con un mensaje sobrio, sin llamar al proveedor del modelo

#### Scenario: Bajo el límite la solicitud procede

- **GIVEN** una organización por debajo de su límite de uso del periodo
- **WHEN** se pide una mejora
- **THEN** la solicitud se procesa con normalidad

### Requirement: La credencial del modelo nunca llega al navegador

Ninguna variable de entorno pública (`NEXT_PUBLIC_*`) SHALL contener la credencial de acceso al modelo, y el código que la usa SHALL NOT importarse desde ningún módulo de cliente.

#### Scenario: La frontera de variables públicas la detecta

- **GIVEN** la credencial del modelo configurada como variable de servidor
- **WHEN** se verifica el conjunto de variables `NEXT_PUBLIC_*`
- **THEN** ninguna de ellas contiene esa credencial

### Requirement: La propuesta respeta el idioma y la estructura del original

Toda propuesta SHALL redactarse en español, SHALL conservar la estructura Markdown del cuerpo original —encabezados, listas y énfasis— y SHALL conservar cada ítem de lista de verificación con el mismo estado marcado o no marcado que tenía en el original.

#### Scenario: La propuesta llega en español

- **GIVEN** un cuerpo escrito en español con una instrucción de mejora
- **WHEN** se genera la propuesta
- **THEN** el texto de la propuesta está en español

#### Scenario: Los ítems marcados siguen marcados

- **GIVEN** un cuerpo con un ítem de lista de verificación ya marcado
- **WHEN** se genera una propuesta que conserva ese ítem
- **THEN** el ítem aparece en la propuesta con el mismo estado marcado
