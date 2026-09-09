# KAM-20 · Reportes — Diseño

## Context

Ver `proposal.md` § *Why* para la motivación. Lo que condiciona el diseño es lo que ya existe y lo que ya se decidió:

- **KAM-14 fijó el corte de dinero.** Los indicadores del panel se miden **en caja** y su vista `cash_flow_by_line_month` agrega **por mes calendario**, con el mes cortado en la zona horaria de la organización y con `where is_owner(...)` **dentro** de la definición. V14 hereda el criterio de caja (supuesto 4 de la propuesta) y necesita el mismo agregado sobre un rango que puede empezar el día 12.
- **La convención nº 4 prohíbe almacenar derivados** y exige `security_invoker = true` en toda vista nueva. La nº 1 prohíbe consultar Supabase fuera de `services/`.
- **Ya hay piezas reutilizables**: `resolvePeriod` / `startOfDayInTimezone` / `startOfNextDayInTimezone` (`lib/expenses/period.ts`, KAM-09) resuelven un periodo civil en la zona de la organización y ya alimentan los filtros de `/expenses`; `getOwnerContext` (`lib/auth/session-context.ts`) es el guardián de ruta que usa `/expenses`; `order_totals`, `expense_totals`, `item_last_cost` y `receivables_by_line` son los derivados de KAM-09/KAM-10.
- **No hay librería de gráficos.** KAM-14 dibujó su comparativo con barras en CSS y difirió la elección a esta tarea, "que elegirá su herramienta conociendo sus cinco informes".
- **`organizations.settings jsonb` existe desde KAM-02 y sigue vacío.** Es donde el esquema (§ *Organizaciones*, comentario `-- preferencias, retención, reparto`) previó la regla de reparto.
- **KAM-18 y KAM-19 están fusionadas.** KAM-19 dejó `line_cash_movements`: una vista `security_invoker` al grano de fila con `organization_id`, `business_line_id`, `occurred_at`, `direction`, `amount` y el `is_owner(...)` ya dentro, que resuelve la línea de cada cobro y de cada pago desde su destino. KAM-18 dejó `item_balances` con su `below_min`, y un `inventory_movements` **sin costo unitario** cuyo consumo nace siempre con `source_type = 'manual'`.

## Goals / Non-Goals

**Goals**

- Un **único** resolutor de periodo para los cinco informes, en el servidor, de modo que "las cifras cuadran entre ellos" sea una consecuencia estructural y no una coincidencia.
- Los agregados pesados en la base de datos, con el recorte al dueño **dentro** de la definición, para que los criterios de acceso sean pruebas pgTAP y no comprobaciones de navegador.
- **Una sola implementación** de la fórmula de margen y **una sola** del reparto, en TypeScript, con sus casos límite cubiertos por pruebas unitarias baratas.
- Presupuesto de 3 s cumplido sin cachés que puedan servir una cifra vieja: los informes se leen frescos en cada petición.

**Non-Goals**

- Materializar nada. Ninguna tabla de resumen, ninguna vista materializada, ningún trabajo nocturno de precálculo. Si el presupuesto no se cumpliera con índices, se revisa el diseño, no se guarda el resultado (convención nº 4).
- Una capa de informes genérica o configurable. Son cinco informes concretos; una máquina de construir informes es exactamente la "métrica inventada" que el backlog excluye.
- Servir informes al ayudante en ninguna forma reducida.

## Decisions

### D1 · El periodo se resuelve una vez, en el servidor, y viaja en la dirección

`app/(app)/reports/page.tsx` lee `searchParams` (`preset`, `from`, `to`, `line`), resuelve el rango **una sola vez** con la zona horaria de la organización y pasa el mismo `{from, to}` a las cinco lecturas. Ningún componente de informe resuelve su propio periodo.

