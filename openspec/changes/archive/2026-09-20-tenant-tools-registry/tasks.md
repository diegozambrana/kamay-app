> Cada tarea nombra la prueba que verifica sus escenarios. Spec entre corchetes: `[tt]` = `tenant-tools`, `[pc]` = `print-cost-3d`, `[ord]` = `orders`, `[set]` = `settings-interaction`.
> Corte posible si hiciera falta partir el cambio: los grupos 1–8 son entregables sin el 9.

## 1. Prerrequisito: el concepto existe por escrito

- [x] 1.1 En `specs/PRD/kamay-especificacion-producto-v6.md` §6.1, añadir el concepto **Herramienta** con la definición de design D1 y la nota que lo distingue de «módulos activables» (V15) y «módulos por línea» (Fase 6); en V15 sumar la sección *Herramientas* y en V4 la acción de herramientas
- [x] 1.2 En `specs/PRD/kamay-esquema-base-de-datos-supabase.md`, documentar `organization_tools`, la función `active_tool_slugs` y su fila en la matriz de acceso (dueña: leer/escribir; ayudante: sin acceso)
- [x] 1.3 En `specs/PRD/kamay-backlog-sprint-01.md`, actualizar KAM-27: entradas, parámetros y salidas reales de la calculadora, la curva de margen, `addOrderLine`, la lectura solo de dueña, y el estado a `en cambio de OpenSpec`

## 2. Esquema

- [x] 2.1 Migración `supabase/migrations/<ts>_organization_tools.sql`: tabla (design D4), `unique (organization_id, slug)`, `check` de forma del slug, RLS activa con `select`/`insert`/`update` por `is_owner`, sin `DELETE`, trigger `log_activity()`, función `active_tool_slugs` (`security definer`, `search_path` fijo, exige `is_member`)
- [x] 2.2 `supabase/tests/organization_tools.test.sql` (pgTAP, `throws_ok` de 4 argumentos, organización propia): aislamiento entre organizaciones; ayudante lee cero filas; ayudante recibe los slugs activos y no los archivados; persona ajena recibe cero slugs; `DELETE` rechazado; duplicado rechazado; slug mal formado rechazado; activar, cambiar `config` y archivar dejan cada uno su fila en `activity_log` — [tt] *La activación…*, *Solo la dueña…*, *…queda en la bitácora*
- [x] 2.3 Aplicar con `psql` en la base local compartida y regenerar tipos
- [x] 2.4 Declarar `organization_tools` en `lib/export/tables.ts` con `ownerOnly: true`; `tests/integration/export-manifest.test.ts` en verde; caso en `tests/integration/export.test.ts`: el ayudante no recibe el archivo — [tt] *La activación sale en la exportación*
- [x] 2.5 `graphify update .`

## 3. Registro y contrato

- [x] 3.1 `tools/types.ts`: `ToolManifest` (slug, name, description, minRole, hooks, capabilities, tables `{reads, writes[via]}`, configSchema, inputSchema, outputSchema, defaults, fixtures), `ToolHook = "page" | "order-detail"`
- [x] 3.2 `tools/registry.ts` (lista a mano, vacía por ahora) y `tools/resolve.ts`: `toolBySlug`, `activeToolsFor(slugs, role, registry = TOOLS)`; `tools/resolve.test.ts`: activas por organización, slug ausente del registro se ignora sin lanzar, filtro por `minRole` con un manifiesto de prueba de rol `assistant`, filtro por enganche — [tt] *…salen de un registro en código*, *Una herramienta activa tiene página propia* (rol)
- [x] 3.3 `tools/contract.test.ts` con `describe.each(TOOLS)`: slug único y bien formado; `defaults` cumple `configSchema`; `calculate(defaults, fixture.input)` cumple `outputSchema` para cada caso de referencia; cada `table` está en `EXPORT_TABLES`; enganches dentro de la lista cerrada; capacidades `network` y `credentials` en `false`; tipos de parámetro soportados por el formulario (design D7) — [tt] *Cada herramienta declara su contrato*, *Los puntos de enganche son una lista cerrada*
- [x] 3.4 En `tools/contract.test.ts`: existe `README.md` con los siete encabezados; cada clave de los tres esquemas aparece entre comillas invertidas en su sección; existe al menos un `*.test.ts` de lógica y un `fixtures.ts` no vacío — [tt] *Cada herramienta trae su documentación y sus pruebas*
- [x] 3.5 En `tools/contract.test.ts`: los `import … from "@/actions/…"` del directorio de cada herramienta (`git grep --untracked`) coinciden exactamente con sus `writes[].via` — [tt] escenario *Operación usada y no declarada*
- [x] 3.6 `tools/boundary.test.ts`, al estilo de `services/notifications/service-role-boundary.test.ts`: ningún archivo bajo `tools/` importa `@supabase/*`, `@/lib/supabase/*`, `@/services/*`, ni contiene `"use server"`, `.rpc(` o `.from(`; incluye archivos sin añadir — [tt] *Una herramienta no accede a los datos por su cuenta*
- [x] 3.7 Verificar a mano que 3.3–3.6 fallan con una herramienta de mentira mal hecha (sin README, con import prohibido) y quitarla
- [x] 3.8 `vitest.config.ts`: `tools/**` dentro del proyecto `unit` (el repositorio no configura hoy ningún umbral de cobertura, así que no hay umbral al que sumarlo; la cobertura de `tools/` se revisa en 10.1)
- [x] 3.9 `tools/README.md`: pasos para añadir una herramienta, la frontera, y la limitación de parámetros para herramientas de ayudante (design D5)

