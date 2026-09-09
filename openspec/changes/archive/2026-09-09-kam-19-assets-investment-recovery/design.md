# KAM-19 · Diseño

## Context

Ver `proposal.md` § Why para la motivación. Lo que condiciona el diseño es el terreno que ya está puesto:

- **`items` ya distingue el activo** (`kind = 'asset'`, KAM-06) y `asset_details` está esbozada en el esquema canónico §7 con `item_id` como clave primaria. El activo no es una entidad nueva: es un ítem con datos propios.
- **El dinero ya se lee por línea.** `cash_flow_by_line_month` (KAM-14) resuelve el empalme `payments → orders | expenses → business_line_id` y lo agrega por mes, con la condición `is_owner()` dentro de la vista porque `security_invoker` no bastaba. La recuperación necesita ese mismo empalme con un corte por fecha arbitraria.
- **`expense_totals`** (KAM-09) da el total de cualquier egreso, con `amount` propio para el gasto y la suma de líneas para la compra.
- **La matriz de acceso §16 marca `asset_details` como *sin acceso* para el ayudante.** No es una decisión de esta tarea; es una restricción heredada, y el criterio 5 del backlog exige que sea comprobable en base de datos.
- **`validate_task_link()`** (KAM-15) rechaza hoy todo vínculo `asset` con un comentario que nombra a esta tarea.
- **La persona usuaria fijó dos cosas** al abrir el cambio: el margen se mide en caja, y la inversión cuenta una sola vez. Ver `proposal.md` § Supuestos registrados 1 y 2.

## Goals / Non-Goals

**Goals**

- Que el porcentaje de recuperación se calcule en un solo sitio, comprobable con pruebas unitarias.
- Que "qué dinero entró y salió de esta línea" tenga una sola definición en la base de datos, compartida por el panel y por los activos.
- Que el recorte al ayudante sea una fila que no llega, no un componente que no se pinta.
- Que la tabla `asset_details` no tenga que cambiar cuando lleguen KAM-20 y KAM-21.

**Non-Goals**

- Rediseñar los indicadores del panel principal. `cash_flow_by_line_month` cambia de fuente y conserva sus columnas, su recorte y su significado.
- Resolver aquí la asignación de gastos compartidos entre líneas: es la regla configurable de V14.
- Cualquier interfaz de vínculos de tarea. Aquí solo se abre la validación en base de datos.

## Decisions

### D1 · El activo es un ítem con datos propios, no una tabla paralela

`asset_details.item_id` es a la vez clave primaria y foránea contra `items`. Un activo hereda de su ítem el nombre, la línea, la unidad, el archivado y su presencia en el catálogo y en los buscadores.

**Alternativa descartada:** una tabla `assets` independiente. Habría duplicado nombre y línea, habría dejado dos formas de archivar la misma máquina, y habría obligado a la línea de compra —que apunta a `items`— a elegir contra cuál de las dos hablar. El esquema canónico §7 ya toma esta decisión; aquí solo se respeta.

Se añade a la forma canónica una restricción que ella no escribe: la fila solo puede existir si el ítem es de tipo `asset`. Un `check` no puede consultar otra tabla, así que es un trigger `before insert or update`. Sin él, `asset_details` aceptaría datos de activo para un rollo de vinilo y la pantalla de activos mostraría insumos.

### D2 · La pertenencia a un activo es una columna de `expenses`, con papel explícito

`expenses` suma `asset_id` (contra `asset_details(item_id)`) y `asset_expense_role` (`acquisition` | `maintenance`), con:

- `check` de declaración conjunta: los dos nulos o los dos presentes;
- índice único parcial sobre `(asset_id) where asset_expense_role = 'acquisition'`, que es lo que hace imposible una segunda adquisición;
- trigger que exige que el activo y el egreso sean de la misma organización, porque una foránea no puede comprobarlo.

**Por qué una columna y no una tabla de vínculo `asset_expenses`:** un egreso pertenece a lo sumo a un activo, igual que se asigna a lo sumo a un pedido. `order_id` ya resuelve ese caso exacto en la misma tabla; una tabla aparte añadiría una unión a toda lectura de costos para modelar una cardinalidad que no es de muchos a muchos.

**Por qué el papel y no dos columnas ni una convención:** la diferencia entre el egreso con el que se compró la máquina y los que la mantienen es exactamente lo que evita el doble conteo de D4. Dejarlo implícito —"es adquisición si es el más antiguo", "si su ítem es de tipo activo"— convierte una regla del negocio en una adivinanza de la consulta.

**Alternativa descartada:** deducir la adquisición mirando si la compra tiene una línea de un ítem de tipo activo. Es automático, pero rompe con la compra mixta —máquina y accesorios en el mismo documento—: el pago sería uno solo y habría que prorratearlo entre la parte de inversión y la parte corriente. Prorratear un pago parcial contra un total derivado es justo el tipo de cálculo que nadie podrá auditar dentro de seis meses.

