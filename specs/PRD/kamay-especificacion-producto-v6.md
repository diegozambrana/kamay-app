# Kamay — Documento de Especificación de Producto

> Versión 6.0 · Reemplaza a la v5.0 · Documento vivo · Agnóstico de tecnología
> Primera organización usuaria: **Geeko Store**
> Novedades de esta versión: flujo de sublimación cerrado en 6 estados · alfarería incluida en el consolidado
> **Sin decisiones bloqueantes pendientes: el documento está listo para construir.**

---

## 1. Resumen Ejecutivo

**Kamay** es una plataforma web de gestión operativa para emprendimientos de producción propia. Registra a quién le compro, qué produzco, qué vendo, cuánto gasto, cuánto gano, qué tengo pendiente y quién hizo cada cambio — separando los resultados por línea de negocio, de modo que un proyecto rentable no quede escondido detrás de uno que no lo es.

La primera organización que la usa es **Geeko Store**, que opera tres líneas con lógicas de trabajo muy distintas:

| Línea | Qué produce | Cómo trabaja | Cómo se vende |
|---|---|---|---|
| **Sublimación** | Tazas, mousepads, posavasos, imanes, cuadros de metal | **Contra pedido**, con diseño previo y cola de producción | Pedido directo y redes |
| **Impresión 3D** | Piezas y productos propios (en incorporación) | Aún por definir; probablemente contra pedido y para stock | Ferias y redes |
| **Alfarería / cerámica** | Piezas artesanales | **Para stock**, como pasatiempo, con tiempos largos de espera | Feria y venta directa de piezas terminadas |

Esa diferencia es la razón por la que los flujos de trabajo son configurables por línea: forzar un mismo tablero para las tres sería repetir el error de rigidez de la versión anterior.

Kamay se apoya en cuatro principios:

> **Principio 1 — Pocas ideas, bien definidas.** Cada concepto tiene una definición escrita y única (Sección 6.1). Ninguna funcionalidad nueva puede introducir un concepto que se solape con otro existente.
>
> **Principio 2 — El usuario registra hechos; el sistema deriva consecuencias.** Stock, saldos, costos y márgenes **nunca se escriben a mano**: se calculan desde los hechos registrados. Un mismo dato no vive en dos lugares.
>
> **Principio 3 — Lo que se piensa y lo que se hace viven juntos.** Una idea suelta empieza como tarea y, al completarse, **puede convertirse en registros reales** del sistema.
>
> **Principio 4 — Todo deja rastro.** Cada cambio queda registrado con autor, fecha y contenido. La bitácora es inalterable, incluso para el dueño.

*(El nombre calza bien con el negocio: kamay, en quechua, alude a crear y dar forma.)*

---

## 2. Objetivo del Negocio

### Objetivo principal
Responder, sin cálculos aparte y sin mezclar proyectos, siete preguntas:

1. ¿Cuánto gano realmente en cada pedido y en cada producto?
2. ¿En qué se me va el dinero, y en cuál de mis tres líneas?
3. ¿Qué productos y qué canales me conviene seguir empujando?
4. ¿Qué insumos estoy por quedarme sin ellos?
5. ¿Ya se pagó sola la impresora 3D? ¿Y el horno?
6. ¿Qué tengo pendiente hoy, qué está por vencer y qué se me pasó?
7. ¿Qué cambió aquí, quién lo hizo y cuándo?

### Objetivos secundarios
- Que cada línea tenga su propio resultado, sin contaminarse, y que exista el total consolidado.
- Delegar carga de datos y tareas a un ayudante sin exponer costos ni márgenes, pudiendo revisar después qué tocó.
- Vender en feria de forma rápida, incluso sin señal.
- Que ninguna idea o compromiso se pierda, y que al cerrarse pueda dejar registros reales.
- Poder crecer a otras organizaciones o conectarse con otras plataformas.

### Cómo se mide el éxito

| Indicador | Meta razonable |
|---|---|
| Pedidos y ventas registrados vs. reales del mes | ≥ 95 % |
| Tiempo para registrar un pedido | < 1 minuto |
| Tiempo para registrar una venta de feria | < 15 segundos |
| Tiempo para anotar una tarea nueva | < 10 segundos |
| Egresos registrados el mismo día | ≥ 80 % |
| Egresos correctamente asignados a una línea | ≥ 90 % |
| Tareas vencidas sin tocar por más de 15 días | < 10 % del total abierto |
| Tiempo para responder "¿por qué este número cambió?" | < 2 minutos, sin salir del sistema |
| Cierre mensual por línea y consolidado | < 5 minutos |
| Herramientas paralelas (cuaderno, Excel, notas del celular) | 0 en 2 meses |

**Criterio de fracaso a vigilar:** si registrar cuesta más que el valor que devuelve, el sistema se abandona.

---

## 3. Público Objetivo

### 3.1 Dueño / administrador
- Conoce el negocio a fondo, no es técnico.
- Registra desde el taller, la feria y la computadora; muchas veces desde el celular.
- Necesita ver plata: costos, márgenes, deudas, rentabilidad por línea.
- Necesita descargar la cabeza: anotar pendientes en el momento.
- **Es el único que ve la bitácora completa** y quien configura los flujos de cada línea.

### 3.2 Ayudante / operador (1 o 2 personas)
- Registra pedidos y ventas, avanza estados de producción, anota compras y consumo.
- Recibe tareas asignadas y las mueve por el tablero.
- Puede atender un puesto de feria solo.
- **No ve** costos, márgenes, reportes ni bitácora general.
- Ve el historial del registro en el que trabaja, no la bitácora general.

### 3.3 Organizaciones futuras
- Otro emprendimiento propio, un socio o una plataforma externa conectada.
- Necesita que Kamay se adapte **configurando**, no programando.

---

## 4. Tipo de Producto Digital

**Aplicación web multi-organización con lógica de negocio y usuarios registrados** (herramienta interna de administración).

### Justificación
- No busca vender ni posicionarse: no es landing ni sitio institucional.
- No vende al público en línea: no es tienda.
- Guarda información que cambia a diario y sobre la cual se calcula y compara.
- Debe servir a más de una organización con datos completamente aislados.
- Debe avisar por iniciativa propia y conservar memoria de todo lo ocurrido.

### Consecuencias de diseño
- **Mobile-first para capturar**, escritorio para analizar y auditar.
- **Modo feria:** vender y registrar sin conexión; los eventos conservan la hora real del hecho.
- Acceso protegido, permisos por rol dentro de cada organización.

---

## 5. Propuesta de Valor y Tono de Marca

### Propuesta de valor interna
> "Todo lo que pienso, compro, produzco y vendo — en un solo lugar, registrado en segundos, con cada proyecto siguiendo su propio ritmo de trabajo y sin que se mezclen las cuentas."

### Diferenciadores frente a la versión anterior

