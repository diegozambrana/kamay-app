# KAM-19 · Activos y recuperación de inversión

## Why

Desde KAM-06 el catálogo acepta ítems de tipo activo, y su propia especificación lo dice con todas las letras: un activo se guarda «sin exigir costo de adquisición ni fecha (esos datos llegan con los activos)». Nunca llegaron. Hoy la impresora 3D es un nombre en una pestaña del catálogo: no tiene costo, no tiene fecha de compra y no hay forma de saber si ya se pagó sola. La única vía es abrir egresos, abrir el tablero de pedidos y sumar meses de cabeza — exactamente el trabajo manual que Kamay existe para eliminar.

Esta tarea entrega **V12 · Activos**: una pantalla que responde de un vistazo la pregunta que el taller se hace cada vez que evalúa comprar una máquina nueva —«¿la anterior ya se pagó?»— y que hasta ahora se respondía por intuición.

> **Posición en la secuencia.** El backlog sitúa KAM-19 tras KAM-18 (inventario suave), que aún no existe. KAM-19 **no depende de ella**: la recuperación se calcula con pedidos (KAM-07/08), egresos (KAM-09) y movimientos de dinero (KAM-10), las tres ya fusionadas. El marcador de posición de *insumos bajo mínimo* que KAM-14 dejó en el panel sigue siendo un marcador; esta tarea no lo toca.

## What Changes

### Modelo: el activo deja de ser solo un nombre

- **Tabla `asset_details`** (§7 del esquema canónico): `item_id` como llave primaria contra `items`, `acquisition_cost`, `acquired_on`, `supplier_id` y `notes`. Un activo es un ítem del catálogo con datos propios, no una entidad paralela: eso es lo que permite que la pestaña *Activos* de V10, el buscador de vínculos y la línea de compra sigan hablando del mismo registro.
- **Lectura y escritura exclusivas de la persona dueña**, impuestas en RLS y no solo en la interfaz: la matriz de acceso §16 marca `asset_details` como *sin acceso* para el ayudante, y el costo de la maquinaria es precisamente el dato que esa fila protege.
- **Un egreso puede pertenecer a un activo.** `expenses` suma `asset_id` y el papel que ese egreso cumple para el activo: **adquisición** (el egreso con el que se compró) o **mantenimiento** (todo lo que se gastó después en mantenerlo andando). Es el mismo mecanismo con el que un gasto ya se asigna a un pedido mediante `order_id`, aplicado al otro destino que el backlog reclama.

### Derivados: qué ha devuelto la máquina y cuánto ha costado

- **Vista `line_cash_movements`**: los movimientos de dinero con la línea de negocio que les corresponde y, cuando el egreso pagado pertenece a un activo, ese activo. Es la fuente única de «qué dinero entró y salió de esta línea», y de ella pasa a leer también `cash_flow_by_line_month`, que hoy repite ese mismo empalme por su cuenta. Un solo lugar decide qué es un movimiento de caja de una línea; si mañana cambia, cambia una vez.
- **Vista `asset_recovery`**: por activo, su costo declarado, su mantenimiento acumulado, su costo total y el **margen de caja de su línea desde la fecha de adquisición**. Devuelve los ingredientes, no el porcentaje.
- **`lib/assets/recovery.ts`**: la fórmula de recuperación, en una función pura con sus casos límite —costo cero, margen negativo, recuperación superada—. El criterio 6 del backlog pide que la fórmula viva en un solo lugar del código, y las pruebas requeridas piden que sea unitaria: una función pura satisface ambas cosas; una expresión escondida en el `select` de una vista, ninguna.

### La inversión cuenta una sola vez

El dinero que se fue en comprar y mantener la máquina es el **denominador** de la barra. Por eso **no vuelve a contarse como egreso operativo de su línea en el numerador**: los pagos de egresos que pertenecen a un activo quedan fuera del margen con el que ese activo se mide. Sin esta regla, una máquina tendría que generar dos veces su costo para llegar al 100 %, y la barra mentiría en la única cifra que existe para responder.

La regla es local a la recuperación de activos. El panel V2 sigue mostrando en *Egresos del mes* todo lo que salió de caja, comprar una impresora incluido: eso sí salió de caja.

### V12 · Activos

