# KAM-18 · Diseño

## Context

Ver `proposal.md` — Why. Lo que importa aquí es el estado del esquema y del código donde aterriza el inventario:

- **`items.min_stock` existe desde KAM-06** (`numeric(14,3)`, nulo por omisión) y el formulario del ítem ya lo edita. Su prueba pgTAP lo declara explícitamente **canónico y no derivado**, exceptuándolo de la comprobación de columnas prohibidas. Este cambio no toca la columna: le da significado.
- **`expense_items` lleva identificador generado en el cliente.** `create_expense(p_expense, p_items)` hace `coalesce(nullif(v_item->>'id',''), gen_random_uuid())`, y `lib/expenses/schema.ts` exige `z.guid()` en cada línea. Ese identificador estable es lo que hace posible la idempotencia por índice.
- **`item_last_cost` ya existe** (KAM-09), con `security_invoker`, filtrando compras archivadas y ordenando por fecha del hecho. `services/expenses/item-last-cost-service.ts` la lee. La sección *Evolución de precios* de V11 se apoya en ambas cosas sin crear nada.
- **`expenses` y `expense_items` no tienen ninguna política de lectura para el ayudante.** Es el mecanismo con el que el esquema §16 oculta costos: no esconde columnas, quita la política. Cualquier vista con `security_invoker` encima devuelve cero filas por sí sola.
- **`log_activity()` y `enforce_archive_rules()` son genéricos** (KAM-03, KAM-06) y se enganchan por trigger. `log_activity()` lee `organization_id` y `business_line_id` de la propia fila; `inventory_movements` tiene la primera y no la segunda.
- **La cola sin conexión es un motor con registro de operaciones** (KAM-11): `lib/offline/registry.ts` mapea una clave a `{send, describe}` y `features/sync/operations.ts` registra las tres que hay. `lib/offline/capture.ts` encola, dispara el vaciado y espera 2,5 s: con red el registro sale dentro del mismo gesto.
- **La retícula de registro rápido declara sus destinos como datos** en `lib/quick-capture/destinations.ts`, con `href` para lo que existe y `availableFrom` para lo que no. *Consumo* es el último inerte. La misma lista alimenta la retícula de `/quick` y el menú *+ Registrar*.
- **Al panel le queda un solo marcador** (`features/dashboard/placeholder-card.tsx`): KAM-17 retiró el de pendientes al construir V20, y `LOW_STOCK_PLACEHOLDER` es el último. Muere aquí, y el componente con él.
- **El mapa de navegación §5 fija la forma del consumo**: *Consumo → diálogo*, y *V11 · Ajuste por conteo → diálogo* en escritorio y en móvil. No es una pantalla.
- **Hay cinco cambios hermanos en `openspec/changes/`** (KAM-19 a KAM-23). Ninguno escribe una migración de inventario, pero **KAM-19 y KAM-21 reescriben el mismo requisito** *Pantalla de detalle de ítem (V11)* que este cambio: los tres deltas son rescrituras completas del mismo bloque y el último en sincronizarse gana. Ver `proposal.md` — Riesgo de coordinación.

## Goals / Non-Goals

**Goals**

- Que el saldo sea imposible de falsear: sin columna que lo almacene, sin `UPDATE` sobre el documento que lo produce, y con la suma comprobada contra el cálculo manual en pgTAP.
- Que la idempotencia de la entrada automática la garantice la base y no el orden en que se llame a nada.
- Que el ajuste por conteo siga siendo correcto cuando se registra sin conexión y llega tarde, sin borrar lo que pasó entre medias.
- Que el recorte de costos al ayudante siga saliendo de RLS y no de una condición en la interfaz, también en las secciones nuevas de V11.
- Que activar el último destino de la retícula no obligue a inventar una pantalla que el mapa no pide.

**Non-Goals**

- No se define el aviso ni la notificación de insumo bajo mínimo: la tabla `notifications` y su trabajo programado son de KAM-17. Aquí solo hay dos superficies visuales.
- No se toca `create_expense`, ni el formulario de compra, ni `item_last_cost`.
- No se generaliza el saldo a productos ni a activos: la vista canónica filtra `kind = 'supply'` y este diseño la respeta.
- No se amplía el motor de la cola. Se registran dos operaciones y nada más.

## Decisions

### D1 · La entrada automática es un trigger sobre `expense_items`, no una rama de `create_expense`

Un trigger `after insert on expense_items` inserta el movimiento de entrada cuando el ítem de la línea es de tipo insumo, con `kind = 'in'`, `quantity` = la cantidad de la línea, `source_type = 'expense_item'`, `source_id` = el identificador de la línea y `occurred_at` = la fecha del hecho del egreso.