| Kamay v1 | Kamay v5 |
|---|---|
| Muchos módulos creados de golpe | Núcleo mínimo + módulos que se activan |
| Conceptos solapados y ambiguos | Cada concepto con definición única y escrita |
| Datos derivados guardados a mano | Todo lo derivado se calcula desde los hechos |
| Un solo negocio, todo mezclado | Organizaciones aisladas + líneas separadas |
| Los pendientes vivían fuera del sistema | Las tareas viven dentro y pueden convertirse en datos reales |
| Un único flujo rígido para todo | Flujos propios por línea, con reglas que impiden que la libertad rompa los reportes |
| Los cambios eran invisibles | Bitácora inalterable de todo lo que ocurre |

### Tono y personalidad
Herramienta de trabajo, no producto de marketing. Sobria, densa en información, rápida.

**Directrices de interfaz:**
- Legible en taller y feria: alto contraste, texto grande, botones para dedos.
- **Kamay es neutra; Geeko Store es la marca del contenido.** Nombre, logo y color configurables por organización.
- Cada línea tiene color e ícono propio.
- Modo claro y oscuro.

---

## 6. Funcionalidades Clave

### 6.1 Modelo conceptual — el contrato del sistema

#### Los tres niveles de separación

| Nivel | Qué es | Ejemplo | Regla |
|---|---|---|---|
| **Organización** (tenant) | Cuenta dueña de todo. Caja cerrada. | Geeko Store | Se crea una nueva solo cuando **nada** debe compartirse. |
| **Línea de negocio** | Proyecto o rama productiva con resultado económico propio. | Sublimación · 3D · Alfarería · General | Cuentas separadas, pero comparte proveedores, clientes, ayudantes y consolidado. |
| **Canal de venta** | Por dónde entró la venta. | Feria · Redes · Pedido directo · Mostrador | Etiqueta de análisis, no separación de cuentas. |

#### Los conceptos operativos

| Concepto | Definición única | Qué NO es |
|---|---|---|
| **Contacto** | Persona o empresa con la que trato: proveedor, cliente o ambos. | No son dos listas separadas. |
| **Ítem** | Cosa nombrable del catálogo, con **tipo**: *insumo*, *producto* o *activo*. | No existen "producto", "producto base" y "producto de venta" por separado. |
| **Variante** | Versión concreta de un ítem. | No es un ítem duplicado. |
| **Egreso** | Salida de dinero: *compra* (trae ítems) o *gasto* (no trae nada). | No son dos módulos. |
| **Pedido** | Compromiso de venta con un cliente. | No es una venta cobrada. |
| **Venta directa** | Venta cobrada en el acto, sin producción previa. | No es un pedido abreviado. |
| **Movimiento de inventario** | Cambio de saldo: entrada, salida o ajuste. | El inventario es la suma de sus movimientos. |
| **Cobro / Pago** | Dinero que efectivamente entró o salió. | Pedido pagado ≠ pedido entregado. |
| **Activo** | Bien duradero de producción. | No es un insumo. |
| **Tarea** | Unidad de trabajo propio, con estado, responsable y fecha límite opcional. | **No es un pedido** ni un registro contable. |
| **Estado** | Etapa dentro de un flujo (de pedido o de tarea). Configurable, con un *tipo* declarado. | No es una etiqueta libre. |
| **Vínculo** | Referencia entre una tarea y otro registro. Visible desde ambos lados. | No es una copia. |
| **Entregable** | Registro que debe existir al cerrar una tarea. Puede haber varios. | No es un archivo adjunto. |
| **Etiqueta** | Palabra libre para agrupar de forma transversal (`hornada-07`, `feria-agosto`). | No reemplaza línea ni estado. |
| **Recordatorio** | Aviso programado asociado a una fecha límite. | No es la fecha límite en sí. |
| **Evento de bitácora** | Hecho ocurrido en el sistema: quién, qué, cuándo, sobre qué registro y con qué cambio. **Inalterable.** | No es una notificación. |
| **Lote de producción** *(fase posterior)* | Tanda fabricada para stock. | No es un pedido sin cliente. |

#### Reglas transversales
- **Todo egreso, pedido, venta, activo y tarea lleva una línea obligatoria.** Lo transversal va a **General/Compartido**.
- Los gastos de General se reparten en los reportes con una regla simple y visible.
- Un ítem puede pertenecer a una línea o ser compartido.
- Cada venta lleva canal; por defecto toma el último usado.
- **Todo cambio genera un evento de bitácora**, automáticamente.
- **Nada se elimina: todo se archiva.** *(Decisión tomada — ver 6.6.)*

---

### 6.2 Estados y flujos de trabajo

Los estados son configurables **en dos niveles**: un juego por defecto para toda la organización, y uno propio por línea de negocio que lo reemplaza.

#### La regla que evita que la flexibilidad rompa el sistema

> **Cada estado declara un *tipo*:** `INICIAL` · `EN CURSO` · `EN ESPERA` · `FINAL` · `CANCELADO`.

Sin esto, agregar columnas rompe todo lo que depende de saber si algo está terminado: alertas de retraso, indicadores del panel y reportes de rentabilidad. El tipo `EN ESPERA` es especialmente importante en Geeko Store, porque hay etapas donde **esperar es parte normal del proceso** (una cola de sublimado, una pieza secando) y no deben generar alertas.

**Restricciones:** todo juego necesita al menos un `INICIAL` y un `FINAL`; un estado en uso no se elimina, se archiva pidiendo a dónde mover lo que quedaba; cambiar la configuración **no reescribe la historia** de pedidos y tareas anteriores.

#### Cómo descubrir los estados de una línea nueva

Regla práctica, para no inventar flujos en el aire:

> **Un estado existe donde el trabajo se acumula y espera.** Si nadie pregunta nunca "¿cuántos hay ahí?", si el paso dura minutos, o si no cambia quién es responsable, **no es un estado: es un paso dentro de otro estado** (o una lista de verificación en una tarea).

**Método recomendado para 3D y alfarería:** arrancar con el juego mínimo, registrar 10 encargos reales y observar **dónde se atascan las cosas**. Ese punto de acumulación es el estado que faltaba. Agregarlo entonces cuesta un minuto en configuración; inventarlo hoy cuesta un flujo que nadie usa.

---

#### Flujo A — Sublimación (definido)

Es la línea madura y su flujo ya está claro:

| # | Estado | Tipo | Qué significa |
|---|---|---|---|
| 1 | **Registrado** | `INICIAL` | Se anotó el encargo con cliente, producto y fecha |
| 2 | **En diseño** | `EN CURSO` | Hay una tarea de diseño vinculada al pedido, en proceso |
| 3 | **En cola** | `EN ESPERA` | Diseño aprobado; espera turno de sublimado **por orden de llegada** |
| 4 | **Sublimando** | `EN CURSO` | En prensa, enfriando, encajando y anotando los datos del cliente |
| 5 | **Listo para entrega** | `EN ESPERA` | Espera que el cliente lo recoja o que salga a delivery |
| 6 | **Entregado** | `FINAL` | En manos del cliente |
| — | **Cancelado** | `CANCELADO` | |

