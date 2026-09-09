> Cada tarea de prueba nombra los escenarios del delta spec que cubre (convención nº 12: ningún escenario sin prueba referenciada). Los escenarios viven en `specs/assets/spec.md`, `specs/payments/spec.md`, `specs/expenses/spec.md` y `specs/catalog-directory/spec.md` de este cambio. Las decisiones citadas (D1–D10) son las de `design.md`.

## 1. Modelo: `asset_details` y la pertenencia del egreso a un activo

- [x] 1.1 Crear la migración `supabase/migrations/YYYYMMDDHHMMSS_assets.sql` con la tabla `asset_details` según la forma canónica §7 (`item_id` clave primaria y foránea contra `items`, `acquisition_cost`, `acquired_on`, `supplier_id`, `notes`), más `check (acquisition_cost >= 0)` (D1). Ninguna columna derivada: el costo total y el mantenimiento se calculan al leer (convención nº 4).
- [x] 1.2 Añadir en la misma migración el trigger `before insert or update` que exige que `item_id` corresponda a un ítem de tipo `asset` (D1), con el comentario que explica por qué no es un `check`: un `check` no puede consultar otra tabla.
- [x] 1.3 Añadir a `expenses` las columnas `asset_id` (contra `asset_details(item_id)`) y `asset_expense_role` (`check in ('acquisition','maintenance')`), con el `check` de declaración conjunta —los dos nulos o los dos presentes— (D2).
- [x] 1.4 Añadir el índice único parcial sobre `expenses (asset_id) where asset_expense_role = 'acquisition'` (restricción de "una sola adquisición por activo") y el índice `expenses (asset_id) where asset_id is not null` para la lectura del mantenimiento (D10).
- [x] 1.5 Añadir el trigger que exige que el activo referido y el egreso pertenezcan a la misma organización (D2): una foránea sobre `item_id` no puede comprobarlo.
- [x] 1.6 Declarar RLS sobre `asset_details` con el patrón del proyecto: `select`, `insert` y `update` solo para la persona dueña vía `is_owner(organization_id)` resuelto contra el ítem; **ninguna** política `DELETE` (convención nº 3); ninguna política para el ayudante (matriz de acceso §16). `grant` explícitos, siguiendo la nota de `20260826200000`.
- [x] 1.7 Añadir el trigger `log_activity()` sobre `asset_details` en la misma migración que la crea (convención nº 7).
- [x] 1.8 `supabase/tests/asset_integrity.test.sql` (pgTAP): cubre *Datos propios del activo* → «Datos de activo aceptados», «Un ítem que no es activo no tiene datos de activo», «Un solo juego de datos por activo», «Costo negativo rechazado», «El costo declarado se puede corregir», «Un activo del catálogo sin datos todavía». `throws_ok` con cuatro argumentos. Cada prueba crea su propia organización.
- [x] 1.9 Ampliar `supabase/tests/expense_integrity.test.sql`: cubre *Modelo de egreso con dos tipos en una sola tabla* → «Egreso que pertenece a un activo», «Activo sin papel», «Una sola adquisición por activo», «Varios mantenimientos por activo», «El activo es de la misma organización». Los seis escenarios anteriores de ese requisito —«Gasto sin categoría», «Gasto sin monto», «Compra sin proveedor», «Compra con monto propio», «Egreso sin línea de negocio», «Identificador y fecha del hecho fijados por el cliente»— ya están cubiertos en ese mismo archivo y no se reescriben.
- [x] 1.10 `supabase/tests/asset_access.test.sql` (pgTAP): cubre *Activos solo para la persona dueña, verificado en la base de datos* → «El ayudante no lee los activos», «El ayudante no escribe activos», «Ninguna organización ve a otra», «El alta queda en la bitácora». Añadir `asset_details` a la comprobación de `supabase/tests/no_delete.test.sql`, que cubre «Nada se borra».
- [x] 1.11 Ejecutar `supabase db reset` y `supabase test db`; regenerar el grafo con `graphify update .` (convención nº 6).

## 2. Derivados: movimientos de caja, recuperación y vínculos de tarea

