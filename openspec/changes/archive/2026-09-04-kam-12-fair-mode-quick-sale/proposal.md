# KAM-12 · Modo feria y venta rápida

## Why

Kamay ya sabe registrar el trabajo comprometido (KAM-07, KAM-08), lo que sale de caja (KAM-09) y el dinero que se movió de verdad (KAM-10). Falta la mitad del negocio que **no pasa por ningún pedido**: la venta de mostrador y de feria. Hoy esas ventas no existen en el sistema, así que ningún número de ingresos es cierto.

Y no basta con que existan: tienen que poder registrarse **en menos de 15 segundos, con el puesto lleno de gente y sin señal**. La especificación funcional marca V6 como pantalla clave 🔑 y el backlog es explícito: *«Es la pantalla que decide si el sistema se usa»*. Un formulario de pedido recortado no sirve — un solo toque accidental en una barra de navegación durante una feria es una venta perdida, y por eso V6 es la única vista de toda la aplicación autorizada a romper el cascarón.

> **Prerequisitos, ambos cumplidos.** Este cambio **consume entera** la infraestructura sin conexión de **KAM-11** (`925892f`): los criterios 4 y 5 —veinte ventas seguidas sin red, y exactamente veinte registros sin duplicados al reconectar— no se satisfacen sin ella. Y consume **KAM-10** (`27e47aa`): la hoja de cobro inserta un `payments` con `direction = 'in'` contra la venta, y el saldo se lee de `order_totals.paid`. **Este cambio no toca la tabla `payments` ni sus vistas.**
>
> La decisión 5 de `design.md` está escrita contra la API real de `lib/offline/`, no contra un contrato supuesto. Dos puntos en los que esa API obligó a diseñar: `capture()` espera 2 500 ms al vaciado cuando hay red y la feria pasa `deadlineMs: 0` (decisión 6), y el service worker no cachea rutas de negocio, así que la feria abre sin red desde un snapshot propio en lugar de precachear `/fair` (decisión 12).

## What Changes

- **Ventas directas como `orders` con `kind = 'direct_sale'`.** Sin tabla nueva y sin concepto nuevo: la decisión de esquema (§ 9 del esquema canónico) ya reservó `kind` para esto, precisamente para que **ninguna consulta de ingresos tenga que unir dos fuentes**. La interfaz mantiene los dos flujos completamente separados; el almacenamiento no.
- **Nueva función `create_direct_sale(p_sale jsonb, p_items jsonb, p_payment jsonb)`** en una migración nueva: crea la venta, sus líneas y —cuando se cobra en el acto— su movimiento de cobro, **en una sola transacción**. Es la hermana de `create_order`, con tres diferencias deliberadas: el cliente es opcional, la venta nace en un estado de tipo **`final`** (no `initial`: una venta de feria no tiene ciclo de producción que recorrer), y acepta el cobro en la misma llamada para que una venta sea **una sola operación encolable**.
- **`create_order` queda como está**: sigue rechazando cualquier `kind` que no sea `'order'`. Las dos vías no se mezclan.
- **Grupo de rutas `(fair)` con layout propio en `/fair`**, sin barra superior, sin barra inferior, sin menú y sin botón flotante. El único control tocable de navegación es *Salir del modo feria*, que vuelve a `/quick` (V16).
- **V6 · Venta rápida:** cuadrícula grande de productos de la línea con foto y precio, ordenada por más vendidos; carrito con total; barra inferior fija con el total y *Cobrar*; hoja de cobro con monto, método y cliente opcional; *Confirmar* devuelve a la cuadrícula.
- **Vuelta inmediata a la cuadrícula tras cada venta**, sin pantalla de confirmación intermedia: la venta se encola en el outbox y la interfaz confirma sin esperar al servidor.
- **Línea y canal se fijan al entrar al modo**, no en cada venta: la línea viene del contexto de línea activa y el canal se resuelve al primero por posición, con un paso breve de inicio de feria cuando hay algo que elegir. Quedan fijos para toda la sesión.
- **Snapshot de feria en Dexie**: al entrar al modo con red se guarda el catálogo vendible de la línea, la línea y el canal de la sesión, y la hora de la captura. `/fair` se precachea como cascarón y renderiza desde ahí, de modo que **llegar al puesto sin señal y abrir la aplicación lleva a la cuadrícula**, no a la página de sin conexión. La cuadrícula muestra siempre de cuándo es el catálogo cargado.
- **La venta se registra como operación de la cola** (`directSale.create`), añadida al registro de `features/sync/operations.ts` que KAM-11 dejó preparado para esto.
- **Indicador de ventas pendientes de sincronizar** propio del modo feria, sobre el store de KAM-11 y filtrado a las ventas: el cascarón que aloja el indicador general no se monta aquí.
- **La venta directa no aparece en el tablero de pedidos.** El servicio ya filtra `kind = 'order'`; este cambio lo eleva a **requisito con escenario propio**, para que dejar de filtrar rompa una prueba y no una feria.
- **Los ingresos de ventas directas se suman como los de pedidos** en cualquier consulta de ingresos: `order_totals` ya incluye ambas, y una prueba de integración lo fija.

**Fuera de alcance** (copiado literalmente del backlog):
- Descuentos, impuestos, cliente obligatorio, búsqueda avanzada.
- Cierre de feria con resumen del evento (Fase 6).
- Impresión de comprobantes.

Derivado de lo anterior, tampoco entran: la infraestructura sin conexión en sí —motor de la cola, reintentos, vaciado, resolución de conflictos— que es **KAM-11** y aquí solo se consume y se extiende con una operación y una tabla; la pantalla V16 de registro rápido, que es **KAM-13** y de la que hoy solo se usa la ruta `/quick` ya existente como destino de salida; el descuento de inventario al vender, que es **KAM-18**; el panel con las tarjetas de dinero (**KAM-14**) y los reportes de ventas (**KAM-20**); y la edición o cancelación de una venta directa ya registrada, que sigue las vías generales de pedido y no gana pantalla propia.