### D3 · `acquisition_cost` es un dato declarado; el egreso de adquisición es un vínculo aparte

El costo que llena el denominador es la cifra que la persona dueña declara, prellenada desde la línea de compra cuando el activo nace de una compra (ver `proposal.md` § Supuestos 3). El vínculo con el egreso existe por otro motivo: es lo que permite excluir ese pago del margen en D4.

**Alternativa descartada:** derivar `acquisition_cost` del egreso vinculado y no almacenarlo. Suena a convención nº 4, pero no lo es: el costo de adquisición es un hecho declarado, no un derivado —la forma canónica lo pide `not null`, un activo puede registrarse sin que exista ningún egreso suyo en el sistema, y el importe del egreso y el costo del activo no tienen por qué coincidir cuando la compra trae varias cosas.

### D4 · Una vista de movimientos, dos lecturas

Se crea `line_cash_movements`: una fila por movimiento de dinero no archivado, con `organization_id`, `business_line_id`, `occurred_at`, `direction`, `amount` y `asset_id` —el activo del egreso pagado, o nulo—. Conserva de `cash_flow_by_line_month` la estructura de `union all` sobre las dos ramas (cobros contra `orders`, pagos contra `expenses`), el descarte de lo archivado en ambos extremos y el `where is_owner(...)`, por los mismos motivos que aquella documentó.

Sobre ella:

- **`cash_flow_by_line_month`** se redefine como un `group by` de esta vista. Conserva exactamente sus columnas (`organization_id`, `business_line_id`, `month`, `collected`, `paid`), su recorte por dueño y su corte de mes en la zona horaria de la organización. No filtra por `asset_id`: comprar una máquina sí es dinero que salió de caja, y el panel debe seguir diciéndolo.
- **`asset_recovery`** agrega la misma vista filtrando `asset_id is null` —los pagos que ya son costo de algún activo no vuelven a restar— y acotando a `occurred_at >= acquired_on`.

**Por qué redefinir la vista del panel en vez de escribir el empalme dos veces:** el empalme `payments → línea` es la definición de "dinero de una línea". Con dos copias, la primera corrección que se haga en una y no en la otra hará que el panel y los activos den dos márgenes distintos para la misma línea y el mismo periodo, y nadie lo notará hasta que alguien los compare. El costo es una migración que ejecuta `create or replace view` con las mismas columnas y una prueba pgTAP existente que debe seguir en verde sin tocarse — que es, de hecho, la comprobación de que el refactor no cambió nada.

**Alternativa descartada:** que `asset_recovery` sume desde `cash_flow_by_line_month`. Su grano es el mes, y `acquired_on` es un día: una máquina comprada el 20 de marzo se mediría contra el margen de todo marzo, incluidas las tres semanas anteriores a su existencia.

### D5 · La vista entrega ingredientes; el porcentaje lo calcula TypeScript

`asset_recovery` devuelve por activo: `item_id`, `organization_id`, `business_line_id`, `name`, `acquired_on`, `acquisition_cost`, `maintenance_cost`, `total_cost` y `line_margin_since`. No devuelve porcentaje.

`lib/assets/recovery.ts` expone una función pura que recibe `{ totalCost, marginSince }` y devuelve `{ ratio, percent, recovered }`, con los cinco bordes del requisito —costo cero, margen negativo, recuperación exacta, recuperación superada, recorte a 0–100—.

**Por qué no calcular el porcentaje en la vista:** el criterio 6 del backlog pide la fórmula en un solo lugar *del código* y las pruebas requeridas la piden *unitaria*. Un `case ... when total_cost = 0` dentro de un `select` no se puede probar unitariamente ni leer sin abrir la migración, y una migración no se edita nunca (convención nº 6): corregir el recorte obligaría a una migración nueva que redefine la vista entera.

### D6 · El corte de fecha se hace en la zona horaria de la organización

`acquired_on` es un `date` y `payments.occurred_at` es `timestamptz`. La comparación se hace convirtiendo el movimiento a la zona de la organización antes de recortar el día, con el mismo criterio con el que `cash_flow_by_line_month` decide a qué mes pertenece un cobro y con el que `lib/orders/overdue` decide qué es "hoy". Un cobro de las 21:00 en La Paz el día de la compra cuenta para esa compra, aunque en UTC ya sea el día siguiente.

### D7 · El recorte al ayudante viaja en la vista, no solo en la RLS de la tabla

`asset_details` no tendrá ninguna política para el ayudante, y eso ya le da cero filas. Pero `asset_recovery` une `asset_details` con datos de pedidos que el ayudante sí lee; con `security_invoker` a secas la vista le devolvería filas con `acquisition_cost` en cuanto la unión se resolviera de otro modo. Se hereda de `cash_flow_by_line_month` la solución que aquella ya documentó: la condición `is_owner()` dentro de la vista, comprobable en pgTAP y no en el navegador.