- [x] 2.1 Crear la migración `supabase/migrations/YYYYMMDDHHMMSS_asset_recovery.sql` con la vista `line_cash_movements` (`security_invoker = true`): una fila por movimiento no archivado con `organization_id`, `business_line_id`, `occurred_at`, `direction`, `amount` y `asset_id` del egreso pagado (D4). Conservar el `union all` de dos ramas, el descarte de destinos archivados y la condición `is_owner(...)` que documentó KAM-14 (D7).
- [x] 2.2 Redefinir `cash_flow_by_line_month` con `create or replace view` como agregado de `line_cash_movements`, **con exactamente las mismas columnas, el mismo recorte y el mismo corte de mes en la zona horaria de la organización**, y sin filtrar por `asset_id`: comprar una máquina sí salió de caja (D4).
- [x] 2.3 Crear la vista `asset_recovery` (`security_invoker = true`) devolviendo por activo `item_id`, `organization_id`, `business_line_id`, `name`, `acquired_on`, `acquisition_cost`, `maintenance_cost`, `total_cost` y `line_margin_since` (D5). El margen agrega `line_cash_movements` filtrando `asset_id is null` y `occurred_at >= acquired_on` resuelto en la zona horaria de la organización (D4, D6). **Sin porcentaje**: la vista entrega ingredientes.
- [x] 2.4 `grant select` sobre ambas vistas a `authenticated` y `service_role`.
- [x] 2.5 `create or replace function validate_task_link()` en la misma migración para que `entity_type = 'asset'` valide contra `asset_details`, retirando el `v_exists := false` y su comentario de espera.
- [x] 2.6 `supabase/tests/line_cash_movements.test.sql` (pgTAP): cubre *Movimiento de caja con su línea y su activo* → «Un movimiento por fila con su línea», «El activo del pago aparece en la fila», «Un pago corriente no señala ningún activo», «Lo archivado no aparece», «El agregado mensual coincide con el detalle», «El ayudante obtiene cero filas», «Ninguna organización ve a otra». El escenario del agregado se prueba comparando la suma del detalle contra `cash_flow_by_line_month` sobre la misma semilla.
- [x] 2.7 Ejecutar `supabase/tests/dashboard_cash_flow.test.sql` **sin modificarlo**: es la comprobación de que la redefinición no cambió ninguna cifra del panel (riesgo declarado en design). Si falla, el refactor está mal, no la prueba.
- [x] 2.8 `supabase/tests/asset_recovery.test.sql` (pgTAP): cubre *El costo total del activo suma su mantenimiento* → «Mantenimiento vinculado», «El egreso de adquisición no se cuenta dos veces», «Mantenimiento archivado», «El costo total no vive en una columna»; *El margen que recupera la inversión se mide en caja desde la fecha de adquisición* → «Solo desde la fecha de adquisición», «Manda la fecha del movimiento de dinero», «Entregado y no cobrado todavía no recupera», «Lo anulado deja de contar», «Cada activo mira su propia línea»; *La inversión cuenta una sola vez* → «La compra de la máquina no castiga su propia barra», «El mantenimiento sube el costo pero no baja el margen», «El panel sigue viendo la salida de caja», «Un egreso corriente sí resta»; y *Activos solo para la persona dueña* → «El ayudante tampoco lee la recuperación».
- [x] 2.9 Ampliar `supabase/tests/task_links.test.sql`: cubre *Un activo es un destino vinculable válido para una tarea* → «Vínculo a un activo existente», «Vínculo a un activo inexistente».
- [x] 2.10 Ejecutar `supabase db reset`, `supabase test db` y el conjunto de integración completo; regenerar el grafo con `graphify update .`.

## 3. La fórmula de recuperación

- [x] 3.1 Crear `lib/assets/recovery.ts` con la función pura `recoveryOf({ totalCost, marginSince })` → `{ ratio, percent, recovered }` (D5): recorte a 0–100, margen negativo a 0 %, costo total cero a 0 % sin división y sin considerarse recuperado, y `recovered` cuando el margen iguala o supera el costo.
- [x] 3.2 Añadir en el mismo módulo el predicado que decide si un activo tiene línea atribuible, para que la pantalla no repita la comprobación de `business_line_id` nulo.
- [x] 3.3 `lib/assets/recovery.test.ts`: cubre *La fórmula de recuperación vive en un solo lugar y no falla en los bordes* → «Recuperación parcial», «La línea todavía no genera margen», «Recuperación exacta», «Recuperación superada», «Costo total cero».

## 4. Servicios y acciones