**Decisiones incorporadas en este flujo:**

- **El proceso de diseño NO son estados del pedido.** Tú lo describiste como un ciclo propio: por hacer → creando → revisión → (si hay cambios, vuelve atrás) → terminado. Eso es exactamente **una tarea vinculada al pedido**, con los cuatro estados por defecto del tablero de tareas. El pedido solo necesita saber que está *En diseño*; el ir y venir de correcciones vive en la tarjeta de la tarea, donde arrastrar de *En revisión* de vuelta a *Por hacer* es natural.
  *Meterlo como columnas del pedido significaría hacerlo retroceder en el tablero cada vez que el cliente pide un cambio, ensuciando su historial y las métricas de tiempo.*
  **Nota agradable:** tu ciclo de diseño confirma que los cuatro estados por defecto (`POR HACER` → `HACIENDO` → `EN REVISIÓN` → `HECHO`) son los correctos; basta renombrarlos si quieres.

- **"En cola" se ordena por antigüedad, no por urgencia.** Como sublimas por orden de llegada, esa columna del tablero se ordena por el momento en que el pedido entró a la cola y muestra la posición de cada uno. Es el único estado con este comportamiento.

- **Recojo y delivery no son estados: son un atributo del pedido.** Duplicar columnas ("Listo para recojo" / "Listo para delivery") duplicaría el tablero sin agregar información. El pedido lleva un campo *modo de entrega* (recojo en taller / delivery a punto acordado) visible en la tarjeta, y en ambos casos el estado siguiente es *Entregado*.
  *Excepción a revisar más adelante:* si el delivery llega a tomar más de un día o lo hace otra persona, entonces sí conviene un estado `EN ESPERA` llamado *En ruta*.

- **El empaque no es un estado** *(decisión tomada)*. Enfriar, encajar y anotar los datos del cliente ocurre en el mismo tramo de trabajo y por la misma persona: nadie necesita saber cuántos pedidos están enfriando. Va como lista de verificación dentro de *Sublimando*, no como columna. **Seis estados en total.**
  *Aplicación directa de la regla: un estado existe donde el trabajo se acumula y espera. Aquí no se acumula.*

---

#### Flujo B — Alfarería (provisional, y probablemente no necesite tablero)

Aquí el hallazgo importante es que **la alfarería casi no funciona por pedido**: produces piezas como pasatiempo y luego vendes las que están terminadas. Modelarla como un flujo de pedidos sería forzarla.

**Lo que realmente necesita:**

1. **La producción se registra como tarea**, no como pedido. Una tarea por pieza o por hornada, con etiqueta (`hornada-07`) y una lista de verificación en el cuerpo: modelado · secado · primera quema · esmaltado · segunda quema. Los tiempos largos de espera se manejan con la fecha límite, no con columnas.
2. **Al terminar, la tarea crea el producto.** Se declara el entregable *Nuevo producto*, y al cerrarla la pieza entra al catálogo con sus fotos, lista para venderse.
3. **La venta ocurre por venta directa** (feria o mostrador), sin pedido de por medio.

**Juego mínimo de estados de pedido para esta línea**, solo para el caso ocasional de que alguien encargue o reserve una pieza:

| Estado | Tipo |
|---|---|
| **Reservado** | `INICIAL` |
| **Listo para entrega** | `EN ESPERA` |
| **Entregado** | `FINAL` |
| **Cancelado** | `CANCELADO` |

*Cuando exista el módulo de lotes de producción (Fase 5), la cadena modelado → quema → esmaltado pasará de lista de verificación a lote real, con registro de merma. Mientras tanto, la tarea cumple perfectamente y no cuesta nada construir.*

**Alfarería entra al consolidado de Geeko Store** *(decisión tomada)*. No se marca de ninguna forma especial ni se excluye de los totales: es una línea más. Los reportes ya permiten verla aislada cuando haga falta, así que no se necesita ningún mecanismo adicional.
*Consecuencia a tener presente al leer los números:* siendo un pasatiempo con inversión inicial alta (horno, torno, arcilla) y ventas ocasionales, es esperable que durante los primeros meses reste margen al total. Eso no es un problema del sistema ni de la línea; es información. El comparativo entre líneas de **V14** es el lugar donde esa historia se lee correctamente. Si algún día conviene separarla, basta convertirla en su propia organización — pero eso significaría dejar de compartir proveedores y ferias, y hoy no hay razón para pagar ese precio.

---

#### Flujo C — Impresión 3D (provisional, a confirmar con la práctica)

La línea aún no arranca; definir su flujo hoy sería inventarlo. Recomendación: **partir del flujo de sublimación sin la etapa de diseño**, porque comparte la característica clave —una máquina que produce de a una pieza por vez y genera cola—, y ajustarlo después de los primeros 10 encargos reales.

| Estado | Tipo | Nota |
|---|---|---|
| **Registrado** | `INICIAL` | |
| **En cola** | `EN ESPERA` | Ordenada por antigüedad, igual que sublimación |
| **Imprimiendo** | `EN CURSO` | |
| **Post-proceso** | `EN CURSO` | Retirar soportes, lijar, pintar, armar |
| **Listo para entrega** | `EN ESPERA` | |
| **Entregado** | `FINAL` | |
| **Cancelado** | `CANCELADO` | |

**Qué observar en los primeros encargos**, para saber si el flujo necesita cambios:
- ¿El modelado 3D lo haces tú? Si sí, aparecerá una etapa previa equivalente al diseño → tarea vinculada, no estado.
- ¿Cuánto se acumula en *Post-proceso*? Si es donde todo se atasca, quizá deba dividirse.
- ¿Cuántas impresiones fallan? La merma en 3D suele ser alta y afecta el costo real por pieza buena; conviene anotarla como consumo desde ya.
- ¿Produces para stock de feria o solo contra pedido? Si es para stock, se parecerá más a alfarería que a sublimación.

---

#### Resumen comparativo

| | Sublimación | 3D | Alfarería |
|---|---|---|---|
| Lógica dominante | Contra pedido | Por confirmar | Para stock |
| Tablero de pedidos | 6 estados, definido | 6 estados, provisional | 3 estados, marginal |
| Dónde vive el proceso creativo | Tarea de diseño | Probablemente tarea de modelado | Tarea de producción con lista de verificación |
| Cuello de botella | Cola de sublimado | Por descubrir | Tiempos de secado y quema |
| Canal principal | Pedido directo | Ferias y redes | Feria y venta directa |

---

### 6.3 Módulo de Tareas