Que el periodo viva en la dirección es lo que hace enlazable la pantalla (requisito *Un solo periodo gobierna los cinco informes*) y lo que permite que `V2 → V14` llegue ya con "mes anterior" elegido, como pide el mapa §*Recorridos*.

**Alternativa descartada:** estado de cliente en un store de Zustand con las cinco lecturas por `fetch`. Rompe el enlace compartible, mete cinco viajes de red en cascada dentro del presupuesto de 3 s y deja la puerta abierta a que dos informes queden sobre rangos distintos durante unos instantes —justo lo que el criterio 1 prohíbe—.

`resolvePeriod` de `lib/expenses/period.ts` resuelve hoy un mes; se extiende en `lib/reports/period.ts` con los cinco atajos, reutilizando `startOfDayInTimezone` / `startOfNextDayInTimezone` sin duplicarlos. El rango invertido se rechaza aquí, antes de tocar la base.

### D2 · Los agregados son funciones SQL con parámetros, no vistas

Una vista no acepta parámetros, y el periodo de V14 es un parámetro. Las tres opciones eran:

1. **Vistas al grano de fila** que la aplicación filtra y agrega. Descartada: agregar doce meses de líneas de pedido en JavaScript no cabe en 3 s, y la fórmula de margen acabaría escrita en el servicio, no en un solo sitio.
2. **Vistas agregadas por mes**, como `cash_flow_by_line_month`, sumadas después por la aplicación. Descartada: un periodo de V14 puede empezar el día 12, y sumar meses completos daría una cifra que no es la pedida. Redondear el periodo al mes para que encaje sería mentirle a quien eligió el rango.
3. **Funciones de conjunto con parámetros** (`returns table`, `language sql`, `security invoker`). **Elegida.**

Cada informe tiene su función: `report_profitability`, `report_expense_breakdown`, `report_product_ranking`, `report_low_stock`, `report_line_comparison`. Todas reciben `p_organization_id`, `p_from`, `p_to` (instantes ya resueltos en la zona de la organización, calculados por D1) y, salvo la comparativa, `p_business_line_id` opcional.

**Las que agregan dinero se apoyan en `line_cash_movements`** (KAM-19), que ya hace el trabajo difícil: unir el movimiento con su pedido o su egreso para deducir la línea, descartar lo archivado y recortar al dueño. Filtrar por rango y agrupar sobre ella es una sola consulta. La versión anterior de este diseño repetía ahí el `union all` de dos ramas de `cash_flow_by_line_month`; escribir esa unión por tercera vez sería exactamente el punto donde una futura corrección se aplica en dos sitios y se olvida en el tercero.

**Sobre la convención nº 4.** La convención dice "vistas con `security_invoker = true`"; su intención es *nada se almacena y RLS sigue decidiendo*. `security invoker` en una función da exactamente la misma garantía —la función no puede leer nada que quien la llama no pudiera leer a mano—, y es la herramienta que el propio proyecto ya usa cuando hace falta un parámetro: `resolve_statuses(org, línea, flujo)` es el precedente, y `create_direct_sale` es el precedente de escritura. Ninguna cifra se almacena.

`cash_flow_by_line_month` **no se toca**: sigue sirviendo al panel, que no elige periodo. La generalización que pide el requisito modificado de `payments` se entrega como función hermana `cash_flow_by_line_range`, escrita sobre `line_cash_movements`, y la vista mensual pasa a ser su caso particular documentado. Reescribir la vista para que el panel pase a llamar a la función metería a KAM-14 en el radio de esta tarea sin ganar nada.

### D3 · El recorte al dueño va dentro de cada función

Cada función lleva su `where is_owner(p_organization_id)`, igual que `cash_flow_by_line_month`. No basta `security invoker`: desde KAM-10 el ayudante **sí** lee cobros fila a fila —los registra él—, así que un agregado que solo confiara en las políticas heredadas le devolvería justo lo que la matriz de acceso §16 le niega. Ponerlo dentro convierte el criterio 6 del backlog y los escenarios "el ayudante obtiene cero filas" en pruebas pgTAP.

