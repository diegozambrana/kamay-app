> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/quick-capture/spec.md`, `specs/user-auth/spec.md` y `specs/orders/spec.md` de este cambio. Las decisiones citadas (D1–D8) son las de `design.md`.

## 0. Sin migración

- [ ] 0.1 Confirmar que este cambio no escribe ningún archivo en `supabase/migrations/` ni regenera el grafo (design D3). Si al implementar aparece la necesidad de una vista, detenerse y revisar D3 antes de escribirla: KAM-11 y KAM-12 trabajan sobre el mismo directorio de migraciones.

## 1. Declaración de destinos de registro

- [ ] 1.1 Crear `lib/quick-capture/destinations.ts` con los seis destinos (D1): `key`, `label`, `icon`, `href`, `roles` y `availableFrom` opcional. Pedido → `/orders/new`, Compra → `/expenses/purchases/new`, Gasto → `/expenses/costs/new`; Venta rápida, Consumo y Tarea con `availableFrom` y sin `href`.
- [ ] 1.2 Declarar `roles` según la matriz de acceso: Compra y Gasto solo `owner` (la tabla `expenses` no tiene ninguna política para el ayudante); el resto, ambos roles.
- [ ] 1.3 Añadir la derivada pura `destinationsFor(role)` que filtra por rol conservando el orden de la retícula.
- [ ] 1.4 `lib/quick-capture/destinations.test.ts`: cubre *La retícula de registro rápido se filtra por rol* → «El ayudante no ve los destinos de egreso», «El ayudante sí ve los destinos de trabajo»; y *La pantalla de registro rápido ofrece seis destinos* → «Los seis destinos están presentes» (para `owner`).

## 2. Partición de la navegación móvil

- [ ] 2.1 Añadir el campo `mobile: "bar" | "more"` a `NavEntry` en `components/layout/nav-entries.ts` (D2) y declararlo en todas las entradas existentes: `/quick` y `/orders` como `bar`; `/dashboard`, `/expenses`, `/catalog`, `/contacts` y `/settings` como `more`.
- [ ] 2.2 Cambiar el rótulo de `/quick` de "Registrar" a "Inicio" (mapa §4.2: la primera ranura es Inicio).
- [ ] 2.3 Añadir la entrada `/my-tasks` con rótulo "Tareas", ambos roles, `mobile: "bar"`.
- [ ] 2.4 Añadir `bottomBarEntriesFor(role)` y `moreEntriesFor(role)` como derivadas puras de `navEntriesFor(role)`, sin ninguna lista paralela de rutas.
- [ ] 2.5 Ampliar `components/layout/nav-entries.test.ts` con la partición: toda entrada visible para un rol está en la barra **o** en "Más", nunca en ninguna ni en las dos (riesgo declarado en design); `bottomBarEntriesFor` devuelve exactamente tres entradas —Inicio, Pedidos, Tareas— para `owner` y para `assistant` (invariante de D2). Cubre *The mobile bottom bar carries exactly four slots* → «Four slots, whatever the role»; y *Authenticated shell frames every app screen* → «One declaration feeds every surface».
- [ ] 2.6 Ampliar la misma prueba con el contenido de "Más". Cubre *The "Más" panel holds every remaining section* → «Owner sees the money and system sections», «Assistant sees only what the role can use», «A section with a slot is not repeated».

## 3. Cascarón de Mis pendientes

- [ ] 3.1 Crear `app/(app)/my-tasks/page.tsx` como cascarón con `MainContainer`, siguiendo el patrón del `/quick` actual y nombrando a KAM-17 como la tarea que lo llenará (D7).
- [ ] 3.2 Añadir `/my-tasks` a `PROTECTED_PREFIXES` en `lib/auth/routes.ts`. Sin esto el proxy no reconoce la ruta y la cuarta ranura de la barra lleva fuera del área autenticada.
- [ ] 3.3 Ampliar `lib/auth/routes.test.ts` con `isProtectedPath("/my-tasks")`.

## 4. Barra inferior de cuatro ranuras y panel "Más"

- [ ] 4.1 Reescribir `components/layout/mobile-nav.tsx` para rendir las tres entradas de `bottomBarEntriesFor(role)` más el disparador de "Más" como cuarta ranura. El disparador es un `button`, no un `Link` (D5).
- [ ] 4.2 Rendir el panel "Más" como `Sheet` inferior con las entradas de `moreEntriesFor(role)`; al activar una, navegar y cerrar el panel (D5).
- [ ] 4.3 Ampliar `CAPTURE_ROUTES` con `/expenses/purchases/new` y `/expenses/costs/new` (D8), y exportar `isCaptureRoute` para que el botón *+ Registrar* use el mismo criterio.
- [ ] 4.4 Ampliar `components/layout/mobile-nav.test.tsx`: cuatro ranuras con sus rótulos, la ranura "Tareas" apunta a `/my-tasks`, la barra no se rinde en las rutas de captura nuevas. Cubre *The mobile bottom bar carries exactly four slots* → «Inicio leads to quick capture», «Tareas leads to Mis pendientes»; y *The "Más" panel holds every remaining section* → «Choosing an entry navigates and closes».

## 5. Registrado hoy

- [ ] 5.1 Crear `services/quick-capture/recent-capture-service.ts` con `listToday(organizationId, timezone)` (D3): una consulta acotada a cinco filas del día por cada origen —`orders` y `expenses`—, sin ninguna comprobación de rol en el servicio (RLS decide).
- [ ] 5.2 Extraer la mezcla a una función pura `mergeRecentCaptures(sources, limit)` en `lib/quick-capture/recent.ts`: normaliza a `{ kind, id, label, lineId, occurredAt, href }`, ordena por `created_at` descendente y corta en cinco.
- [ ] 5.3 Resolver "hoy" con la zona horaria de la organización reutilizando `todayInTimezone` de `lib/orders/overdue`, no con la del servidor (D3).
- [ ] 5.4 `lib/quick-capture/recent.test.ts`: cubre *Registrado hoy confirma la captura* → «La lista muestra lo registrado hoy», «Se limita a cinco», «Ayer no cuenta», «El ayudante no ve egresos en la lista» (con la lista de egresos vacía, que es lo que RLS entrega).

## 6. V16 · Pantalla de registro rápido

- [ ] 6.1 Crear `features/quick-capture/quick-grid.tsx`: retícula de dos columnas sobre `destinationsFor(role)`, con todos los botones del mismo tamaño y jerarquía.
- [ ] 6.2 Rendir los destinos sin `href` como `button` deshabilitado con `aria-disabled` y su leyenda de disponibilidad, en su ranura y con el mismo tamaño (D7).
- [ ] 6.3 Crear `features/quick-capture/recent-today.tsx`: lista de hasta cinco elementos con tipo, rótulo, línea y hora, cada uno enlazado a su detalle, y su estado vacío.
- [ ] 6.4 Reescribir `app/(app)/quick/page.tsx`: cargar los registros del día por el servicio y rendir retícula y lista. La página queda delgada; ninguna consulta a Supabase fuera de `services/` (convención nº 1).
- [ ] 6.5 `features/quick-capture/quick-grid.test.tsx`: cubre *La pantalla de registro rápido ofrece seis destinos* → «Los seis destinos están presentes», «Destinos disponibles hoy», «Destinos aún no construidos».

## 7. Botón + Registrar

- [ ] 7.1 Crear `features/quick-capture/register-button.tsx`: botón flotante sobre la esquina inferior derecha, `md:hidden`, que abre el mismo menú derivado de `destinationsFor(role)` que la retícula (D1, D6).
- [ ] 7.2 Montarlo en `app/(app)/layout.tsx` junto a `MobileNav`, ausente en las rutas de `isCaptureRoute` (D8).
- [ ] 7.3 Ajustar el padding inferior de `MainContainer` para que ni la barra ni el flotante tapen la última fila de contenido, una sola vez y no pantalla por pantalla (D6).
- [ ] 7.4 `features/quick-capture/register-button.test.tsx`: cubre *Registrar está a dos toques desde cualquier pantalla móvil* → «El menú respeta el rol», «Las pantallas de captura no lo muestran», «En escritorio no aparece».

## 8. Vista de pedidos por dispositivo

- [ ] 8.1 Exportar `isMobileUserAgent(userAgent)` desde `lib/auth/routes.ts` reutilizando el `MOBILE_UA_PATTERN` existente, sin duplicar la expresión regular (D4), y refactorizar `defaultLandingPath` para que la use.
- [ ] 8.2 En `app/(app)/orders/page.tsx`, calcular la vista por omisión con la cabecera `user-agent`: `list` en móvil, `board` en el resto. Una vista declarada en la dirección sigue mandando.
- [ ] 8.3 Verificar que el tablero se desplaza horizontalmente dentro de sus propios límites en 390 px y que la página no lo hace (el `min-w-0` del layout ya lo contempla).
- [ ] 8.4 Ampliar `lib/auth/routes.test.ts` con `isMobileUserAgent`. Cubre *Vistas alternativas y filtros del tablero* → «En móvil la lista es la vista por omisión», «En escritorio el tablero sigue siendo la vista por omisión» en su parte pura.

## 9. Pruebas e2e en 390 px

- [ ] 9.1 Crear `tests/e2e/mobile-capture.spec.ts` con viewport de 390 px. Recorrido de gasto: entrar, aterrizar en `/quick`, tocar *Gasto*, guardar, volver y ver el gasto encabezando "Registrado hoy". Cubre *Registrado hoy confirma la captura* → «Lo que se acaba de registrar aparece», «Cada elemento abre su registro».
- [ ] 9.2 Añadir al mismo archivo el recorrido de pedido desde el botón *+ Registrar* estando en otra pantalla, contando las interacciones. Cubre *Registrar está a dos toques desde cualquier pantalla móvil* → «Registrar un gasto desde el catálogo», «Registrar un pedido desde los egresos».
- [ ] 9.3 Añadir la comprobación de la retícula en 390 px: los seis destinos visibles sin desplazamiento horizontal. Cubre *La pantalla de registro rápido ofrece seis destinos* → «La retícula cabe en un teléfono».
- [ ] 9.4 Añadir la comprobación de vista por omisión y alternativa en pedidos. Cubre *Vistas alternativas y filtros del tablero* → «En móvil la lista es la vista por omisión», «El tablero sigue disponible en móvil», «La vista declarada manda sobre el dispositivo».
- [ ] 9.5 Añadir la comprobación de ausencia de desplazamiento horizontal recorriendo las pantallas nombradas. Cubre *No app screen scrolls horizontally on a phone* → «Capture screens fit the phone», «Listing screens fit the phone», «A wide component scrolls inside itself».
- [ ] 9.6 Ampliar el e2e de permisos del ayudante con la retícula y el menú: cubre *La retícula de registro rápido se filtra por rol* → «Un destino ausente no se alcanza por dirección».

## 10. Cierre

- [ ] 10.1 Verificar que los egresos siguen rindiéndose como tarjetas en móvil (`ExpenseCard`, ya construido en KAM-09): se comprueba, no se reconstruye.
- [ ] 10.2 Pasar `npm run lint`, `npm run typecheck`, `test:unit` y `test:e2e`.
- [ ] 10.3 Actualizar `openspec/specs/` con `openspec sync` o archivar el cambio, según corresponda al cierre de la tarea.