#### La regla que evita el desorden
> **El tablero de pedidos gestiona compromisos con clientes. El tablero de tareas gestiona tu propio trabajo.**
> Un pedido **nunca** genera una tarea automáticamente. Desde el detalle del pedido existe la acción **"Crear tarea para este pedido"**, que abre el formulario prellenado con la línea, el vínculo al pedido, el cliente como contexto y una fecha límite sugerida anterior a la de entrega. La decisión de crearla es siempre del usuario.

#### Contenido de una tarea

| Campo | Obligatorio | Notas |
|---|---|---|
| Título | Sí | Con título y línea ya se guarda |
| Línea de negocio | Sí | Preseleccionada según el filtro activo |
| Estado | Sí | Empieza en el estado de tipo `INICIAL` del juego que aplique |
| Descripción en Markdown | No | Texto con formato, listas de verificación, enlaces, imágenes |
| Adjuntos | No | Fotos de referencia, bocetos, cotizaciones, archivos de diseño |
| Fecha límite | No | Solo fecha, u opcionalmente fecha y hora |
| Recordatorio | No | Requiere fecha límite |
| Responsable | No | Por defecto, quien la creó |
| Etiquetas | No | Agrupación transversal |
| Vínculos | No | A pedidos, contactos, ítems, egresos, activos |
| Entregables esperados | No | Uno o varios registros a crear al cerrarla |

**Subtareas:** listas de verificación dentro del Markdown (`- [ ]`), no un concepto nuevo. Es lo que sostiene el flujo de alfarería sin construir nada extra.

#### Vínculos
Bidireccionales y visibles desde ambos lados: pedido, ítem y contacto muestran su bloque "Tareas relacionadas". Los vínculos **no copian información**: reflejan el estado actual del original.

#### Entregables
Al crear la tarea se puede declarar qué debe existir al terminarla, y pueden ser **varios a la vez**: nuevo producto · nuevo insumo · nuevo proveedor · compra registrada · gastos registrados · nuevo activo. Al cerrar, el asistente abre cada formulario prellenado con lo que ya está en la tarea (título, línea, adjuntos, notas).

**Regla:** el asistente es una **oferta, no una obligación**. El usuario puede crear todos, algunos o **ninguno**, y cerrar la tarea igual. Si cierra sin crearlos, queda una marca discreta de *cerrada sin entregables*; no se pide justificación ni se bloquea nada.

#### Vistas y avisos
- **Por línea** · **Global** (con color de línea) · **Mis pendientes** (vencidas, hoy, próximos 7 días, sin fecha).
- Filtros por responsable, etiqueta, estado y vínculo.
- Avisos: resumen diario a la hora elegida · al acercarse la fecha límite · al vencer · al ser asignado · al quedar algo en revisión · cuando una tarea lleva demasiado tiempo sin moverse en un estado `EN CURSO`.
- **Regla anti-ruido:** avisos agrupados; un solo mensaje diario, nunca uno por tarea; cada tipo apagable por separado.

#### Lo que este módulo NO hará
Asignación de horas, dependencias entre tareas, diagramas de Gantt, comentarios tipo chat, tableros compartidos con clientes.

---

### 6.4 Bitácora de actividad

#### Qué problema resuelve
Cuando un número no cuadra, cuando algo desaparece o cuando el ayudante registra algo mal, la bitácora responde tres preguntas: **qué cambió, quién lo cambió y cuándo**.

#### Distinción importante
Define la **bitácora de actividad del negocio** — legible por una persona. No los registros técnicos de fallas del sistema, que son asunto de implementación y **no deben mezclarse en la misma pantalla**.

#### Qué se registra
Creación · modificación · cambio de estado · **archivado y desarchivado** · cobros, pagos y anulaciones · movimientos de inventario · accesos y cambios de rol · cambios de configuración (incluidos los juegos de estados) · exportaciones y accesos de plataformas externas.

#### Qué guarda cada evento

| Dato | Detalle |
|---|---|
| Fecha y hora | Del hecho real, no de la sincronización |
| Autor | Usuario, "sistema", o el nombre de la plataforma externa |
| Organización | Siempre |
| Línea de negocio | Cuando aplica (permite filtrar la bitácora por proyecto) |
| Tipo de registro e identificador | Para abrirlo directamente desde la bitácora |
| Acción | Creó, modificó, cambió de estado, archivó, desarchivó |
| Contenido del cambio | **Antes y después**, en formato estructurado, legible y exportable |
| Origen | App móvil, escritorio o conexión externa |

**En modificaciones se guardan solo los campos que cambiaron**, no el registro entero. Es la diferencia entre una bitácora útil y una que crece hasta volverse inmanejable.

#### Reglas irrenunciables
- **Inalterable:** no se edita ni se borra, **ni siquiera por el dueño**.
- **Automática:** nunca depende de que alguien recuerde registrarla.
- **Aislada por organización.**
- **Solo para el dueño/administrador.**
- **Respeta los permisos:** no puede ser una puerta trasera para ver montos que el rol no debería ver.
- **Sin datos sensibles:** nunca guarda contraseñas ni llaves. Los adjuntos se registran por referencia.
- **Agrupación de ruido:** ediciones sucesivas del mismo usuario sobre el mismo registro dentro de 5 minutos se consolidan en un solo evento.

#### Dos formas de verla — una sola fuente
1. **Historial contextual** dentro de cada pedido, tarea, ítem o contacto. Es lo que se consulta el 90 % de las veces.
2. **Bitácora general**, pantalla dedicada solo para el dueño, con filtros.

Ambas leen los mismos eventos. El historial de un pedido no es un registro aparte: es la bitácora filtrada.

#### Retención *(decisión tomada)*
- Detalle completo de eventos: **12 meses**.
- Después: se conserva un resumen (qué, quién, cuándo) sin el detalle del cambio.
- **Exportación automática antes de cualquier purga.** Nada se pierde de forma irreversible.
- El cambio de esta política también queda registrado.

---

### 6.5 Archivado en lugar de eliminación *(decisión tomada)*

**No existe la eliminación definitiva en Kamay.** Todo registro —pedido, tarea, ítem, contacto, egreso— se **archiva**: desaparece de las listas y buscadores del día a día, conserva su historial y puede desarchivarse.

Esta decisión simplifica el sistema más de lo que parece:

| Consecuencia | Detalle |
|---|---|
| **No hace falta un mecanismo de restauración** | Recuperar algo es desarchivarlo, no reconstruirlo desde la bitácora. Se elimina toda una funcionalidad compleja de la Fase 4. |
| **La bitácora no necesita guardar copias completas** | Como nada desaparece, basta con registrar el antes y después de lo que cambió. La bitácora crece bastante menos. |
| **Los reportes históricos nunca se rompen** | Un ítem archivado sigue existiendo para los pedidos de hace dos años. |
| **Los vínculos nunca quedan huérfanos** | Al archivar un registro con tareas vinculadas, el sistema avisa cuáles quedan apuntando a él, pero nada se rompe. |

