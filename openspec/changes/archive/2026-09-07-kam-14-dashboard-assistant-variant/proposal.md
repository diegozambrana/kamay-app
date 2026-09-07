# KAM-14 · Panel principal y variante del ayudante

## Why

Trece tareas después, Kamay sabe registrar pedidos, egresos, cobros, pagos y ventas de feria, sabe hacerlo sin señal y sabe hacerlo desde el celular. Lo que todavía **no sabe hacer es contarlo**: `/dashboard` es un cascarón desde KAM-02, y hoy la única forma de saber cómo va el mes es abrir el tablero, la bandeja de egresos y el detalle de cada pedido, y sumar de cabeza. Toda la información existe; nadie la está leyendo junta.

Esta tarea cierra la Fase 1 y entrega **V2 · Panel principal**: el objetivo declarado es saber en cinco segundos cómo va el negocio. Y lo entrega dos veces, porque hay dos personas mirando: el dueño, que necesita las cifras, y el ayudante, que **no puede verlas** y merece por eso una pantalla propia y completa, no la del dueño con los huecos tapados.

> **Posición en la secuencia.** El backlog sitúa KAM-14 tras KAM-13, ya fusionada. Tres de las seis piezas del panel apuntan a cosas que aún no existen: la tarjeta de pendientes (KAM-17), los insumos bajo mínimo (KAM-18) y la bandeja de notificaciones a la que apunta la campana (KAM-17). El backlog las declara explícitamente marcadores de posición; este cambio **no las adelanta**: las deja ocupando su sitio, con su leyenda, del mismo modo en que KAM-13 dejó inertes los destinos Consumo y Tarea de la retícula. Ver los supuestos registrados al final.

## What Changes

### V2 · Panel principal para el dueño (`/dashboard` deja de ser cascarón)

- **Cuatro tarjetas de indicadores del mes en curso**, respetando la línea activa: **Ingresos**, **Egresos**, **Margen** y **Por cobrar**.
  - Ingresos y Egresos se miden **en caja**: lo efectivamente cobrado y pagado dentro del mes, no lo facturado. Margen es la resta de ambos. La decisión y sus consecuencias están en `design.md` (D1).
  - **Por cobrar** no es del mes: es el saldo vivo completo, y ya existe como `receivables_by_line` desde KAM-10. Se lee, no se rehace.
- **Comparativo por línea**: las mismas tres cifras de caja del mes, desglosadas por línea de negocio, con barras dibujadas en CSS y una tabla equivalente para lectura y accesibilidad. Sin librería de gráficos: el gráfico serio vive en V14 (KAM-20), que elegirá su herramienta conociendo sus cinco informes.
- **Entregas próximas**: los pedidos cuya fecha comprometida cae en los próximos siete días o ya venció, ordenados por fecha, con los vencidos destacados. La decisión de qué cuenta como vencido reutiliza la regla ya escrita en `orders` —solo estados de tipo `initial` o `in_progress` alertan, nunca por nombre—, sin escribir una segunda versión de esa regla.
- **Últimos movimientos de la bitácora**: los cinco eventos más recientes de `activity_log`, en lenguaje natural, filtrados por la línea activa. **Solo dueño**, que es lo que ya impone la RLS de la tabla.
- **Marcador de posición de pendientes** (KAM-17) y **marcador de posición de insumos bajo mínimo** (KAM-18): ocupan su ranura de la retícula con su leyenda, no se ocultan.
- **La pantalla es responsiva**: en escritorio es la puerta de entrada y se dispone en retícula; en 390 px se apila en una columna y sigue siendo utilizable. En el celular la puerta de entrada sigue siendo V16 y el panel sigue viviendo bajo "Más", sin cambios en la barra inferior.

### V2 · Variante del ayudante