- [x] 4.1 Crear `services/assets/asset-service.ts`: `list(organizationId, { businessLineId, includeArchived })` leyendo `asset_recovery` unida al ítem en **una sola consulta**, y `detail(organizationId, itemId)` con los egresos vinculados y sus totales. Ninguna consulta a Supabase fuera de `services/` (convención nº 1).
- [x] 4.2 Añadir a `services/assets/asset-service.ts` la escritura de `asset_details` (alta y edición) y en `services/expenses/expense-service.ts` la escritura de `asset_id` / `asset_expense_role` sobre un egreso existente.
- [x] 4.3 Crear `actions/assets/save-asset-details.ts` y `actions/assets/link-expense-to-asset.ts` (`"use server"` solo aquí, convención nº 1): sesión, organización, rol dueño, validación Zod y `revalidatePath` de `/assets`, `/catalog` y `/expenses`.
- [x] 4.4 `services/assets/asset-service.test.ts`: cubre *Pantalla de activos (V12)* → «La pantalla sigue el selector de línea», «Archivados fuera por omisión», comprobando que ambos recortes llegan a la consulta y no se aplican después en memoria.
- [x] 4.5 `actions/assets/link-expense-to-asset.test.ts`: cubre *Vinculación de gastos de mantenimiento a un activo* → «Vincular y ver el efecto», «Desvincular», «Un egreso pertenece a un solo activo», «Ninguna organización vincula lo ajeno».

## 5. Pantalla V12 · Activos

- [x] 5.1 Crear `features/assets/recovery-bar.tsx`: barra en CSS, sin librería de gráficos, con el porcentaje como texto legible y una marca discreta cuando el activo consta como recuperado. El porcentaje sale de `recoveryOf`, nunca de un cálculo propio del componente (D5).
- [x] 5.2 Crear `features/assets/asset-card.tsx`: nombre, línea o "Compartido", costo, fecha, mantenimiento acumulado y barra. Cuando el activo no tiene línea atribuible, en lugar de barra declara que la recuperación no es atribuible a una línea hasta la regla de reparto de V14.
- [x] 5.3 Crear `features/assets/assets-screen.tsx`: lista de tarjetas reactiva al selector de línea, filtro "Ver archivados" y apilado en una columna a 390 px sin desplazamiento horizontal, respetando el espacio de la barra inferior y del botón flotante.
- [x] 5.4 Crear `features/assets/asset-detail-panel.tsx`: panel lateral (mapa §7) con datos del activo, egreso de adquisición vinculado si existe, lista de egresos de mantenimiento con fecha e importe enlazados a su detalle, desglose del costo total, historial leído de la bitácora, edición de los datos y vinculación de un mantenimiento.
- [x] 5.5 Crear `app/(app)/assets/page.tsx`: página delgada que resuelve `getOwnerContext()` y redirige cuando devuelve nulo (D8), resuelve la línea activa con `resolveActiveLine` y rinde la pantalla.
- [x] 5.6 `features/assets/recovery-bar.test.tsx`: cubre *Pantalla de activos (V12)* → «El recuperado se indica sin fiesta».
- [x] 5.7 `features/assets/assets-screen.test.tsx`: cubre *Pantalla de activos (V12)* → «Una tarjeta por activo», «Una columna en 390 px»; y *Un activo sin línea propia no muestra porcentaje* → «Activo compartido», «Sin reparto inventado».
- [x] 5.8 `features/assets/asset-detail-panel.test.tsx`: cubre *Detalle del activo en panel* → «Detalle con sus gastos», «Del gasto a su egreso», «Historial del activo».

## 6. Alta desde el catálogo (V11)

- [x] 6.1 Añadir a `features/catalog/item-detail.tsx` la sección de datos de activo, visible solo para la persona dueña y solo cuando el ítem es de tipo `asset`: alta y edición de costo, fecha, proveedor y notas, y acceso a `/assets`.
- [x] 6.2 Ampliar `features/catalog/item-detail.test.tsx`: cubre *Alta de un activo desde el catálogo* → «Alta desde el detalle del ítem», «No se ofrece donde no corresponde», «El ayudante no ve la sección»; y *Pantalla de detalle de ítem (V11)* → «Los datos de activo en el detalle de un activo», «El ayudante no ve los datos de activo». Los tres escenarios anteriores de ese requisito —«Variantes gestionadas desde el detalle», «Historial en el detalle», «Sin secciones de inventario ni costos»— ya están cubiertos en ese archivo y no se reescriben.
- [x] 6.3 Ampliar `features/catalog/catalog-screen.test.tsx`: cubre *Un ítem declara su tipo, su unidad y su alcance de línea* → «Un activo sin datos declarados sigue siendo un ítem válido». Los otros tres escenarios de ese requisito —«Ítem de una línea concreta», «Ítem compartido entre líneas», «Activo registrado como ítem»— ya están cubiertos entre `features/catalog/catalog-screen.test.tsx` y `supabase/tests/catalog.test.sql`, y no se reescriben.

## 7. Alta desde la compra y vínculo desde el egreso