*Por qué:* el trigger cubre toda vía de escritura presente y futura. `create_expense` es hoy la única, pero KAM-20 y KAM-23 tocarán egresos, y una entrada de inventario que dependa de que cada camino nuevo se acuerde de generarla es una entrada que tarde o temprano no se genera. La convención nº 6 —migraciones solo como archivos nuevos— hace además que corregir un olvido dentro de la función cueste otra migración.

*Alternativa descartada:* generarla desde `services/inventory/`. Sitúa una regla de integridad del documento en una capa que RLS no protege y que el modo sin conexión reintenta.

*Por qué `after` y no `before`:* la fila de la línea tiene que existir antes de que otra la referencie por `source_id`.

*Solo insumos:* la línea que apunta a un producto o a un activo no genera nada. `item_balances` solo contempla `kind = 'supply'`, así que un movimiento de producto no aparecería en ningún saldo y solo ensuciaría la sección *Movimientos* de un ítem que no tiene saldo que explicar. Comprar una impresora es una adquisición, y eso lo registra KAM-19.

### D2 · La idempotencia la impone el índice único; el trigger absorbe el conflicto

El índice canónico `unique (source_type, source_id) where source_type in ('expense_item','order_item')` es la única garantía. El `insert` del trigger lleva `on conflict do nothing`.

*Por qué:* el identificador de la línea de compra se genera en el dispositivo y se conserva en todos los reintentos, así que la segunda llegada de la misma compra trae el mismo `source_id`. Sin el `on conflict`, esa segunda llegada rompería el alta con un error de restricción que la persona no puede interpretar — y el criterio nº 2 pide que siga existiendo una sola entrada, no que la compra falle.

*Alternativa descartada:* comprobar antes de insertar (`if not exists`). Es una condición de carrera con nombre: dos vaciados de cola concurrentes la superan los dos.

*Consecuencia:* la prueba `inventory_idempotency` no simula red. Inserta la misma línea dos veces y comprueba que hay un movimiento, e intenta insertar a mano un segundo movimiento con el mismo `(source_type, source_id)` y comprueba que la base lo rechaza.

### D3 · La inmutabilidad es un privilegio que no se concede, no un trigger que la vigila

`inventory_movements` recibe `grant select, insert to authenticated` y nada más: sin `update`, y con `revoke delete` para `authenticated`, `anon` y `service_role`, igual que el resto de tablas. La tabla no lleva `archived_at` ni trigger `enforce_archive`.

*Por qué:* la ausencia de privilegio es más barata de auditar que un trigger que decide, y no tiene el punto ciego del trigger — un `update` que no cambie las columnas vigiladas. Es la misma lógica con la que la ausencia de política `DELETE` implementa «nada se elimina».

*Alternativa descartada:* política de `UPDATE` con `using (false)`. Dice lo mismo con más piezas y deja al lector la duda de si en algún caso pasa.

*Consecuencia buscada:* `enforce_archive_rules()` no se engancha, porque no hay nada que archivar. La prueba pgTAP comprueba las dos negativas por separado: un `update` rechazado y un `delete` rechazado.

### D4 · La vista `item_balances` se crea literalmente como la define el esquema

Se copia la definición canónica de §11 sin variaciones: `security_invoker = true`, `left join` sobre los movimientos, `coalesce(sum(...), 0)`, `min_stock` y la bandera `below_min` calculada en la propia vista.

*Por qué:* el `left join` es lo que hace que un insumo sin movimientos aparezca con saldo cero en vez de desaparecer — que es lo que necesita la tarjeta del panel para no mentir por omisión. Calcular `below_min` en la vista mantiene la regla en un solo sitio: la tarjeta del panel, el distintivo del catálogo y la sección de saldo de V11 leen la misma bandera y no pueden discrepar.

*Detalle que no es opcional:* `grant select on item_balances to authenticated, service_role` va explícito. La nota de la migración de pedidos (20260826200000) ya dejó constancia de que el privilegio de lectura de una vista no se hereda igual en todos los entornos.

*Lo que la vista no incluye:* ítems archivados. La definición canónica no los filtra y no se le añade el filtro: un insumo archivado con saldo pendiente es exactamente lo que alguien quiere ver al buscar por qué el número no cuadra. Quien lista —la tarjeta y el catálogo— filtra por `archived_at` como ya hace hoy.

### D5 · Todo consumo humano nace `manual`; `order_item` queda declarado y sin uso

El `check` de `source_type` incluye `order_item` porque es el esquema canónico, pero ninguna escritura de este cambio lo produce. El consumo abierto desde un pedido o una tarea guarda `source_type = 'manual'` y deja la referencia en la nota, prellenada y modificable.

*Por qué:* el índice único de D2 cubre `order_item`, así que usarlo limitaría a **un** movimiento por línea de pedido. Consumir tres insumos distintos para la misma línea es el caso normal de un taller, no la excepción, y el segundo consumo fallaría con un error de restricción sin explicación posible.