**Reglas:**
- Archivar y desarchivar son acciones del dueño; el ayudante no archiva.
- Los registros archivados se consultan desde un filtro *Ver archivados*, presente en cada listado.
- Un registro archivado no se puede editar sin desarchivarlo primero.
- La única purga que existe es la de la bitácora antigua, siempre con exportación previa.

---

### 6.6 Imprescindibles (núcleo)

**Organización y líneas** — crear organización, invitar usuarios, roles; líneas con color e ícono; selector de línea global persistente; juegos de estados por organización y por línea.

**Contactos** — registro mínimo, roles, historial.

**Catálogo** — ítems con tipo, unidad, categoría, línea y variantes; precio referencial y último costo conocido.

**Egresos** — compras y gastos con línea obligatoria, comprobante y estado de pago.

**Pedidos y ventas** — pedido con cliente, líneas, fecha comprometida, **modo de entrega**, notas y fotos; tablero con estados configurables y **cola ordenada por antigüedad**; venta directa de feria en dos toques; anticipos, saldos, por cobrar y por pagar; acción *Crear tarea para este pedido*.

**Inventario suave** — saldo = compras − consumos ± ajustes; consumo rápido; ajuste por conteo; mínimo y alerta; stock de piezas terminadas para feria.

**Activos** — maquinaria con costo, fecha y línea; indicador de recuperación de inversión.

**Tareas** — tablero configurable por línea y global; Markdown; adjuntos; fecha límite; responsable; etiquetas; vínculos; entregables opcionales; *Mis pendientes*; avisos.

**Bitácora** — registro automático de todo cambio; historial contextual; pantalla general para el dueño con filtros.

**Archivado** — filtro *Ver archivados* en cada listado; desarchivar.

**Reportes** — rentabilidad · en qué se va el dinero · qué se vende más · insumos por acabarse · comparativo entre líneas.

**Acceso y roles** — *dueño* (todo) y *ayudante* (registra y opera; sin costos, márgenes, reportes, bitácora ni archivado).

### 6.7 Deseables (fases posteriores)
Plantillas y tareas recurrentes · avisos al celular · fichas de producto (recetas) · **lotes de producción con merma** (clave para alfarería y 3D) · cotizaciones y seguimiento público del pedido · cierre de feria · multi-moneda · exportación contable · puerta de conexión con otras plataformas.

### 6.8 Fuera de alcance
Facturación tributaria oficial, tienda pública, nómina, contabilidad de partida doble, app móvil instalable propia, automatizaciones con IA, gestión de proyectos avanzada, registros técnicos de fallas.

> **Regla de crecimiento:** ninguna funcionalidad se construye si obliga a crear un concepto ausente de la tabla 6.1.

---

## 7. Mapa de Vistas / Pantallas

> Redactada para copiarse directamente a una herramienta de generación de interfaces.

### V1 · Inicio de sesión
Logo de la organización, correo y contraseña, recuperación; selector si el usuario pertenece a varias organizaciones.

### V2 · Panel principal
Selector de línea persistente (Todas · Sublimación · 3D · Alfarería) · tarjetas de ingresos, egresos, margen y por cobrar según la línea · **tarjeta de pendientes** (vencidas en rojo, hoy, próximos 7 días) · pedidos que vencen · insumos bajo mínimo · últimos movimientos de la bitácora (solo dueño) · botón flotante *+ Registrar* · campana de notificaciones. El ayudante no ve tarjetas de dinero ni bitácora.

### V3 · Tablero de pedidos
Columnas según el juego de estados de la línea activa. Tarjetas con cliente, resumen, fecha comprometida, **modo de entrega** (ícono de recojo o delivery), señal de pago, color de línea, indicador de tareas relacionadas abiertas y alerta de retraso **que ignora estados de tipo `EN ESPERA`**. En columnas marcadas como cola, orden por antigüedad con **número de posición visible**. Arrastrar entre columnas, filtrar, alternar a lista o calendario, **ver archivados**.

### V4 · Detalle de pedido
Cliente, línea, canal, modo de entrega, líneas del pedido, fechas, notas, fotos, cobros y saldo. Bloque de rentabilidad **(solo dueño)**. Bloque **Tareas relacionadas** con acción *+ Crear tarea para este pedido*. Bloque **Historial**.

### V5 · Nuevo pedido
Línea preseleccionada, buscador de cliente con creación al vuelo, líneas desde catálogo, fecha comprometida, canal, **modo de entrega**, nota, foto. *Guardar* · *Guardar y crear otro*.

### V6 · Venta rápida (modo feria) 🔑
Cuadrícula grande de productos con foto y precio; carrito con total; canal y línea preseleccionados; cliente opcional. Tocar → *Cobrar* → *Listo*. **Funciona sin conexión** e indica cuántas ventas faltan sincronizar.

### V7 · Egresos
Lista cronológica con fecha, tipo, proveedor o categoría, línea, monto y estado de pago; totales; filtros por línea, tipo, proveedor, categoría, fecha y etiqueta.

### V8 · Nueva compra
Proveedor, fecha, línea, insumos con cantidad y precio, total, estado de pago, comprobante.

### V9 · Nuevo gasto
Monto, categoría, línea, fecha, nota, comprobante, etiqueta, casilla "asignar a un pedido". Deliberadamente corto.

### V10 · Catálogo
Lista filtrable por tipo y línea; saldo, último costo, precio de venta, etiqueta de línea o "compartido"; filtro *Ver archivados*.

### V11 · Detalle de ítem
Datos generales, variantes, evolución de precios de compra, historial de consumo o ventas, mínimo, proveedores habituales, líneas donde se usa, tareas relacionadas e historial de cambios.

### V12 · Activos
Lista con costo, fecha, línea y **barra de recuperación de inversión**; tareas de mantenimiento relacionadas.

### V13 · Contactos
Directorio buscable con rol, datos, totales acumulados, líneas relacionadas, tareas relacionadas e historial.

### V14 · Reportes
Selector de periodo y de línea; cinco informes con gráfico y tabla ordenable; regla de reparto de gastos compartidos visible; exportar. **Solo dueño.**

### V15 · Configuración de la organización
Nombre, logo, moneda; líneas de negocio; canales; **juegos de estados** (V22); categorías de gasto; unidades; preferencias de notificación; política de retención de la bitácora; módulos activables; usuarios y roles; regla de reparto.

### V16 · Registro rápido (móvil)
Botones grandes: Venta rápida · Pedido · Compra · Gasto · Consumo · Tarea. Formularios mínimos. Funciona sin conexión.

### V17 · Tablero de tareas
Columnas según el juego de estados de la línea activa. Tarjetas con título, color e ícono de línea, fecha límite con semáforo, responsable, etiquetas e íconos de adjuntos, vínculos y entregables. **Arrastrar hacia atrás permitido** (una revisión que vuelve a *Por hacer* es normal y no ensucia nada). Al soltar en un estado `FINAL` con entregables declarados, se abre V19.