La redirección de `/reports` con `getOwnerContext` es la segunda capa, no la única: sirve para dar una respuesta entendible, no para autorizar.

### D4 · La agregación en SQL, el reparto en TypeScript

`report_line_comparison` devuelve, por línea: ingresos del periodo, egresos propios del periodo, y —en su propia fila identificable— el total de egresos de la línea compartida. **No reparte.** El reparto lo hace `lib/reports/allocation.ts`, que recibe esas filas y la regla leída de `organizations.settings`.

Por qué la frontera cae ahí:

- El reparto es aritmética pequeña con **muchos casos límite** —ingresos cero, una sola línea activa, línea archivada, línea nueva sin porcentaje, redondeo que no cuadra—. En TypeScript cada uno es una prueba unitaria de tres líneas; en SQL, un `db reset` y una prueba pgTAP por caso.
- La regla vive en `settings`, que la aplicación ya lee para componer la leyenda. Hacerla bajar a SQL obligaría a leer el `jsonb` dentro de cada función y a repetir su validación allí.
- KAM-19 necesitará el mismo reparto para la recuperación por línea. Un módulo de TypeScript se importa; una expresión repetida en cinco funciones SQL, no.

`allocation.ts` expone una sola función que devuelve, además de las cifras repartidas, **la leyenda ya compuesta** —regla y proporciones resultantes—. Devolver las dos cosas juntas es lo que hace difícil incumplir el requisito *Ningún resultado repartido se muestra sin su regla*: quien tenga las cifras tiene la leyenda en el mismo objeto.

**Trade-off aceptado:** los escenarios de reparto se verifican en unitarias y no en pgTAP. Los que sí son observables en base —"el reparto no crea filas nuevas", "el egreso no se mueve de línea"— se prueban en pgTAP igualmente, porque son afirmaciones sobre `expenses`, no sobre la aritmética.

### D5 · El redondeo se cierra por resto mayor

Repartir 100 entre tres a partes iguales da 33,3333…; con dos decimales, tres veces 33,33 suman 99,99 y aparece un céntimo huérfano que hace que el total del comparativo no cuadre con el de *en qué se va el dinero* —y el criterio 1 exige que cuadren—. Se reparte por **resto mayor**: se trunca a dos decimales y la diferencia se suma a la línea de mayor importe repartido. El resultado siempre suma el total exacto y el sesgo cae siempre en el mismo sitio, que es lo verificable.

### D6 · El costo de materiales sale de los egresos asignados, y su ausencia se declara

El costo de un pedido es la suma de los **egresos asignados** a él (`expenses.order_id`, KAM-09, casilla "asignar a un pedido" de V9), tomados por su total derivado. Nada más.

**Los consumos de inventario quedan fuera, y conviene dejar escrito por qué**, porque parece un olvido y no lo es. KAM-18 grabó el consumo con `source_type = 'manual'` cualquiera sea el punto de entrada, y desde un pedido solo prellena la **nota** con su referencia —modificable—. Dejó `'order_item'` declarado y sin uso porque su índice único habría limitado el enlace a un movimiento por línea de pedido, y consumir tres insumos para la misma línea es el caso normal. Además, `inventory_movements` no lleva costo unitario, así que ni siquiera valorado sería inmediato.

Las tres salidas se consideraron:

1. **Deducir el pedido desde la nota del consumo.** Descartada sin discusión: la nota es texto libre y modificable, y una cifra de margen que depende de que nadie edite una nota no es auditable.
2. **Dar uso al `source_type = 'order_item'` desde KAM-20.** Descartada por alcance: obliga a modificar el diálogo de consumo, su migración y el spec de una capacidad ya fusionada. Es un cambio razonable, pero es de `inventory`, no de `reports`.
3. **Costear solo con los egresos asignados. Elegida.**