## 4. Calculadora: lógica pura

- [x] 4.1 `tools/print-cost-3d/schema.ts`: `configSchema` (todos los campos con `.default()` y `.meta({label, help, unit, kind})`), `inputSchema`, `outputSchema` — [pc] *Entradas del cálculo*, *Parámetros del taller*
- [x] 4.2 `tools/print-cost-3d/margin-curve.ts`: `marginAt(curve, cost)` y `validateCurve(curve)` con la condición exacta por segmento (design D9), devolviendo el segmento infractor; enganchada como `superRefine` del `configSchema`
- [x] 4.3 `margin-curve.test.ts`: los cinco escenarios de la curva por defecto (5, 50, 30, 70 → 110, 120); una sola ancla = margen fijo; rechazos (10→250 %/12→150 %, margen 90 %, costos no crecientes, márgenes crecientes, lista vacía); la curva por defecto se acepta — [pc] *El margen unitario varía…*, *Una curva de margen nunca hace bajar el precio…*
- [x] 4.4 En `margin-curve.test.ts`, prueba de propiedad con generador de semilla fija (~200 curvas): toda curva aceptada da precio no decreciente sobre una rejilla de costos; toda curva rechazada por monotonía tiene un par que decrece — [pc] *…nunca hace bajar el precio…*
- [x] 4.5 `tools/print-cost-3d/fixtures.ts`: al menos ocho filas reales de la hoja «Calculadora 3D» (Cat Skull, Box ataud, Araña bicolor, Llaveros Bandas 3, Skull Clicker, cat plate, llavero Heart, Mimic Chest) con su costo esperado, y sus precios esperados con margen fijo de 250 %, proporción 80 % y sin redondeo
- [x] 4.6 `tools/print-cost-3d/formula.ts`: `calculate(config, input)` según la spec; `formula.test.ts`: todas las filas de 4.5 con `toBeCloseTo(…, 6)`; un color no recarga; fondo de fallos 20 %; insumos sin margen; placa vacía = ceros; redondeos (26,87 → 27; 3,35 → 3,50; sin redondeo); docena y placa desde valores sin redondear; entradas inválidas (unidades 0, gramos negativos, colores 0, tiempo negativo) rechazadas por `inputSchema`; el tiempo llega en días, horas y minutos y `printMinutes` los suma (11 h = 660 min = 10 h + 60 min) — [pc] *Costo de producción por unidad*, *Precios sugeridos*, *Entradas del cálculo*
- [x] 4.7 `schema.test.ts`: `config` guardada sin `failureRate` se completa con 0; `config` con curva inválida falla el `safeParse`; cambiar el precio por kilo escala el material — [pc] *Parámetros del taller*
- [x] 4.8 `tools/print-cost-3d/manifest.ts` (`minRole: "owner"`, ambos enganches, `writes: order_items via addOrderLine`) y alta en `tools/registry.ts`; `README.md` con las siete secciones; `contract.test.ts` en verde — [pc] *La calculadora es una herramienta del registro…*