**Supuestos registrados** (el backlog no los fija y cambian el resultado):

1. **Estado de la venta directa:** nace en el estado de tipo `final` de menor `position` del juego resuelto para su línea y el flujo `order`. La integridad de juegos de estados (KAM-05) ya garantiza que todo juego tiene al menos un `final`, así que no hay caso sin salida. No se crea un flujo `direct_sale` nuevo: sería un concepto ausente de la especificación (convención nº 11).
2. **Cobro en el acto:** la hoja de cobro registra el cobro completo por omisión, porque una venta de feria se paga al entregarla. El monto es editable y un cobro menor deja la venta con saldo pendiente, exactamente igual que un pedido; un monto en cero registra la venta sin cobro. No se inventa ningún estado «fiado».
3. **Orden de la cuadrícula:** «más vendidos» se calcula por cantidad vendida en los últimos 90 días dentro de la línea activa, y los productos sin ventas van después por nombre. La ventana vive en un solo sitio para que KAM-20 la herede.
4. **Alcance del catálogo:** la cuadrícula ofrece ítems con `kind = 'product'` no archivados de la línea activa o compartidos, con precio de venta definido. Un producto sin precio no se puede vender en dos toques.
5. **`fair-offline.spec.ts` es de este cambio.** KAM-11 prueba su cola con unitarias y su propia e2e de infraestructura; el recorrido completo —veinte ventas sin red, reconexión, veinte registros con su hora real y ninguno duplicado— se escribe aquí, que es donde el recorrido existe de verdad.

## Capabilities

### New Capabilities

- `fair-mode`: la venta directa de feria y mostrador — ventas como `orders` con `kind = 'direct_sale'` nacidas en un estado de tipo `final` y creadas junto a su cobro en una sola operación transaccional y encolable; el modo feria como grupo de rutas propio sin ningún elemento de navegación tocable salvo la salida explícita; la cuadrícula de productos más vendidos, el carrito y la hoja de cobro que completan una venta de dos productos en cuatro interacciones; el retorno inmediato a la cuadrícula sin pantallas intermedias; el cliente opcional con línea y canal preseleccionados una sola vez por feria; el indicador de ventas pendientes de sincronizar; y la garantía de que veinte ventas registradas sin red producen exactamente veinte registros con su hora real al reconectar.

### Modified Capabilities

- `orders`: el alta deja de tener una sola vía. Se fija como requisito que `create_order` es exclusiva del `kind = 'order'` y que la venta directa entra por su propia función, naciendo en un estado de tipo `final` y sin cliente obligatorio; que el tablero, sus vistas alternativas y sus filtros **excluyen** las ventas directas, porque no tienen ciclo de producción; y que toda consulta de ingresos las incluye junto a los pedidos, con `order_totals` como fuente única.

## Impact

- **Base de datos:** una migración nueva `YYYYMMDDHHMMSS_direct_sales.sql` con `create_direct_sale(...)` y la vista derivada de productos más vendidos (`security_invoker = true`). **No se crea ninguna tabla ni columna**: `orders`, `order_items` y `payments` ya sirven tal cual. Ampliación de `supabase/seed.sql` con ventas directas de Alfarería y su historial de ventas, para que la cuadrícula de más vendidos tenga materia. No se edita ninguna migración existente (convención nº 6).
- **Enrutado:** grupo nuevo `app/(fair)/` con `layout.tsx` propio y `app/(fair)/fair/page.tsx`. El layout raíz y el grupo `(app)` no se tocan; el modo feria vive fuera del cascarón por decisión de producto (ARCHITECTURE § Enrutado).
- **Código de aplicación:** `services/fair/fair-sale-service.ts` (consulta de la cuadrícula y alta de la venta); `actions/fair.ts`; `features/fair/` con la cuadrícula, el carrito (store de Zustand), la barra inferior, la hoja de cobro, el control de salida y el indicador de pendientes; `features/fair/sync/` como punto de encolado sobre `lib/offline/` de KAM-11 (ARCHITECTURE § Modo sin conexión).
- **Archivos de KAM-11 que se tocan, de forma aditiva:** `features/sync/operations.ts` gana el registro de `directSale.create` —el propio archivo anticipa que KAM-12 añadiría el suyo— y `app/sw.ts` gana la regla de cascarón de `/fair`. Ninguno de los dos cambia el comportamiento existente. Se añade una tabla `fairSnapshot` al esquema Dexie de `lib/offline/db.ts`.
- **Dependencias nuevas:** ninguna propia. Serwist y Dexie los instala KAM-11.
- **Pruebas:** unitarias (carrito, total, orden de la cuadrícula, forma del sobre encolado); pgTAP (la venta nace en un estado `final` de su línea; `create_order` rechaza `direct_sale`; venta sin cliente aceptada y pedido sin cliente rechazado; la venta y su cobro son atómicos; aislamiento por organización; el ayudante puede vender); integración (los ingresos de la línea suman pedidos y ventas directas desde `order_totals`; el tablero no devuelve ventas directas); e2e `fair-offline.spec.ts` —**la prueba crítica del proyecto**— y la verificación de que el modo no expone ningún elemento de navegación tocable salvo la salida.
- **Grafo:** regenerar `graphify update .` tras la migración (convención nº 6).
- **Sin bloqueos pendientes:** KAM-10 y KAM-11 están en la historia de la rama de trabajo. `main` sigue en el commit inicial porque este repositorio encadena ramas KAM en vez de fusionarlas.