La consecuencia es incómoda y hay que mirarla de frente: **la mayoría de los pedidos no tendrá egreso asignado**, así que su costo será cero y su margen, el 100 %. Por eso la marca **sin costo registrado** deja de ser una nota al pie y pasa a ser pieza central del informe —visible en la fila y **filtrable**—: lo que el informe responde con honestidad no es "cuánto gané", sino "de qué pedidos sé realmente cuánto gané". Un informe que presentara ese 100 % sin la marca sería peor que no tener informe.

Para el ranking por producto, el costo del pedido se **prorratea entre sus ítems en proporción a su ingreso**. Es la única atribución defendible sin fichas de producto, y se declara como requisito para que no se lea como un detalle de implementación.

Costear de verdad exige las recetas de la Fase 5. Cuando lleguen, este módulo cambia de fuente sin cambiar de forma.

### D7 · Gráficos con el componente `chart` de shadcn/ui (Recharts)

Cinco informes piden un gráfico de lectura cada uno: barras comparadas, composición del gasto, ranking. Las barras en CSS de KAM-14 sirvieron para tres cifras y no escalan a una composición de diez categorías con ejes y etiquetas.

Se toma el componente **`chart` de shadcn/ui**, sobre Recharts: es el registro de componentes que el proyecto ya usa, se tematiza con las mismas variables CSS de Tailwind 4 que el resto de la interfaz —incluido el modo oscuro—, y llega por `shadcn add` como el resto de los componentes, sin decisión de dependencia nueva fuera del sistema de diseño ya elegido.

**Alternativas descartadas:** seguir con CSS (no da para composición ni ejes); una librería de gráficos ajena al registro (obliga a replicar el tema a mano y a mantener dos vocabularios de color).

El gráfico se carga con `next/dynamic` y sin SSR: es peso de cliente en una ruta de escritorio y de una sola persona, y no debe entrar en el camino crítico del presupuesto de 3 s. **Toda tabla es la fuente**; el gráfico la ilustra. Un informe cuyo gráfico no cargue sigue siendo legible y ordenable, y esa es también la lectura accesible.

### D8 · La exportación se escribe a mano, sin dependencia

CSV con separador de coma, comillas según RFC 4180 y **UTF-8 con BOM** —el BOM es lo que evita que "Sublimación" se rompa al abrirlo en Excel—. Son unas decenas de líneas en `lib/reports/csv.ts`, con sus unitarias.

**Alternativa descartada:** una librería de escritura de XLSX. Añade peso y superficie de mantenimiento para producir un formato que nadie pidió: el backlog dice "hoja de cálculo", y quien va a seguir calculando prefiere números limpios a celdas con formato de moneda. Ver el supuesto 7 de la propuesta.

La exportación se genera **en el servidor**, en una Route Handler que vuelve a ejecutar la misma lectura con los mismos parámetros de la dirección. Serializar en el cliente lo que ya está pintado sería más corto, pero exportaría lo que quedó en memoria en vez de lo que la base dice ahora, y dejaría la cabecera de contexto —periodo, línea, leyenda de reparto— a cargo del componente que la dibuja en lugar de a cargo de quien produce el archivo.

### D9 · La línea de reportes es local a la pantalla

El selector de línea de V14 **no** escribe la cookie de línea activa: cambiarla en un informe no debe reordenar el tablero de pedidos al volver. Viaja en `searchParams` como el periodo, y su valor inicial es la línea activa de la sesión.

El informe comparativo ignora ese selector por diseño (mapa §*Selector de línea*), y la pantalla lo dice junto al informe. Lo mismo hace el de insumos con el periodo: se indica que muestra el saldo de hoy. **Toda excepción declarada se escribe en pantalla**, porque una excepción silenciosa se lee como un fallo y termina en un reporte de error.

### D10 · Índices, y medir antes de añadir más