## 5. Núcleo: servicio y acciones

- [x] 5.1 `services/tools/organization-tool-service.ts`: `activeSlugs(orgId)` (RPC), `list(orgId)`, `getConfig(orgId, slug)`, `activate(orgId, slug, defaults)` (reactiva si existe, inserta si no), `deactivate`, `updateConfig`; pruebas unitarias con el cliente simulado, siempre con `organization_id` en la consulta
- [x] 5.2 `actions/tools.ts`: `activateTool`, `deactivateTool`, `updateToolConfig` — `getOwnerContext()`, slug contra el registro, `config` validada en servidor con el `configSchema` del manifiesto, `revalidatePath("/", "layout")`; `actions/tools.test.ts`: ayudante rechazado, slug desconocido rechazado, `config` inválida rechazada aunque llegue del cliente — [tt] escenario *El servidor no confía en el formulario*
- [x] 5.3 `tests/integration/tools-lifecycle.test.ts`: activar → configurar → desactivar → reactivar conserva la `config`; dos organizaciones no se ven; la bitácora tiene las cuatro entradas — [tt] *La activación…* (los tres escenarios), *…queda en la bitácora*

## 6. Catálogo y formulario de parámetros

- [x] 6.1 `tools/describe-schema.ts` (junto al contrato, que también lo usa, y no en `features/`): de un `z.object` a una lista de descriptores de campo (design D7), con error explícito ante un tipo no soportado; `tools/describe-schema.test.ts` cubre número, porcentaje, dinero, texto, sí/no, enum y lista de filas
- [x] 6.2 `features/tools/config-form.tsx` (react-hook-form + resolver del esquema): un campo por descriptor, porcentajes mostrados ×100, tabla de filas con añadir/quitar, errores de `superRefine` pintados en su `path`; `config-form.test.tsx`: precarga valores, valor rechazado no guarda y muestra el motivo, filas se añaden y quitan, curva inválida nombra las anclas — [tt] *Los parámetros se editan en un formulario derivado del esquema*
- [x] 6.3 `features/tools/tools-catalog.tsx` y `tool-detail.tsx`: lista del registro con estado, detalle con capacidades en lenguaje llano, rol y enganches; activar, desactivar con confirmación («tus parámetros se conservan»), editar parámetros; patrón de diálogos de `settings-interaction`; pruebas de componente — [tt] *El catálogo vive en la configuración…*
- [x] 6.4 `app/(app)/settings/tools/page.tsx` con su propia guarda `getOwnerContext()`
- [x] 6.5 `features/settings/settings-nav.tsx`: entrada «Herramientas» al final de *Organización*, `ownerOnly`; actualizar `settings-nav.test.tsx` — [set] *Tools closes the Organización group*, *The assistant is not offered Tools*

## 7. Navegación y página propia

- [x] 7.1 `components/layout/nav-entries.ts`: `group?: "tools"` en `NavEntry` y tercer parámetro `tools` en `navEntriesFor` (design D5); `nav-entries.test.ts`: sin herramientas el resultado es idéntico al de hoy, con una aparece tras Configuración y antes de plataforma, `mobile: "more"`, nunca en la barra — [tt] *La navegación muestra una sección Herramientas…*
- [x] 7.2 `app/(app)/layout.tsx` resuelve las herramientas activas una vez y las pasa al shell como `{slug, name, href}`; `app-sidebar.tsx` pinta el título «Herramientas» solo si hay entradas; `mobile-nav.tsx` las lista en «Más»; actualizar `app-sidebar.test.tsx` y `mobile-nav.test.tsx` (sin título vacío; tres ranuras intactas)
- [x] 7.3 `app/(app)/extensions/[slug]/page.tsx`: registro → activa → rol → `config`; cualquier fallo `notFound()`; prueba de la resolución con los cinco escenarios — [tt] *Una herramienta activa tiene página propia*
- [x] 7.4 Migas de pan de `/extensions/<slug>` con el nombre de la herramienta (spec `navigation-breadcrumbs`, sin cambio de requisito)