- **Página `/assets`, solo del dueño**, en el grupo *Base* del menú de escritorio y bajo «Más» en el celular, según el mapa §4.1 y §4.2. Un ayudante no la ve en su menú y, si abre la dirección, va a su aterrizaje habitual — el mismo trato que ya recibe `/expenses`.
- **Tarjetas** con nombre, línea, costo de adquisición, fecha, mantenimiento acumulado y **barra de recuperación**. Un activo ya recuperado se indica de forma sobria: la barra llena y una marca discreta, sin celebración.
- **Detalle en panel lateral** —el formato que el mapa §7 pide para V12— con los datos del activo, la lista de sus gastos de mantenimiento y el acceso a registrar uno nuevo.
- **Filtro *Ver archivados***, como todo listado del sistema.

### Cómo nace un activo, y cómo se le carga el mantenimiento

- **Desde el catálogo**: en el detalle de un ítem de tipo activo (V11), la persona dueña registra su costo y su fecha. El ítem ya existía; lo que se añade son sus datos de activo.
- **Desde una compra**: al registrar una compra cuya línea apunta a un ítem de tipo activo, se ofrece declararlo como activo con el costo y la fecha ya prellenados desde esa compra, y ese egreso queda marcado como su adquisición.
- **Vincular un gasto de mantenimiento** a un activo, desde el detalle del activo o desde el detalle del egreso.

### Un activo es un destino vinculable de una tarea

`task_links` acepta `entity_type = 'asset'` desde KAM-15, pero su trigger de validación rechaza hoy todo vínculo de ese tipo con un comentario explícito: «`asset_details` llega con KAM-19; hasta entonces no hay a qué apuntar». Ya llega. La validación pasa a comprobar contra `asset_details`. Solo eso: el buscador de vínculos y el bloque *Tareas relacionadas* de V12 son de KAM-21.

**Fuera de alcance** (copiado del backlog):
- Depreciación contable, valor residual, tablas de amortización.
- Programación de mantenimiento preventivo; una tarea con fecha basta.

Derivado de lo anterior, tampoco entran: el bloque *Tareas relacionadas* en V12 y el buscador único de vínculos (KAM-21); el reparto de los gastos de la línea General entre líneas, que es la regla configurable de V14 (KAM-20) y sin la cual un activo de la línea compartida no tiene margen que mostrar; los saldos y consumos de inventario (KAM-18), que no intervienen en la recuperación; cualquier informe de activos en V14 (KAM-20); y la venta o baja de un activo, que ninguna tarea del backlog reclama y que hoy se resuelve archivando el ítem.

## Capabilities

### New Capabilities

- `assets`: el activo como ítem con datos propios —costo de adquisición, fecha, proveedor y notas—, su costo total con el mantenimiento acumulado, la fórmula de recuperación de inversión y su barra, la pantalla V12 con su detalle en panel, el alta desde el catálogo y desde una compra, el recorte al dueño en base de datos y la validación de un activo como destino de vínculo de una tarea.

### Modified Capabilities

- `payments`: el requisito *Flujo de caja del periodo por línea* describe hoy un agregado por mes, que es la única forma de leer los movimientos de una línea. La recuperación necesita el mismo empalme con un corte por **fecha arbitraria** —la de adquisición— y necesita saber qué pagos corresponden a un activo. Se añade el requisito del **movimiento de caja con su línea y su activo**, del que el agregado mensual pasa a derivarse en lugar de repetir el empalme.
- `expenses`: el modelo de egreso gana la **pertenencia a un activo** con su papel —adquisición o mantenimiento—, con sus restricciones (a lo sumo un egreso de adquisición por activo; el activo y el egreso de la misma organización) y su reflejo en el detalle del egreso. Es una relación nueva sobre `expenses`, no un detalle de implementación.
- `catalog-directory`: el requisito *Un ítem declara su tipo, su unidad y su alcance de línea* aplaza hoy explícitamente el costo y la fecha de un activo («esos datos llegan con los activos»). Llegan aquí: el detalle de ítem (V11) de un activo ofrece a la persona dueña registrarlos y editarlos, y la semilla de Geeko Store pasa a incluir un activo con sus datos completos.

## Impact

**Código afectado**