- **Es un diseño propio, no el del dueño con piezas ocultas.** Sin tarjetas de dinero, sin comparativo, sin bitácora, sin huecos ni secciones vacías donde estaban.
- **Lo que sí ve, reequilibrado para llenar la pantalla**: entregas próximas —que para el ayudante es la información principal, no la cuarta— con más filas y más detalle, el marcador de pendientes y el de insumos bajo mínimo, y los accesos a registrar.
- **Ningún monto llega al ayudante, ni por pantalla ni por consulta directa.** No basta con no pintarlo: la vista derivada que alimenta los indicadores del mes se recorta en la base de datos, y una consulta directa de un ayudante devuelve cero filas. Es lo que hace verificable el criterio 3 del backlog en pgTAP y no solo en el navegador.

### Cascarón: campana y *+ Registrar* de escritorio

- **Campana de notificaciones con contador** en la barra superior de escritorio, uno de los elementos siempre disponibles del mapa §4.1. Apunta a V21, que llega en KAM-17: hasta entonces el contador es cero y activarla explica que la bandeja aún no existe. Lo que se cierra aquí es su sitio en el cascarón, no su contenido.
- **Botón *+ Registrar* también en escritorio**, con el mismo menú de destinos filtrado por rol que KAM-13 construyó para el móvil. Hoy ese control es `md:hidden` y su especificación lo declara ausente en escritorio; el backlog de KAM-14 lo pide en V2 y la única fuente sensata es la que ya existe.

**Fuera de alcance** (copiado del backlog):
- La tarjeta de pendientes queda como marcador de posición hasta KAM-17.
- Insumos bajo mínimo queda como marcador de posición hasta KAM-18.
- Reportes detallados (KAM-20).

Derivado de lo anterior, tampoco entran: la bandeja de notificaciones V21 y su fuente de avisos (KAM-17); el modelo de tareas (KAM-15) y *Mis pendientes* (KAM-17); los movimientos de inventario que darían sentido a "bajo mínimo" (KAM-18); la pantalla de bitácora V23 con sus filtros y su retención (KAM-22) —aquí solo se leen los cinco últimos eventos—; el buscador global y el menú de avatar del mapa §4.1, que ninguna tarea ha reclamado todavía; y cualquier vista derivada pensada para los informes de V14, que KAM-20 definirá con su propio periodo y su propia regla de reparto de gastos compartidos.

## Capabilities

### New Capabilities

- `dashboard`: el panel principal V2 —sus indicadores de caja del mes, el comparativo por línea, las entregas próximas, los últimos movimientos y los marcadores de posición—, su reactividad al selector de línea, su variante propia para el ayudante y su presupuesto de carga.

### Modified Capabilities

- `payments`: se añade el indicador derivado que faltaba. `receivables_by_line` y `payables_by_line` son saldos vivos; el panel necesita además **flujo de caja del mes por línea** —cobrado y pagado dentro de un periodo—, que hoy no existe como derivado y no puede componerse desde las dos vistas actuales. El nuevo derivado es de lectura exclusiva del dueño, y esa restricción se declara en el requisito.
- `activity-log`: la tabla existe desde KAM-03 y hasta hoy nadie la leía. Se añade el requisito de **lectura acotada de los últimos movimientos** —tope de filas, filtrada por línea activa, en lenguaje natural y solo para el dueño—, que KAM-22 extenderá con filtros y paginación en V23 en lugar de inventar una segunda forma de leer la bitácora.
- `quick-capture`: el requisito *Registrar está a dos toques desde cualquier pantalla* cambia. Deja de ser exclusivo del móvil —hoy tiene un escenario que exige explícitamente que en escritorio no se rinda— y pasa a ofrecerse en ambas superficies, con el mismo menú y el mismo filtrado por rol.
- `user-auth`: el requisito *Authenticated shell frames every app screen* cambia. La barra superior de escritorio suma la campana de notificaciones con su contador, junto al selector de línea que ya carga.

## Impact

**Código afectado**