### D8 · `/assets` sigue el patrón de `/expenses`, sin inventar una tercera forma de negar acceso

La página resuelve `getOwnerContext()` y redirige cuando devuelve nulo; la entrada de navegación se declara con `roles: ["owner"]` y `mobile: "more"` en `nav-entries.ts`, de donde salen a la vez el menú lateral, el panel "Más" y la barra inferior. `/assets` entra en `PROTECTED_PREFIXES`. Nada de esto es nuevo: es lo que ya hacen egresos y configuración, y hacerlo distinto pondría dos maneras de contestar la misma pregunta.

### D9 · El alta desde la compra es un ofrecimiento posterior al guardado, no un paso del formulario

Guardar la compra y declarar el activo son dos escrituras. `create_expense` es atómica por diseño (KAM-09, D2) y meter dentro un `asset_details` opcional la volvería condicional sobre datos que solo el dueño puede escribir. En su lugar: la compra se guarda, y si alguna de sus líneas apunta a un ítem de tipo activo sin datos declarados, la pantalla ofrece declararlo con las cifras prellenadas. Declinar no deshace nada.

**Consecuencia aceptada:** un activo puede quedarse sin declarar si la persona cierra la pantalla. Es recuperable desde el catálogo en cualquier momento, y es preferible a que un ofrecimiento opcional pueda hacer fallar el registro de una compra.

### D10 · Índices

- `expenses (asset_id) where asset_id is not null` — la lectura del mantenimiento de un activo y la exclusión de D4.
- Índice único parcial `(asset_id) where asset_expense_role = 'acquisition'` — restricción, no rendimiento.
- `payments (organization_id, occurred_at)` ya existe desde KAM-14 y sirve al mismo empalme.

No se añade ninguno más sin una medición que lo justifique.

## Risks / Trade-offs

- **Redefinir `cash_flow_by_line_month` puede romper el panel principal en silencio** → La migración usa `create or replace view` con columnas idénticas, y la prueba pgTAP de KAM-14 **no se toca**: si el refactor cambia una sola cifra, esa prueba lo dice. Se ejecuta el conjunto de integración completo antes de dar la migración por buena.
- **El doble conteo se evita solo si el egreso está vinculado** → Un activo declarado desde el catálogo cuya compra se registró como un egreso corriente y nunca se vinculó seguirá restando de su propio margen. Mitigación: el alta desde la compra vincula sola, y el detalle del activo ofrece vincular la adquisición después. Queda visible en el panel de detalle, que muestra si hay egreso de adquisición vinculado o no.
- **La base de caja hace que la barra se mueva al cobrar y no al entregar** → Es la decisión registrada (Supuesto 1) y es coherente con el panel; el detalle del activo no repite *Por cobrar*, que ya vive en V2. Se documenta en el propio panel de detalle para que nadie lea la barra como "lo producido".
- **Un activo de la línea compartida no da porcentaje** → Es lo especificado (Supuesto 4). El riesgo real es que se lea como un fallo; se mitiga con un texto explícito en la tarjeta, no con una barra en 0 %.
- **`asset_recovery` recorre los movimientos de la línea desde la adquisición, y eso crece con los años** → Con doce meses sembrados el volumen es el mismo que ya atiende el panel con el índice `(organization_id, occurred_at)`. Si el conjunto de integración muestra un plan de ejecución degradado, la respuesta es un índice medido, no una columna con el margen guardado (convención nº 4).

## Migration Plan

Dos migraciones nuevas, en este orden:

1. **`<ts>_assets.sql`** — `asset_details` con su `check` de costo no negativo, su trigger de "solo ítems de tipo activo", su RLS (solo dueño, sin política `DELETE`), sus `grant` y su trigger `log_activity()`; y sobre `expenses`, las columnas `asset_id` y `asset_expense_role` con su `check` conjunto, su índice único parcial de adquisición, su trigger de misma organización y su índice de lectura.
2. **`<ts>_asset_recovery.sql`** — `line_cash_movements`, la redefinición de `cash_flow_by_line_month` sobre ella, `asset_recovery`, sus `grant`, y `create or replace function validate_task_link()` para que `asset` valide contra `asset_details`.

Cada una con su archivo pgTAP en `supabase/tests/`. Ninguna migración existente se edita (convención nº 6). Tras aplicarlas, `graphify .` para regenerar el grafo.

**Reversión:** las columnas nuevas son anulables y ninguna lectura existente las nombra, así que un despliegue a medias deja el sistema en el estado anterior salvo por `cash_flow_by_line_month`, que es el único objeto redefinido: su versión anterior está en la migración de KAM-14 y se restaura con una migración nueva que la vuelva a declarar.

## Open Questions

Ninguna que pueda responderse después sin mover las especificaciones. Las dos que sí lo hacían —la base del margen y el doble conteo de la inversión— se resolvieron con la persona usuaria antes de escribirlas y quedaron registradas en `proposal.md`.