- [x] 7.0 Ampliar el selector de la tabla de la compra para que ofrezca también los ítems de tipo activo, distinguiendo su tipo, y sin ofrecer productos. Cubre *Formulario de compra (V8)* → «Comprar una máquina», «Los productos no se compran»; los cinco escenarios anteriores de ese requisito ya están cubiertos en `features/expenses/purchase-form.test.tsx` y `tests/e2e/expenses.spec.ts`, y no se reescriben. Sin este paso el requisito *Alta de un activo desde el registro de una compra* es inalcanzable: `listSuppliesWithVariants` filtra `kind = 'supply'`.

- [x] 7.1 Añadir al formulario de compra (V8) el ofrecimiento posterior al guardado (D9): si alguna línea apunta a un ítem de tipo `asset` sin datos declarados, ofrecer declararlo con costo prellenado desde el importe de esa línea y fecha desde la del egreso, ambos editables; al aceptar, guardar `asset_details` y marcar el egreso con papel `acquisition`. Declinar no deshace la compra.
- [x] 7.2 Añadir al detalle del egreso el activo vinculado con su papel, enlazado a su detalle, y la vinculación y desvinculación como mantenimiento para la persona dueña.
- [x] 7.3 `features/expenses/purchase-form.test.tsx`: cubre *Alta de un activo desde el registro de una compra* → «Compra de una máquina», «Las cifras prellenadas se pueden ajustar», «Rechazar no bloquea la compra», «Un activo ya declarado no se vuelve a ofrecer».
- [x] 7.4 Crear `features/expenses/expense-detail.test.tsx` —hoy `expense-detail.tsx` no tiene prueba unitaria propia—: cubre *Detalle del egreso* → «Gasto que pertenece a un activo», «Vincular desde el egreso». Los cuatro escenarios anteriores de ese requisito —«Compra completa», «Gasto asignado a un pedido», «Historial», «Enlace directo»— ya están cubiertos en `tests/e2e/expenses.spec.ts` y no se reescriben.

## 8. Navegación y acceso

- [x] 8.1 Añadir `/assets` a `PROTECTED_PREFIXES` en `lib/auth/routes.ts`.
- [x] 8.2 Añadir la entrada *Activos* a `components/layout/nav-entries.ts` con `roles: ["owner"]` y `mobile: "more"`, en el grupo *Base* del menú de escritorio (mapa §4.1) (D8). De esa declaración salen el menú lateral y el panel "Más": no se toca ninguno de los dos por separado.
- [x] 8.3 `components/layout/nav-entries.test.ts`: cubre *Activos solo en el menú del dueño y redirección por dirección directa* → «El menú del ayudante no la ofrece», «El menú del dueño la ofrece en ambas superficies».
- [x] 8.4 `lib/auth/routes.test.ts`: comprobar que `/assets` y `/assets/<id>` son rutas protegidas.

## 9. Semilla

- [x] 9.1 Ampliar `supabase/seed.sql` de Geeko Store: al menos dos activos con costo y fecha en líneas distintas, uno con su egreso de adquisición vinculado, uno con al menos un gasto de mantenimiento vinculado, y movimientos de dinero anteriores y posteriores a cada fecha de adquisición, de modo que las barras no salgan todas iguales ni todas en cero.
- [x] 9.2 Ampliar `supabase/tests/seed_geeko.test.sql`: cubre *Semilla de activos de Geeko Store* → «Semilla presente tras el reinicio», «Las barras no salen todas iguales»; y *Semilla de catálogo y directorio de Geeko Store* → «Activos de la semilla con sus datos». Los dos escenarios anteriores de ese requisito —«Semilla presente tras el reinicio» de catálogo y «La búsqueda de la semilla tolera acentos»— ya están cubiertos en ese archivo y no se reescriben.

## 10. e2e y cierre

- [x] 10.1 `tests/e2e/assets.spec.ts`: alta de un activo desde el catálogo, registro de ventas de su línea y verificación de que la barra avanza; vinculación de un gasto de mantenimiento y verificación de que el costo total sube y la barra retrocede. Cubre *Pantalla de activos (V12)*, *Detalle del activo en panel* y *Vinculación de gastos de mantenimiento a un activo* de extremo a extremo.
- [x] 10.2 Ampliar `tests/e2e/assistant-permissions.spec.ts`: cubre *Activos solo en el menú del dueño y redirección por dirección directa* → «Dirección directa del ayudante», y la ausencia de *Activos* en el menú del ayudante en escritorio y en el panel "Más".
- [x] 10.3 Ejecutar la cadena completa de CI: `lint → typecheck → test:unit → supabase start → test:integration → build → test:e2e`. Verificar la cobertura mínima de 90 % en `lib/assets/` y `services/assets/`.
- [x] 10.4 Regenerar el grafo (`graphify update .`) y dejar el árbol limpio antes de proponer el cierre del cambio.