- `app/(app)/dashboard/page.tsx` — deja de ser cascarón; resuelve rol y línea activa en el servidor y rinde la variante que corresponde.
- `components/layout/header.tsx` — suma la campana con contador.
- `features/quick-capture/register-button.tsx` — deja de ser `md:hidden`; se posiciona también en escritorio sin tapar contenido.
- `features/dashboard/*` — tarjetas de indicadores, comparativo de barras, lista de entregas próximas, lista de últimos movimientos, marcadores de posición y las dos composiciones de pantalla (feature nueva).
- `services/dashboard/*` — lectura de los indicadores de caja, del comparativo y de las entregas próximas; `services/activity/*` para los últimos movimientos.
- `lib/` — formateo de moneda y de periodo del mes, y la traducción de un evento de bitácora a lenguaje natural (compartible con KAM-22).

**Se lee pero no se modifica:** `receivables_by_line` y `order_totals` / `expense_totals` (KAM-10); la regla de retraso por `kind` y el juego de estados (KAM-05, KAM-07); `BusinessLineProvider` y `resolveActiveLine` (KAM-04/KAM-13); el menú de destinos de *+ Registrar* (KAM-13).

**Base de datos:** una migración nueva con la vista derivada de flujo de caja por organización, línea y mes, con `security_invoker = true` y recorte a la persona dueña, más su prueba pgTAP. Ninguna tabla nueva; ningún indicador almacenado (convención nº 4). `payments` no tiene `business_line_id` —la línea se deduce del pedido o del egreso al que apunta el movimiento—, y esa unión vive en la vista, no en la aplicación.

**Dependencias:** ninguna nueva. El comparativo se dibuja con Tailwind.

**Pruebas:** integración pgTAP comparando las cifras del panel contra el cálculo directo sobre datos sembrados y verificando que el ayudante obtiene cero filas de la vista; unitarias sobre la composición del periodo, el reparto por línea, la selección de entregas próximas y el texto natural de la bitácora; e2e `assistant-permissions.spec.ts` recorriendo la variante del ayudante y la ausencia de montos.

## Supuestos registrados

1. **Ingresos y egresos del panel se miden en caja, no en devengado.** Decidido con la persona usuaria. La consecuencia a tener presente: un pedido facturado en marzo y cobrado en abril aparece en el margen de abril, y "Por cobrar" —que sí es un saldo vivo— es la tarjeta que explica la diferencia. KAM-20 podrá ofrecer la lectura devengada en V14 sin contradecir esto, porque allí el periodo y la base son explícitos.
2. **El mes en curso es el periodo del panel, sin selector.** El backlog dice "indicadores del mes" y V2 no lista ningún selector de periodo; el selector de periodo es de V14 (KAM-20). El panel usa el mes calendario en curso según la zona horaria de la organización.
3. **"Entregas próximas" es una ventana de siete días más lo ya vencido.** El backlog dice "pedidos que vencen" sin fijar el horizonte; V2 ya usa siete días para la tarjeta de pendientes ("vencidas, hoy, próximos 7 días"), y usar dos horizontes distintos en la misma pantalla sería arbitrario.
4. **El recorte de dinero al ayudante se hace en la base de datos, no en la interfaz.** El criterio 3 exige que no pueda obtenerlo "por consulta directa". El ayudante sí puede leer cobros individuales desde KAM-10 —los registra—, así que `security_invoker` por sí solo no bastaría para el agregado: la vista lleva su propia condición de dueño. Es la misma filosofía de `payables_by_line`, aplicada donde la RLS heredada no alcanza.
5. **El presupuesto de 1,5 s se verifica sobre datos sembrados de doce meses.** El criterio 6 fija la cifra pero no el conjunto; se toma la semilla de Geeko Store ampliada a doce meses de movimientos, y la medición se hace sobre la carga de la ruta, no sobre una pintura parcial.
6. **La campana y el botón *+ Registrar* de escritorio se cierran aquí aunque su destino no exista.** Ambos son elementos permanentes del cascarón (mapa §4.1) y ambos los pide el alcance de KAM-14. KAM-17 solo cambiará la fuente del contador y el destino de la campana, sin volver a tocar la barra superior.