*Alternativa descartada:* recortar el índice único a `expense_item` para poder usar `order_item` libremente. Altera un índice canónico del esquema y pierde la protección contra reintentos en una vía que KAM-21 podría querer usar de verdad.

*Lo que se pierde:* el movimiento no queda enlazado al pedido como dato consultable, solo como texto. Es aceptable mientras la pregunta que el inventario suave responde sea «qué me queda» y no «cuánto costó este pedido»; el enlace de primera clase, si hace falta, es materia de `task_links` y de KAM-21.

### D6 · El ajuste por conteo viaja como diferencia, no como cantidad contada

El diálogo pregunta cuánto hay, calcula `contado − saldo` **en el dispositivo, en el momento del conteo**, y lo que se guarda y se encola es esa diferencia, con `kind = 'adjustment'` y `source_type = 'count'`.

*Por qué:* es lo correcto precisamente cuando llega tarde. Un conteo hecho a las 15:40 y sincronizado a las 18:00, con un consumo registrado a las 16:00 por otra persona, debe dejar el saldo en «lo contado menos lo consumido después». Guardar «pon el saldo en 60» borraría ese consumo intermedio sin dejar rastro; guardar «−5» conserva los dos hechos y ambos quedan en la sección de movimientos con su hora.

*Alternativa descartada:* recalcular la diferencia en el servidor contra el saldo del momento de llegada. Reescribe silenciosamente lo que la persona contó, que es lo contrario de lo que un ajuste por conteo significa.

*Consecuencia:* un conteo que coincide con el saldo produce diferencia cero. La base lo rechazaría por `quantity <> 0`, así que el diálogo lo detecta antes y lo dice —«el conteo coincide con el saldo, no hay nada que ajustar»— en vez de dejar que suba un error de restricción.

### D7 · Consumo y ajuste entran en la cola como dos operaciones registradas, sin tocar el motor

Se añaden `inventory.consumption` e `inventory.adjustment` a `features/sync/operations.ts`, con su `describe` en español y sin `dependsOn`: un movimiento es un sobre completo que no espera a ningún padre. El diálogo llama a `capture()`, no a la Server Action.

*Por qué:* es literalmente el par de líneas que el registro de KAM-11 previó, y V16 declara que sus seis destinos funcionan sin conexión. Activar *Consumo* escribiendo directo dejaría la retícula con dos clases de botón indistinguibles a la vista.

*Identificador y hora:* el movimiento nace con `uuid` generado en el dispositivo (convención nº 9) y `occurred_at` del cliente. El reintento reenvía el mismo identificador y la clave primaria impide la segunda fila — el mismo mecanismo que ya protege a los pedidos, sin que `manual` y `count` necesiten entrar en el índice parcial.

*Lo que no cambia:* `lib/offline/` no se abre. Ni el motor, ni el vaciado, ni la bandeja.

### D8 · El destino de la retícula aprende a ser un diálogo

`QuickDestination` gana una forma de resolverse que no es `href`. `isAvailable` pasa a ser cierto para un destino con acción o con dirección, y la retícula y el menú *+ Registrar* rinden el diálogo en su sitio.

*Por qué:* el mapa §5 dice *Consumo → diálogo*, y la lista de destinos es la única fuente de la que salen las dos superficies (decisión D1 de KAM-13). Inventar `/inventory/consume` solo para que el destino tenga `href` contradice el mapa y añade una dirección que nada más usa.

*Alternativa descartada:* que el diálogo viva en una ruta interceptada. Es más maquinaria de la que el caso pide y complica el comportamiento sin conexión, donde no hay navegación que interceptar.

*Efecto colateral buscado:* `availableFrom` deja de tener usuarios y puede quedarse en el tipo sin ninguna entrada que lo use, para el siguiente destino que haga falta.

### D9 · Las secciones de V11 se recortan en el servidor, no en la pantalla

La página del detalle no envía la sección de evolución de precios al ayudante: consulta `item_last_cost`, recibe cero filas por RLS y compone sin esa sección. Ninguna condición sobre el rol decide qué se pinta.

*Por qué:* es el patrón que KAM-14 fijó para la variante del ayudante —«ninguna de las dos composiciones se obtiene ocultando piezas de la otra en el cliente»— y el que el esquema §16 describe como forma de ocultar costos. Un `if (role === "owner")` en el componente funciona hasta que alguien lo mueve; el cero de filas es la misma respuesta por cualquier camino, incluida una consulta directa.

*Verificación:* la prueba no mira la pantalla del ayudante. Consulta `item_last_cost` con su sesión y comprueba que devuelve cero filas.

### D10 · La tarjeta de insumos bajo mínimo hereda la ranura del marcador, y con ella muere el componente de marcador