### V18 · Detalle de tarea
Título editable, estado, línea, responsable, fecha límite, recordatorio, etiquetas. **Cuerpo en Markdown** con editor sencillo (negrita, listas, verificación, enlaces) y vista previa. **Adjuntos** arrastrables con miniaturas. **Vínculos** mediante buscador único de pedidos, contactos, ítems, egresos y activos. **Entregables esperados** (varios posibles). **Historial**.

### V19 · Cierre de tarea con entregables
Lista de entregables declarados, cada uno con formulario prellenado desde la tarea y casilla para incluirlo o no. *Crear seleccionados y cerrar* · ***Cerrar sin crear nada*** · *Cancelar*.

### V20 · Mis pendientes
Cuatro grupos con contador — **Vencidas**, **Hoy**, **Próximos 7 días**, **Sin fecha**. Marcar hecha, reprogramar con un toque, abrir detalle, filtrar.

### V21 · Notificaciones
Lista cronológica agrupada por tipo; no leídas destacadas; acceso a preferencias.

### V22 · Configuración de estados
Selector de flujo (Pedidos / Tareas) y de alcance (organización o línea específica). Lista ordenable de estados con nombre, color, **tipo declarado** y marca opcional de **"columna en cola"** (ordena por antigüedad y muestra posición). Aviso visible: "Los cambios no afectan la historia de pedidos y tareas anteriores". Acciones: agregar, renombrar, recolorear, reordenar por arrastre, archivar (pidiendo a dónde mover lo que quedaba), restaurar valores por defecto, *usar el juego de la organización*. Valida al menos un `INICIAL` y un `FINAL`.

### V23 · Bitácora de actividad
Lista cronológica invertida, **solo dueño**. Cada fila: fecha y hora, autor, acción en lenguaje natural ("Registró el proveedor *Insumos del Sur*"), tipo de registro con identificador, línea y origen. Al desplegar: antes y después con campos cambiados resaltados. Filtros por rango de fechas, línea, usuario, tipo de registro, tipo de acción y búsqueda por identificador o texto. Acciones: abrir el registro afectado, **desarchivar** si corresponde, exportar el resultado filtrado. Aviso visible de que no puede editarse y de la política de retención vigente.

---

## 8. Flujo de Usuario

### Flujo A — Pedido de sublimación, de principio a fin
1. Llega un encargo de 20 tazas. Se registra en **V5**, línea *Sublimación*, modo de entrega *delivery*. El pedido queda en **Registrado**.
2. Desde **V4**, acción *Crear tarea para este pedido*: se crea "Diseñar arte pedido #142", prellenada, con la referencia del cliente adjunta. El pedido pasa a **En diseño**.
3. En **V17**, la tarea recorre *Por hacer* → *Haciendo* → *En revisión*. El cliente pide un cambio: se arrastra de vuelta a *Por hacer* y sigue el ciclo. El pedido no se movió: sigue *En diseño*, como corresponde.
4. Aprobado el diseño, la tarea se cierra y el pedido pasa a **En cola**, donde aparece con su número de posición según orden de llegada.
5. Llega su turno: pasa a **Sublimando**, donde una lista de verificación cubre prensado, enfriado, encajonado y anotación de los datos del cliente. Al terminar, **Listo para entrega**.
6. Se lleva al punto acordado, se cobra el saldo y pasa a **Entregado**.
7. Todo el recorrido queda en la bitácora, con autor y hora de cada paso.

### Flujo B — Pieza de alfarería, de la arcilla a la feria
1. Se crea la tarea "Set de 6 tazas artesanales", línea *Alfarería*, etiqueta `hornada-07`, con la lista de verificación: modelado · secado · primera quema · esmaltado · segunda quema. Entregable declarado: **Nuevo producto**.
2. Durante dos semanas se van marcando los pasos y subiendo fotos del avance. No hay tablero de pedidos involucrado.
3. Al terminar, **V19** ofrece la ficha de producto prellenada con las fotos; se crea con su precio y entra al catálogo con stock disponible.
4. En la feria, se vende desde **V6**, canal *Feria*. Nunca hizo falta un pedido.

### Flujo C — Primeros encargos de 3D
1. Se activa la línea con el juego de estados provisional.
2. Se registran los primeros 10 encargos reales y se observa dónde se acumulan.
3. Si el modelado lo haces tú, aparece la necesidad de una tarea de modelado — igual que el diseño en sublimación.
4. Se ajusta el flujo en **V22** en un minuto, sin tocar nada más y sin alterar el historial de los encargos anteriores.

### Flujo D — Pedido de llaveros y falta de filamento
1. Se registra el pedido en la línea *3D*.
2. Se crea la tarea "Revisar filamento", vinculada al pedido y al ítem *filamento*, con entregable **Compra registrada**.
3. El vínculo muestra el saldo actual sin salir de la tarea. Falta material: se contacta al proveedor desde ahí mismo.
4. Al cerrarla, **V19** ofrece el formulario de compra prellenado. El saldo sube y la alerta desaparece.

### Flujo E — Día de feria
1. Antes: tarea "Preparar feria de agosto" con etiqueta `feria-agosto` y lista de verificación.
2. En el puesto, ventas desde **V6**, sin señal. Al sincronizar, la bitácora conserva la hora real de cada venta.
3. Al volver: tarea "Cargar gastos de feria" con entregable **Gastos registrados** — stand, taxi, almuerzo, ya etiquetados.

### Flujo F — "Este número no cuadra"
1. El saldo de un insumo no coincide con el estante.
2. En **V11**, bloque *Historial*, se ve cada entrada, consumo y ajuste con autor y fecha.
3. Aparece un consumo registrado dos veces. Se corrige con un ajuste por conteo, que también queda registrado.

### Flujo G — Recuperar algo archivado por error
1. Se archivó una tarea con información valiosa.
2. Se activa *Ver archivados* en **V17** —o se filtra la acción *archivó* en **V23**— y se desarchiva.
3. La tarea vuelve intacta, con todo su historial. El desarchivado queda registrado.

### Flujo H — Cierre de mes
**V14** con la línea "Todas": comparativo entre líneas y rendimiento por canal. Luego **V20**: lo que lleva más de un mes quieto se cierra o se replantea.

### Flujo I — Nueva organización
Se crea desde el selector, con moneda, líneas, estados, categorías y usuarios propios. Datos y bitácora aislados de Geeko Store.

---

## 9. Necesidad de Datos y Persistencia