Las funciones consultan por organización y rango de fechas. `payments (organization_id, occurred_at)` ya existe desde KAM-14. Se añaden los equivalentes que hoy no están: sobre `expenses` y sobre `orders` por `(organization_id, occurred_at)`, y sobre `order_items` por `(organization_id, item_id)` para el ranking.

El presupuesto se mide **antes** de añadir cualquier índice adicional, sobre la semilla de Geeko Store ampliada a doce meses, y con el plan de ejecución a la vista. Añadir índices "por si acaso" a tablas que se escriben en cada venta de feria tiene un costo real en la ruta que más importa.

## Risks / Trade-offs

- **El informe de rentabilidad dirá «sin costo registrado» en la mayoría de las filas** (D6) → Es el riesgo más serio de este cambio, y no tiene mitigación técnica: es una carencia de datos, no de código. Se mitiga en la presentación —marca visible y filtrable— y declarándolo en la propuesta (supuesto 8), para que nadie lea el informe como una medición de margen que no es. Si al usarlo resulta inservible, la salida no es adivinar costos: es traer las fichas de producto de la Fase 5, o enlazar el consumo al pedido en un cambio propio de `inventory`.
- **El presupuesto de 3 s con doce meses** → Índices de D10 y medición con plan de ejecución antes de dar por buena cualquier función. Si una no cumple, se rediseña la consulta; **no** se materializa el resultado (Non-Goal explícito). Los gráficos salen del camino crítico por D7.
- **Recharts pesa** → Carga dinámica sin SSR, en una ruta de escritorio y de una sola persona. La tabla, que es la fuente, se pinta sin esperarlo.
- **La regla manual se desactualiza cuando se crea una línea** → El reparto trata la línea sin porcentaje como 0 —nunca como error, nunca repartiendo de más— y la pantalla de configuración avisa. Es la degradación tranquila; la alternativa, bloquear el alta de líneas mientras la regla esté incompleta, castiga a quien está montando su negocio por una configuración que quizá no usa.
- **Cambiar la regla reescribe la historia de los informes** → Es la consecuencia buscada de D4 y del requisito *El reparto se aplica en la lectura*, no un efecto secundario: un reparto congelado no se podría mostrar junto al resultado, solo creer. La leyenda visible es lo que hace que el cambio se note en vez de sorprender.
- **Cinco informes en una sola petición** → Si una lectura falla, la pantalla podría caer entera. Cada informe se compone en su propio límite de suspensión y falla por separado, con su mensaje: cuatro informes correctos valen más que una pantalla en blanco.
- **`best_selling_products` y el nuevo ranking pueden divergir** → Son deliberadamente distintos: aquél tiene su ventana de 90 días incrustada y sirve a la retícula de feria. El riesgo real es que alguien "arregle" uno mirando el otro, así que la migración lo dice por escrito y el requisito de `orders` fija un escenario que exige que el de feria no cambie.

## Migration Plan

1. **Migración nueva** `YYYYMMDDHHMMSS_reports.sql` (archivo nuevo; ninguna migración existente se toca, convención nº 6) con las funciones de D2, los índices de D10 y sus comentarios de decisión.
2. **Prueba pgTAP** de la migración: acceso por rol para cada función, aislamiento entre organizaciones, cifras contra cálculo directo sobre semilla, y las afirmaciones sobre `expenses` del reparto.
3. **`graphify .`** tras la migración (convención nº 6).
4. La regla de reparto **no necesita migración de datos**: `organizations.settings` tiene `default '{}'`, y una organización sin clave de reparto usa la proporcional a ingresos por defecto (requisito *La organización elige una regla de reparto entre tres*). Nada que rellenar, nada que revertir.
5. **Reversión:** las funciones son nuevas y nadie más las llama; un `drop function` las retira sin dejar rastro. Ninguna tabla cambia de forma, así que no hay estado que restaurar. La ruta `/reports` desaparece del menú retirando su entrada.