`LOW_STOCK_PLACEHOLDER` desaparece y, como KAM-17 ya retiró el de pendientes al construir V20, `PlaceholderCard` se queda **sin ningún usuario**: se borra en este cambio en vez de sobrevivir como componente muerto. La tarjeta nueva ocupa la misma ranura en la composición del dueño y en la del ayudante.

*Por qué el ayudante también:* la pieza no contiene ningún importe, y el requisito de KAM-14 solo prohíbe dinero y huecos. Es además quien está delante del estante: ocultarle qué se está acabando sería quitar la información a quien la necesita para trabajar.

*Selector de línea:* la tarjeta filtra por la línea activa e incluye siempre los insumos compartidos (`business_line_id` nulo), igual que el resto del panel y que el catálogo. El requisito *Todo el panel responde al selector de línea* no admite excepciones.

*Orden:* por distancia relativa al mínimo, no por saldo absoluto. Un insumo con 2 de 10 está peor que uno con 40 de 50, y el que decide qué comprar necesita ese orden y no el alfabético.

### D11 · El distintivo del catálogo es binario, y la cifra vive en el detalle

La fila del catálogo lee `below_min` de la vista y pinta un distintivo. No añade columna de saldo ni de costo.

*Por qué:* el requisito de V10 prohíbe ambas cosas y esa prohibición se conserva palabra por palabra en el delta. Mostrar la cifra en la lista convertiría el catálogo en una pantalla de inventario y arrastraría al ayudante hacia números de costo que no debe ver — el saldo no lo es, pero la pendiente empieza ahí. Quien quiere el número abre el ítem, que es un toque.

## Risks / Trade-offs

- **[El trigger de entrada se salta un camino de escritura futuro]** → Está enganchado a la tabla, no a la función: cualquier `insert` sobre `expense_items` lo dispara, venga de donde venga. Lo que sí se pierde es la línea insertada por un `copy` masivo con triggers deshabilitados; ninguna vía del producto hace eso, y la restauración de un volcado se documenta en KAM-23.
- **[Una compra archivada deja saldo de más]** → Decisión explícita (proposal, supuesto 3). El riesgo real es que alguien archive una compra creyendo que deshace su entrada. Se mitiga en la interfaz: la sección de movimientos etiqueta el origen de cada fila, así que la entrada de una compra archivada sigue siendo rastreable hasta su documento, y el ajuste por conteo cuesta tres interacciones.
- **[El consumo sin conexión permite dejar el saldo en negativo]** → Se acepta. Validar contra el saldo exigiría conocerlo en el dispositivo y bloquear un registro de algo que ya ocurrió físicamente. Un saldo negativo es información —dice que faltan entradas por registrar— y se corrige con un conteo. La interfaz lo muestra como negativo, sin recortarlo a cero.
- **[El movimiento no queda enlazado al pedido que lo motivó]** → Consecuencia asumida de D5. La nota prellenada conserva la referencia legible; el enlace consultable es materia de KAM-21.
- **[La sección de movimientos crece sin límite en un insumo muy usado]** → Se pagina desde el principio, con los índices canónicos `(item_id, occurred_at desc)` que el esquema ya define para eso. El detalle carga la primera página, no el historial entero.
- **[`below_min` se calcula sobre todos los insumos en cada carga del panel]** → El volumen previsto es de decenas de insumos por organización (§Volumen esperado del esquema). Si dejara de serlo, el índice `(organization_id, occurred_at desc)` sostiene la agregación y la vista puede materializarse sin cambiar ninguna consulta que la lea.

## Migration Plan

1. **Una sola migración nueva**, `YYYYMMDDHHMMSS_inventory.sql`, con la tabla, sus restricciones, sus tres índices, la vista, el trigger de entrada automática, el `audit` de bitácora, los privilegios y las políticas. Es aditiva: no altera ninguna tabla existente ni ninguna vista, así que no compite con nada.
2. **Su prueba pgTAP en el mismo cambio** (convención nº 6): ninguna migración se fusiona sin ella.
3. **Sin relleno retroactivo.** Las compras anteriores a la migración **no** generan entradas: el trigger es `after insert` y no se dispara sobre lo ya escrito. Es deliberado — inventar entradas para compras cuyo insumo ya se consumió dejaría todos los saldos inflados desde el primer día. El taller arranca el inventario con un conteo, que es exactamente para lo que sirve el ajuste, y la semilla de Geeko Store se amplía con los movimientos que hagan falta para que el recorrido e2e tenga datos.
4. **Reversión:** revertir es no desplegar. Si la migración ya está aplicada, deshacerla es una migración nueva que quita el trigger y la vista; los movimientos escritos se quedan, porque nada se borra en Kamay.
5. **Regenerar el grafo** (`graphify .`) tras la migración, como exige la convención nº 6.