| Grupo de información | Contenido | Cambio | Volumen |
|---|---|---|---|
| Organizaciones y configuración | Negocio, líneas, canales, juegos de estados, categorías, preferencias, retención | Muy bajo | Mínimo |
| Usuarios y permisos | Cuentas, roles, pertenencia | Muy bajo | 2 – 3 |
| Contactos | Proveedores y clientes | Bajo | Cientos |
| Catálogo e ítems | Insumos, productos, activos, variantes | Medio | Cientos |
| Pedidos y sus líneas | Corazón operativo | Alto (diario) | Miles/año |
| Ventas directas | Feria y mostrador | Alto en ferias | Miles/año |
| Egresos | Compras y gastos | Alto (diario) | Miles/año |
| Movimientos de inventario | Entradas, salidas, ajustes | Alto | Miles/año |
| Cobros y pagos | Dinero real | Alto | Miles/año |
| Tareas y vínculos | Trabajo propio y sus relaciones | Alto (diario) | Cientos/año |
| Recordatorios y avisos | Programación y lectura | Alto, efímero | Miles |
| **Bitácora de actividad** | Un evento por cada cambio | **El más alto de todos** | Decenas de miles/año |
| Adjuntos | Fotos de diseño, referencias, comprobantes | Medio-alto | **Crece mucho: requiere previsión** |

### Reglas de datos que el negocio necesita
- **Toda información pertenece a una organización.** Ningún dato sin dueño ni visible desde otra.
- **Toda información económica y toda tarea pertenece además a una línea.**
- **Nada se elimina: todo se archiva**, y lo archivado puede volver.
- **Los precios históricos no se reescriben.**
- **Lo derivado nunca se guarda como dato editable.**
- **Los estados históricos no se reescriben:** cambiar la configuración de estados no altera el pasado. Un pedido que pasó por *En cola* lo conserva aunque esa columna ya no exista.
- **Los vínculos apuntan al original, nunca copian.**
- **La bitácora es inalterable y automática**, con una sola fuente para el historial contextual y la pantalla general.
- **Retención de bitácora: 12 meses de detalle**, resumen después, exportación automática antes de cualquier purga.
- **Los adjuntos necesitan política desde el día uno:** compresión, tamaño máximo por archivo y por tarea.
- **Exportación completa** a hoja de cálculo en cualquier momento.
- **Copias de seguridad automáticas**, con al menos una fuera del sistema.

---

## 10. Integraciones y Funcionalidades de Terceros

### Necesarias
| Necesidad | Para qué |
|---|---|
| Almacenamiento de imágenes y archivos | Diseños, referencias, comprobantes |
| Correo transaccional | Invitaciones, recuperación, resumen diario y avisos |
| Programación de avisos en el tiempo | Disparar recordatorios sin la app abierta |
| Exportación a hoja de cálculo | Respaldo, contabilidad externa, análisis, purga de bitácora |

### Deseables después
Aviso directo al celular · mensajería instantánea para avisar al cliente que su pedido está *Listo para entrega* · documentos imprimibles · cobros en línea · escaneo de códigos · calendario externo.

### Puerta de conexión con otras plataformas *(preparación futura)*
Permisos por organización y por alcance · lo que entre sigue las mismas reglas que lo registrado a mano, con evento de bitácora identificando a la plataforma externa como autor · registro de actividad · revocable en cualquier momento.
No se construye en el MVP, pero **las decisiones de las Fases 0 y 1 no deben cerrarle la puerta**.

### Deliberadamente evitado
Depender de un servicio externo para algo esencial del núcleo.

---

## 11. Consideraciones de Buenas Prácticas

### Facilidad de uso
- **Mobile-first para registrar**, escritorio para analizar y auditar.
- **Regla de los tres toques** para registros frecuentes; tarea nueva en menos de 10 segundos.
- **Markdown sin exigir Markdown:** barra de herramientas para quien nunca escribió un asterisco.
- **La configuración avanzada no estorba:** los estados por defecto funcionan sin tocar nada; V22 vive en configuración, no en el camino diario.
- **La bitácora se lee en lenguaje natural**, no en jerga.
- El sistema recuerda el contexto: última línea, último canal, último proveedor.
- Confirmación solo en acciones destructivas; **deshacer** en las frecuentes.
- Mensajes de error en lenguaje humano.

### Notificaciones sin fatiga
Resumen diario agrupado, cada tipo apagable, nunca dos avisos por lo mismo. **La bitácora nunca genera notificaciones.**

### Rendimiento
- Registrar debe sentirse instantáneo aun con mala señal.
- **Sin conexión obligatorio** en venta rápida, pedidos, gastos y creación de tareas.
- **Registrar en la bitácora nunca puede frenar ni hacer fallar una operación.**
- Los adjuntos se comprimen y suben en segundo plano.
- La bitácora se consulta con filtros y por páginas: nunca se carga entera.

### Seguridad y privacidad
- Acceso solo con cuenta; sesiones que expiran en dispositivos compartidos.
- **Aislamiento entre organizaciones verificable**, también en la bitácora.
- Permisos reales por rol: el ayudante no ve costos, márgenes ni bitácora, ni a través de una tarea vinculada ni manipulando la dirección del navegador.
- Los adjuntos son tan privados como el registro al que pertenecen.
- Datos de clientes tratados como sensibles.

### SEO
**No aplica al MVP:** sistema interno que no debe aparecer en buscadores.

### Mantenibilidad — la lección de la versión anterior
- Este documento es la fuente de verdad.
- Prohibido crear conceptos que se solapen con los de la tabla 6.1.
- **Prohibido duplicar flujos:** tareas y pedidos son tableros distintos y no se sincronizan.
- **Prohibido un segundo historial:** todo lo que muestre "qué pasó aquí" lee de la bitácora.
- **Prohibido anidar flujos:** un proceso con su propio ciclo de idas y vueltas (el diseño) vive en una tarea vinculada, nunca como columnas del pedido.
- **La flexibilidad siempre viene con su regla:** cada estado declara su tipo.
- Nada derivado se guarda como dato editable.
- Cada fase queda utilizable por sí sola.
- Si al agregar algo hay que tocar más de dos partes del sistema, el concepto está mal ubicado.

---

## 12. Alcance y Fases (Roadmap)

### Fase 0 — Cimientos *(no negociable, va primero)*
Organizaciones con aislamiento real · usuarios y roles · líneas y canales · catálogo · contactos · juegos de estados con valores por defecto · archivado · **registro de eventos de bitácora desde el primer día**.

> **Advertencia importante:** la bitácora **debe registrar desde el inicio**, aunque la pantalla para consultarla llegue después. Un historial no se reconstruye hacia atrás: lo que no se registró el primer mes, se perdió. Registrar es Fase 0; visualizar puede esperar.

### Fase 1 — MVP: el ciclo del dinero
Pedidos con estados configurables y columnas en cola · **flujo de sublimación cargado** · venta rápida de feria sin conexión · egresos con línea obligatoria · cobros y pagos · registro rápido móvil · panel principal · historial contextual.
**Criterio de salida:** un mes completo, incluida una feria, operado sin herramientas paralelas.