## 8. Calculadora: página

- [x] 8.1 `tools/print-cost-3d/ui/calculator-form.tsx` (compartido por página y diálogo): entradas, un campo por insumo configurado, cálculo en vivo, desglose con dos decimales, margen aplicado, cuatro precios, tarifas en uso con enlace a `/settings/tools`; aviso y enlace cuando la `config` no es válida; sin desplazamiento horizontal a 390 px
- [x] 8.2 `tools/print-cost-3d/ui/page.tsx` y su alta en el mapa `slug → página`; pruebas de componente: cálculo en vivo, entrada inválida no muestra resultados y marca el campo, `config` inservible no muestra precios, estado vacío al montar — [pc] *La página de la calculadora*, *Nada de lo calculado se guarda* (escenario *Salir y volver*)
- [x] 8.3 `tests/e2e/tools.spec.ts` (primera mitad): catálogo sin herramientas y sin sección en el menú → activar → aparece la sección → configurar un insumo y una tarifa → calcular en `/extensions/print-cost-3d` → desactivar → la entrada desaparece y la dirección da «no encontrada» → reactivar conserva el insumo; el ayudante es enviado fuera de `/settings/tools` y obtiene «no encontrada» en la calculadora. **No cerrar sesión por la interfaz con las cuentas semilla compartidas** — criterios 1, 2, 3, 4 de KAM-27
- [x] 8.4 En `tools/print-cost-3d/ui/page.test.tsx`: un cálculo no puede cambiar ninguna tabla ni la bitácora porque no hay por dónde — se afirma que `page.tsx`, `calculator-form.tsx` y `use-print-cost.ts` no importan ninguna acción, ni store, ni almacenamiento del navegador — [pc] escenario *Un cálculo no deja rastro en la base*

## 9. Enganche en el pedido

- [x] 9.1 Comprobar si `order_items` ya rechaza inserciones sobre un pedido archivado (trigger o restricción); anotar el resultado en design *Risks* y, si existe, traducir su error en `lib/orders/errors.ts`
- [x] 9.2 `OrderItemService.add(orgId, orderId, line)` y acción `addOrderLine` en `actions/orders.ts` (design D6) reutilizando `orderLineSchema`; pruebas unitarias: línea libre sin descripción rechazada con el mensaje del formulario, pedido fuera de alcance, pedido archivado, sin sesión
- [x] 9.3 `tests/integration/add-order-line.test.ts`: la tercera línea no toca las dos primeras y entra en `order_totals`; dos altas concurrentes conservan ambas; organización ajena rechazada; la bitácora registra la creación — [ord] *Añadir una línea sin tocar las demás*
- [x] 9.4 `features/tools/order-tool-actions.tsx` y el *prop* `toolActions` en `features/orders/order-detail.tsx`, resuelto en el servidor desde la página del pedido; nada si la lista está vacía o el pedido está archivado; `order-detail.test.tsx`: los cuatro escenarios — [ord] *El detalle del pedido ofrece las acciones de las herramientas activas*
- [x] 9.5 `tools/print-cost-3d/ui/order-action.tsx`: diálogo con `calculator-form`, elección unitario / por mayor, descripción, cantidad (por defecto las unidades de la placa) y precio editables, confirma con `addOrderLine`, muestra el rechazo del núcleo; pruebas de componente: precio ajustado a mano, rechazo visible, la línea enviada no lleva costo ni margen — [pc] *Desde un pedido, el resultado se vuelve una línea*
- [x] 9.6 `tests/e2e/tools.spec.ts` (segunda mitad): con la calculadora activa, abrirla desde un pedido, confirmar, ver la línea nueva, el total actualizado y la creación en el historial; con la calculadora desactivada la acción no está — criterio 6 de KAM-27

## 10. Cierre

- [x] 10.1 `npm run lint`, `typecheck`, `test:unit` (cobertura ≥ 90 % en `lib/`, `services/` y `tools/`), `test:integration`, `build`, `test:e2e`
- [x] 10.2 Repasar los once criterios de aceptación de KAM-27 contra la prueba que cubre cada uno y anotarlo en el backlog
- [x] 10.3 `graphify update .`; marcar KAM-27 como `archivada` en el backlog tras `/opsx:archive`