- `app/(app)/assets/page.tsx` — página nueva, resuelve la sesión de dueño antes del primer render.
- `features/assets/*` — lista de tarjetas, barra de recuperación, panel de detalle, formulario de datos del activo y diálogo de vinculación de mantenimiento (feature nueva).
- `services/assets/asset-service.ts` — lectura de `asset_recovery` y escritura de `asset_details` (servicio nuevo).
- `actions/assets/*` — alta y edición de los datos del activo, y vinculación de un egreso (acciones nuevas).
- `lib/assets/recovery.ts` — la fórmula y sus casos límite (módulo nuevo).
- `lib/auth/routes.ts` — `/assets` entra en `PROTECTED_PREFIXES`.
- `components/layout/nav-entries.ts` — entrada *Activos*, `roles: ["owner"]`, `mobile: "more"`.
- `features/catalog/item-detail.tsx` — el detalle de un ítem de tipo activo ofrece sus datos de activo.
- `features/expenses/*` — el detalle del egreso muestra y permite su vínculo con un activo; el formulario de compra ofrece declarar activo una línea de tipo activo.

**Se lee pero no se modifica:** `order_totals` y `expense_totals` (KAM-09/KAM-10), `payments` y su restricción de destino único (KAM-10), `items` e `item_variants` (KAM-06), el selector de línea y `resolveActiveLine` (KAM-04/KAM-13), `is_owner()` y el patrón de RLS del proyecto (KAM-02).

**Base de datos:** dos migraciones nuevas — la tabla `asset_details` con su RLS, sus privilegios y su trigger de bitácora, más la columna de pertenencia a un activo en `expenses`; y las vistas derivadas `line_cash_movements` y `asset_recovery`, con la redefinición de `cash_flow_by_line_month` sobre la primera y la actualización de `validate_task_link()`. Cada una con su prueba pgTAP. Ninguna cifra derivada en columna (convención nº 4); ninguna política `DELETE` (convención nº 3).

**Dependencias:** ninguna nueva. La barra se dibuja con Tailwind, como el comparativo de V2.

**Pruebas:** unitarias sobre `lib/assets/recovery.ts` (costo cero, margen negativo, recuperación exacta, recuperación superada, mantenimiento que mueve el denominador); pgTAP sobre el acceso a `asset_details` por rol, sobre la exclusión de la inversión del margen de la línea y sobre la aceptación de `asset` en `validate_task_link()`; e2e `assets.spec.ts` con el alta de un activo, el registro de ventas y la verificación de la barra, más la ausencia de `/assets` para el ayudante.

## Supuestos registrados

1. **El margen que llena la barra se mide en caja, no en devengado.** Decidido con la persona usuaria. Es la misma base que KAM-14 fijó para el *Margen* del panel (D1 de aquella tarea), de modo que las dos pantallas no dan dos respuestas distintas a la misma palabra. El precio aceptado: un pedido entregado y no cobrado todavía no llena la barra; *Por cobrar* en V2 es lo que explica la diferencia. El esquema canónico §11 esboza la vista sobre `order_totals` —base devengada—; es un esbozo, y el propio documento remite el cálculo del margen a «la aplicación o una vista adicional».
2. **La inversión cuenta una sola vez: en el denominador.** Decidido con la persona usuaria. Los pagos de egresos que pertenecen a un activo —su adquisición y su mantenimiento— no restan del margen con el que ese activo se mide. La regla no sale de la capacidad `assets`: el panel V2 y los futuros informes de V14 siguen viendo esos pagos como egresos de la línea.
3. **`acquisition_cost` es un dato declarado, no derivado del egreso.** Cuando el activo nace de una compra, la cifra se prellena desde esa línea de compra y queda editable: una compra puede traer la máquina y sus accesorios en el mismo documento, y el costo del activo no siempre es el total del egreso. El vínculo con el egreso de adquisición se guarda igual, porque es lo que permite excluir ese pago del margen.
4. **Un activo de la línea compartida no muestra porcentaje.** `items.business_line_id` admite `null` («Compartido», KAM-06), y la línea General no tiene ingresos propios por definición: su margen es siempre negativo y la barra sería siempre 0 %, lo que no informa de nada. En ese caso la tarjeta muestra costo, fecha y mantenimiento, y declara que la recuperación no es atribuible a una línea hasta que exista la regla de reparto de V14 (KAM-20). No se inventa aquí un reparto que el backlog asigna a otra tarea.
5. **Archivar el ítem archiva el activo.** No hay archivado propio de `asset_details`: un activo es un ítem, y `items.archived_at` ya es la única marca de archivado del catálogo. La lista de V12 respeta ese filtro y su «Ver archivados» es el mismo de siempre.
6. **La validación de vínculos a activos se cierra aquí aunque nada la use todavía.** El comentario de la migración de KAM-15 la asigna nominalmente a esta tarea. Se limita a la validación en base de datos; ninguna interfaz crea vínculos a activos hasta KAM-21.