### Fase 2 — Tareas: el trabajo propio
Tablero configurable por línea y global · Markdown · adjuntos · fecha límite y responsable · etiquetas · *Mis pendientes* · avisos y resumen diario · acción *Crear tarea para este pedido*.
*Esta fase es la que habilita el flujo de diseño de sublimación y el de producción de alfarería.*

### Fase 3 — Inventario suave, activos y reportes
Saldos, consumo, ajustes, alertas de mínimo · activos con recuperación de inversión · los cinco reportes · exportación.

### Fase 4 — Bitácora completa y tareas conectadas
Pantalla de bitácora general con filtros y exportación · política de retención configurable · vínculos bidireccionales completos · entregables múltiples y asistente de cierre · plantillas y tareas recurrentes · avisos al celular.
*(Ya no incluye restauración: con archivado en lugar de eliminación, recuperar es desarchivar.)*

### Fase 5 — Precisión y producción
Fichas de producto (recetas) · costeo automático y sugerencia de precio · **lotes de producción con merma** — el momento en que la cadena de alfarería y 3D deja de ser lista de verificación y pasa a ser producción real · reparto configurable de gastos compartidos · comparación entre periodos.

### Fase 6 — Cara al cliente y expansión
Cotizaciones · seguimiento público del pedido · cierre de feria · documentos imprimibles · puerta de conexión con otras plataformas · módulos por línea.

> **Regla de fases:** no se empieza una fase con la anterior a medio terminar.
>
> **Nota sobre el orden 2 ↔ 3:** las tareas van antes que los reportes porque el dolor es diario y el módulo es autónomo. Además, sin Fase 2 el flujo de diseño de sublimación no tiene dónde vivir. Se pueden intercambiar, pero **no construir ambas a la vez**.

---

## 13. Riesgos, Dudas y Decisiones Pendientes

### Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Abandono por fricción de captura | Alto — el sistema muere | Medir tiempos contra las metas de la Sección 2 |
| Repetir el desorden por agregar de más | Alto | Regla 6.1 |
| Tareas y pedidos gestionando lo mismo | Alto | Regla 6.3; el pedido nunca genera tarea automática |
| **Inventar flujos para 3D y alfarería antes de tener práctica** | **Alto** | Juegos provisionales + método de los 10 encargos (6.2) |
| Estados personalizados que rompen reportes y alertas | Alto | Tipo declarado obligatorio en cada estado |
| Bitácora que crece hasta volverse inmanejable | Alto | Solo campos cambiados · agrupación de ediciones · retención de 12 meses |
| Bitácora ilegible por exceso de ruido | Medio-alto | Lenguaje natural, filtros, historial contextual como puerta principal |
| Bitácora como filtración de datos | Medio-alto | Acceso exclusivo del dueño; nunca guarda contraseñas |
| Olvidar asignar la línea y mezclar cuentas | Alto | Línea obligatoria + preselección + reporte de movimientos sin línea clara |
| Tablero de tareas que se llena y se abandona | Alto | *Mis pendientes* por defecto en móvil; revisión mensual |
| Fatiga de notificaciones | Medio-alto | Avisos agrupados, todo apagable |
| Venta de feria no registrada por falta de señal | Alto | Sin conexión no negociable en Fase 1 |
| Adjuntos creciendo sin control | Medio-alto | Compresión y límites desde el inicio |
| **Merma de cerámica y 3D sin contabilizar** | Medio | Anotarla como consumo desde Fase 3; lotes con merma en Fase 5 |
| Inventario desincronizado de la realidad | Medio | Ajuste por conteo sin penalización |

### Decisiones ya resueltas
- ✅ **Archivado, no eliminación definitiva.**
- ✅ **Retención de bitácora: 12 meses** de detalle, resumen después, con exportación previa.
- ✅ **Flujo de sublimación cerrado:** 6 estados, diseño como tarea vinculada, entrega como atributo, empaque dentro de *Sublimando*.
- ✅ **Alfarería entra al consolidado** de Geeko Store, sin tratamiento especial.
- ✅ **Flujos provisionales para 3D y alfarería**, a confirmar con la práctica.
- ✅ **Sublimación, 3D y alfarería son líneas dentro de una sola organización**, no organizaciones separadas.

**Nada de lo anterior bloquea ya el arranque.** Las decisiones que siguen se resuelven durante la construcción o se pueden dejar en su valor recomendado.

### Decisiones abiertas (no bloqueantes)
1. **Categorías de gasto iniciales.** Se define al cargar los primeros gastos reales; basta empezar con cinco o seis y agregar sobre la marcha.
2. **Regla por defecto de reparto de gastos compartidos.** Recomendación: proporcional a los ingresos de cada línea, siempre visible junto al resultado.
3. **Orden de Fases 2 y 3:** ¿tareas primero o reportes primero?
4. **¿El ayudante puede ver el historial de los registros que tocó?** Recomendación: sí el contextual, nunca la bitácora general.
5. **¿Una tarea puede pertenecer a más de una línea?** Recomendación: no.
6. **¿La "feria" merece ser un concepto propio** o basta con etiquetas? Recomendación: etiquetas primero, revisar tras dos o tres ferias.
7. **Migración:** ¿se rescata algo de la versión anterior o se arranca limpio con catálogo y contactos vivos?
8. **Personalización en el pedido:** ¿nota + foto, o campos estructurados (medida, texto, color, tipografía)?
9. **Moneda y decimales**; compras en otra moneda.
10. **¿La impresora 3D producirá para terceros?** Si sí, es otro canal, no otra línea.
11. **Dónde vive el sistema:** ¿accesible desde internet o solo local?

---

## 14. Próximos Pasos

1. **El documento está listo para construir.** Ya no hay decisiones bloqueantes: los tres flujos están definidos, el modelo conceptual está cerrado y las reglas de crecimiento están escritas.
2. **Aceptar que 3D y alfarería arranquen provisionales.** El método de los 10 encargos es más confiable que cualquier flujo diseñado en el aire, y cambiarlo después cuesta un minuto en V22.
3. **Usar la Sección 7 como insumo de diseño de interfaz**, una pantalla a la vez. Orden sugerido: **V6 (Venta rápida)** → **V3 (Tablero de pedidos, con el flujo de sublimación cargado)** → **V2 (Panel)** → **V17 (Tablero de tareas)** → **V18 (Detalle de tarea)** → **V23 (Bitácora)**.
4. **Entregar este documento completo a quien construya**, con la instrucción explícita: *construir Fase 0 y Fase 1 únicamente, respetando los cuatro principios del Resumen Ejecutivo y registrando eventos de bitácora desde el primer día.*
5. **Mantener el documento vivo:** cada cambio de alcance se escribe aquí antes de construirse. Esa disciplina —y no la herramienta que se use— es lo que evita repetir la historia de Kamay v1.

---

*Documento generado como especificación funcional agnóstica de tecnología. No contiene decisiones de implementación.*
