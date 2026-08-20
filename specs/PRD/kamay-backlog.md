# Kamay — Backlog de Implementación

> Deriva de: especificación funcional v6.0 · esquema de base de datos · mapa de navegación · ARCHITECTURE.md
> **23 tareas** que cubren las Fases 0 a 4
> Formato pensado para ejecutarse con asistencia de IA, con control

---

## Cómo usar este backlog

**Una tarea = un cambio de OpenSpec.** Cada entrada de este documento se convierte en `openspec/changes/<id>/` con su propuesta, su diseño, su delta spec y sus tareas ejecutables. Nada se implementa sin ese paso previo.

**Tamaño deliberado:** las tareas son grandes —de medio día a tres días de trabajo asistido— porque fragmentarlas en decenas de micro-tareas obliga a repetir el contexto una y otra vez y es justamente donde el sistema anterior se descontroló. Cada tarea entrega **algo utilizable**, no una pieza suelta.

**La sección "Fuera de alcance" no es decorativa.** Es el mecanismo concreto que impide que un asistente agregue funcionalidad que nadie pidió. Debe copiarse literalmente al `proposal.md` del cambio.

**Regla de secuencia:** no se empieza una tarea con la anterior a medio terminar. Fue exactamente eso lo que hundió la versión anterior.

### Convención de criterios de aceptación

- Los criterios de **comportamiento** se escriben `Dado / Cuando / Entonces` y deben poder convertirse en una prueba sin reinterpretarlos.
- Los criterios **estructurales** se escriben como afirmaciones verificables.
- Un criterio que no se puede verificar automáticamente no es un criterio: es un deseo. Va en el `design.md`, no aquí.

### Definición de terminado (aplica a todas las tareas)

- [ ] El cambio de OpenSpec existe, fue revisado y tiene su alcance cerrado.
- [ ] Todos los criterios de aceptación tienen al menos una prueba que los verifica.
- [ ] `lint`, `typecheck`, unitarias, integración y e2e pasan en CI.
- [ ] Si tocó el esquema: migración nueva + prueba pgTAP + `graphify .` regenerado.
- [ ] Si tocó permisos: prueba explícita de aislamiento entre organizaciones y de rol.
- [ ] No se introdujo ningún concepto ausente del modelo conceptual de la especificación.
- [ ] Ningún valor derivado quedó almacenado en una columna o en un store.
- [ ] El cambio de OpenSpec quedó archivado.

---

## Resumen

| ID | Tarea | Fase | Depende de | Vistas |
| --- | --- | --- | --- | --- |
| KAM-01 | Andamiaje del proyecto y disciplina de trabajo | 0 | — | — |
| KAM-02 | Autenticación, organizaciones y aislamiento | 0 | 01 | V1 |
| KAM-03 | Bitácora desde el primer día | 0 | 02 | — |
| KAM-04 | Configuración de la organización y semilla | 0 | 03 | V15 (parcial) |
| KAM-05 | Estados configurables por línea | 0 | 04 | V22 |
| KAM-06 | Catálogo y directorio | 0 | 04 | V10, V11, V13 |
| KAM-07 | Pedidos: tablero y detalle | 1 | 05, 06 | V3, V4 |
| KAM-08 | Alta y edición de pedidos | 1 | 07 | V5 |
| KAM-09 | Egresos: compras y gastos | 1 | 06 | V7, V8, V9 |
| KAM-10 | Cobros y pagos | 1 | 07, 09 | — |
| KAM-11 | Infraestructura sin conexión | 1 | 08 | — |
| KAM-12 | Modo feria y venta rápida | 1 | 10, 11 | V6 |
| KAM-13 | Registro rápido y navegación móvil | 1 | 12 | V16 |
| KAM-14 | Panel principal y variante del ayudante | 1 | 10 | V2 |
| KAM-15 | Tareas: modelo y tablero | 2 | 05 | V17 |
| KAM-16 | Detalle de tarea, Markdown y adjuntos | 2 | 15 | V18 |
| KAM-17 | Mis pendientes, recordatorios y avisos | 2 | 16 | V20, V21 |
| KAM-18 | Inventario suave | 3 | 09 | — |
| KAM-19 | Activos y recuperación de inversión | 3 | 09 | V12 |
| KAM-20 | Reportes | 3 | 18, 19 | V14 |
| KAM-21 | Vínculos y entregables de tareas | 4 | 17, 18 | V19 |
| KAM-22 | Bitácora: pantalla, filtros y retención | 4 | 03 | V23 |
| KAM-23 | Endurecimiento y puesta en producción | 4 | todas | — |

---

# FASE 0 · Cimientos

## KAM-01 · Andamiaje del proyecto y disciplina de trabajo

**Objetivo:** dejar el repositorio listo para que todo el trabajo posterior tenga estructura, pruebas y especificaciones desde el primer commit, en lugar de agregarlas después.

**Alcance**
- Proyecto Next.js 16 + React 19 + TypeScript `strict`, con el alias `@/*`.
- Tailwind 4, shadcn/ui inicializado con tema neutro y modo claro/oscuro.
- Estructura de carpetas completa de ARCHITECTURE.md, aunque muchas queden vacías.
- Supabase local (`supabase init`), con `supabase start` funcionando.
- Arnés de pruebas: Vitest + Testing Library, Playwright, pgTAP habilitado.
- `openspec init` con `project.md` que recoge las convenciones de ARCHITECTURE.md.
- Graphify instalado, primer grafo generado, gancho de git configurado, `graphify-out/` versionado.
- CI en GitHub Actions con la secuencia completa.

**Fuera de alcance**
- Cualquier pantalla de producto. Ninguna tabla de negocio. Ningún dato.

**Criterios de aceptación**
1. `npm run dev` levanta la aplicación con una página vacía y el conmutador de tema funcionando.
2. `npm run lint`, `npm run typecheck`, `test:unit`, `test:integration` y `test:e2e` se ejecutan sin error, aunque las suites estén casi vacías.
3. Existe al menos una prueba de cada nivel (unitaria, pgTAP, e2e) que pasa, para demostrar que el arnés funciona de extremo a extremo.
4. `supabase start` y `supabase db reset` completan sin error.
5. `openspec view` muestra el proyecto inicializado y `openspec/project.md` incluye las convenciones no negociables de ARCHITECTURE.md.
6. `graphify-out/` está versionado y el gancho `post-commit` actualiza el grafo.
7. El pipeline de CI corre en un pull request de prueba y falla si se rompe deliberadamente el typecheck.

**Pruebas requeridas:** una de cada nivel, mínimas, como verificación del arnés.

---

## KAM-02 · Autenticación, organizaciones y aislamiento

**Objetivo:** que un usuario pueda entrar, pertenecer a una o más organizaciones, y que sea imposible —verificado por prueba— que vea datos de otra.

**Alcance**
- Tablas `organizations` y `memberships`; funciones `is_member()` e `is_owner()`.
- RLS activo en ambas tablas, con el patrón de políticas de ARCHITECTURE.md y **sin política `DELETE`**.
- Pantallas de inicio de sesión, recuperación de contraseña y selección de organización (V1).
- `middleware.ts` con refresco de sesión y bloqueo del grupo `(app)`.
- `UserProvider` y `OrganizationProvider`; `UserStore` y `OrganizationStore`.
- Cascarón de layout: barra superior de escritorio y barra inferior móvil, con navegación vacía.

**Fuera de alcance**
- Registro público de usuarios (las cuentas se crean por invitación).
- Gestión de usuarios y roles desde la interfaz (llega en KAM-04).
- Inicio de sesión con redes sociales.

**Criterios de aceptación**
1. Dado un usuario sin sesión, cuando visita cualquier ruta de `(app)`, entonces es redirigido a `/auth/login`.
2. Dado un usuario con sesión, cuando entra, entonces aterriza en `/dashboard` en escritorio y en `/quick` en móvil.
3. Dado un usuario que pertenece a dos organizaciones, cuando inicia sesión, entonces se le pide elegir una antes de continuar.
4. Dado un usuario de la organización A, cuando consulta cualquier tabla existente, entonces obtiene **cero filas** de la organización B.
5. Ningún usuario autenticado puede ejecutar `DELETE` sobre ninguna tabla.
6. La sesión se refresca en cada petición sin obligar a volver a iniciar sesión.
7. Al expirar la sesión y volver a entrar, el usuario regresa a la ruta que intentaba abrir.

**Pruebas requeridas**
- pgTAP: `rls_isolation`, `no_delete`.
- e2e: `auth.spec.ts` completo, incluida la expiración.

---

## KAM-03 · Bitácora desde el primer día

**Objetivo:** garantizar que ningún cambio del sistema ocurra sin quedar registrado, **antes de que exista una sola fila de datos reales**. Un historial no se reconstruye hacia atrás.

**Alcance**
- Tabla `activity_log` con sus índices.
- Función `log_activity()` genérica: detecta creación, modificación, cambio de estado, archivado y desarchivado; guarda solo los campos modificados; ignora `created_at` y `updated_at`.
- Fusión de ediciones sucesivas del mismo autor sobre el mismo registro dentro de 5 minutos.
- RLS: lectura solo para el dueño; permisos de escritura revocados para `authenticated` y `anon`.
- Aplicación del trigger a `organizations` y `memberships`, y procedimiento documentado para aplicarlo a cada tabla futura.

**Fuera de alcance**
- La pantalla de bitácora (V23) y los filtros — llegan en KAM-22.
- La política de retención y su purga — llega en KAM-22.
- Registros técnicos de fallas del sistema; no forman parte de este módulo.

**Criterios de aceptación**
1. Dado cualquier `INSERT` en una tabla auditada, entonces se crea un evento con acción `created`, autor, organización y contenido.
2. Dado un `UPDATE` que cambia un solo campo, entonces el evento guarda **únicamente ese campo**, con su valor anterior y el nuevo.
3. Dado un `UPDATE` que solo toca `updated_at`, entonces **no** se genera ningún evento.
4. Dado un registro que pasa a archivado, entonces la acción registrada es `archived`, no `updated`.
5. Dadas dos ediciones del mismo usuario sobre el mismo registro con 2 minutos de diferencia, entonces existe **un solo** evento con ambos cambios fusionados.
6. Dado un usuario dueño, cuando intenta `UPDATE` o `DELETE` sobre `activity_log`, entonces la operación falla.
7. Dado un ayudante, cuando consulta `activity_log`, entonces obtiene cero filas.

**Pruebas requeridas**
- pgTAP: `audit_trigger`, `activity_immutable`, incluidos los siete criterios.

---

## KAM-04 · Configuración de la organización y semilla

**Objetivo:** que el sistema sea configurable sin programar, y que Geeko Store quede cargada con sus tres líneas reales.

**Alcance**
- Tablas `business_lines`, `sales_channels`, `expense_categories`, `units`; `organizations.settings`.
- Pantalla de configuración (V15) con las secciones: General, Líneas de negocio, Canales, Categorías, Unidades, Usuarios y roles.
- Gestión de usuarios: invitar, cambiar rol, archivar membresía.
- **Selector de línea global**: componente en la barra superior, persistente entre secciones y entre sesiones.
- Semilla de Geeko Store: Sublimación, Impresión 3D, Alfarería y General/Compartido, con sus colores; canales Feria, Redes, Pedido directo, Mostrador.

**Fuera de alcance**
- Configuración de estados (KAM-05) y de notificaciones (KAM-17).
- Política de retención de bitácora (KAM-22).
- Regla de reparto de gastos compartidos (KAM-20).
- Facturación de la aplicación o planes.

**Criterios de aceptación**
1. Dado un dueño, cuando crea una línea de negocio, entonces queda disponible de inmediato en el selector global con su color.
2. Dado un usuario con una línea seleccionada, cuando navega a otra sección, entonces la selección se conserva.
3. Dado un usuario que cierra sesión y vuelve al día siguiente, entonces el selector conserva su última línea.
4. Dado un ayudante, cuando abre `/settings` por dirección directa, entonces es redirigido y la opción no aparece en su menú.
5. Una línea archivada deja de ofrecerse en formularios nuevos, pero los registros históricos que la usan siguen mostrándola correctamente.
6. Existe exactamente una línea con `is_shared = true` (General/Compartido) y no puede archivarse.
7. Tras `supabase db reset`, Geeko Store queda creada con sus cuatro líneas y sus canales.

**Pruebas requeridas**
- Unitarias: persistencia del selector, resolución de la línea activa.
- pgTAP: `rls_roles` para configuración.
- e2e: crear línea, verificar persistencia del selector al navegar.

---

## KAM-05 · Estados configurables por línea

**Objetivo:** permitir que cada línea tenga su propio flujo de trabajo sin que la flexibilidad rompa alertas, indicadores ni reportes.

**Alcance**
- Tabla `statuses` con `kind` declarado, `is_queue`, alcance por organización o por línea.
- Función `resolve_statuses()` y su uso desde los servicios.
- Trigger de integridad: todo juego necesita al menos un `initial` y un `final`.
- Pantalla V22: lista ordenable por arrastre, edición en el sitio, archivar con reasignación, restaurar valores por defecto.
- Semilla: los cuatro estados de tarea; los seis de pedido de Sublimación; los tres de Alfarería; el juego provisional de 3D.

**Fuera de alcance**
- Reglas automáticas de transición, transiciones condicionales o permisos por estado.
- Usar los estados en un tablero real; eso llega en KAM-07 y KAM-15.

**Criterios de aceptación**
1. Dada una línea sin juego propio, cuando se resuelven sus estados, entonces se devuelve el juego de la organización.
2. Dada una línea con juego propio, entonces se devuelve el suyo y el de la organización se ignora por completo.
3. Dado un intento de guardar un juego sin estado `final`, entonces la operación falla con un mensaje comprensible.
4. Dado un estado con `is_queue = true` y `kind` distinto de `waiting`, entonces la restricción de la base de datos lo rechaza.
5. Dado un estado en uso que se archiva, entonces el sistema exige indicar a qué estado mover los registros que quedaban y ninguno queda huérfano.
6. Dado un cambio en la configuración de estados, entonces los registros anteriores conservan el estado que tuvieron y la bitácora lo demuestra.
7. Ninguna consulta del código compara estados por nombre; todas usan `kind`.

**Pruebas requeridas**
- Unitarias: `resolve_statuses`, validaciones del formulario.
- pgTAP: `status_integrity`.
- e2e: `status-config.spec.ts` — personalizar Alfarería sin afectar a las otras líneas.

---

## KAM-06 · Catálogo y directorio

**Objetivo:** tener la base de datos del negocio —qué compro, qué vendo, con quién trato— antes de registrar la primera operación.

**Alcance**
- Tablas `items`, `item_variants`, `contacts`.
- Pantallas V10 (catálogo con pestañas por tipo), V11 (detalle de ítem) y V13 (contactos en dos paneles).
- Filtro "Ver archivados" en ambos listados; archivar y desarchivar.
- Creación al vuelo de contactos desde cualquier buscador.
- Búsqueda por nombre con acentos tolerados.

**Fuera de alcance**
- Saldos de inventario y último costo (KAM-18); en esta tarea el detalle de ítem no muestra esas secciones.
- Activos y su recuperación (KAM-19).
- Tareas relacionadas (KAM-15).
- Códigos de barras, ubicaciones de almacén, lotes.

**Criterios de aceptación**
1. Dado un ítem tipo insumo, producto o activo, entonces se guarda con su tipo, unidad y línea, o marcado como compartido.
2. Dado un contacto, entonces puede ser proveedor, cliente o ambos, y no puede guardarse sin al menos un rol.
3. Dado un ítem archivado, entonces desaparece de listados y buscadores pero sigue visible en los registros históricos que lo referencian.
4. Dado un archivado por error, entonces el dueño puede desarchivarlo desde el filtro "Ver archivados" y el registro vuelve intacto.
5. Dado un ayudante, entonces puede crear y editar ítems y contactos, pero no archivarlos.
6. Dada una búsqueda por "sublimacion" sin tilde, entonces encuentra "Taza para sublimación".
7. Ninguna columna de `items` almacena saldo, último costo ni margen.

**Pruebas requeridas**
- Unitarias: normalización de búsqueda, validación de roles de contacto.
- pgTAP: RLS y ausencia de `DELETE`.
- e2e: `archive-restore.spec.ts`.

---

# FASE 1 · El ciclo del dinero

## KAM-07 · Pedidos: tablero y detalle

**Objetivo:** poder ver y mover el trabajo comprometido con clientes, con el flujo real de cada línea.

**Alcance**
- Tablas `orders` y `order_items`; trigger de numeración por organización.
- Vista `order_totals`.
- V3: tablero kanban con columnas resueltas dinámicamente, arrastre entre columnas, vistas lista y calendario, filtros y "ver archivados".
- Columna en cola: orden por `queued_at` y número de posición visible.
- Alerta de retraso que **ignora** los estados de tipo `waiting`.
- V4: detalle con líneas, notas, imágenes de referencia e historial.

**Fuera de alcance**
- Alta y edición de pedidos (KAM-08). En esta tarea los datos entran por semilla.
- Cobros (KAM-10), rentabilidad (KAM-20), tareas relacionadas (KAM-21).
- Ventas directas y modo feria (KAM-12).

**Criterios de aceptación**
1. Dado un pedido de Sublimación, entonces el tablero muestra exactamente sus seis estados, en orden.
2. Dado un pedido de Alfarería, entonces el tablero muestra sus tres estados, sin rastro de los de Sublimación.
3. Dado un pedido arrastrado a otra columna, entonces su estado cambia, la bitácora lo registra y la interfaz no espera a la respuesta para moverse.
4. Dado un pedido en un estado de tipo `waiting` con fecha vencida, entonces **no** muestra alerta de retraso.
5. Dado un pedido en un estado de tipo `in_progress` con fecha vencida, entonces **sí** la muestra.
6. Dados tres pedidos en la columna En cola, entonces aparecen numerados 1, 2 y 3 por orden de entrada, no por fecha comprometida.
7. Dado un pedido reordenado dentro de la cola, entonces el resto se renumera de forma consistente.
8. El total del pedido nunca se guarda: se calcula desde sus líneas.

**Pruebas requeridas**
- Unitarias: cálculo de total, lógica de alerta de retraso por `kind`, orden de cola.
- pgTAP: numeración sin duplicados bajo inserciones simultáneas.
- e2e: recorrer un pedido por todos sus estados.

---

## KAM-08 · Alta y edición de pedidos

**Objetivo:** registrar un pedido completo en menos de un minuto, y poder guardarlo incompleto sin fricción.

**Alcance**
- V5 en móvil y escritorio.
- Buscador de cliente con creación al vuelo.
- Líneas de pedido desde el catálogo, con cantidad y precio editables.
- Fecha comprometida con atajos, canal, modo de entrega, nota y adjuntos.
- Acciones *Guardar* y *Guardar y crear otro*.
- Edición y cancelación de pedidos existentes.

**Fuera de alcance**
- Descuentos, impuestos, condiciones de pago, cotizaciones formales.
- Campos estructurados de personalización (sigue pendiente de decisión: por ahora, nota y foto).

**Criterios de aceptación**
1. Dado un pedido con cliente y una línea, entonces puede guardarse aunque falten fecha, canal y modo de entrega.
2. Dado un intento de guardar sin cliente o sin líneas, entonces se impide con un mensaje claro señalando el campo.
3. Dado un cliente inexistente escrito en el buscador, entonces puede crearse con nombre y teléfono sin abandonar el formulario.
4. Dada la acción *Guardar y crear otro*, entonces el formulario vuelve en blanco conservando línea de negocio y canal.
5. Dado un formulario con datos y una salida sin guardar, entonces se pide confirmación antes de descartar.
6. Dado un pedido guardado, entonces su estado inicial es el de tipo `initial` del juego de su línea.
7. Medición registrada en la prueba e2e: el recorrido completo de alta se completa en menos de 15 interacciones.

**Pruebas requeridas**
- Unitarias: esquema Zod, mínimos obligatorios.
- e2e: alta completa, alta mínima, creación de cliente al vuelo.

---

## KAM-09 · Egresos: compras y gastos

**Objetivo:** que todo lo que sale de caja quede registrado el mismo día, con su línea de negocio, sin que el registro cueste más de lo que vale.

**Alcance**
- Tablas `expenses` y `expense_items`; vista `expense_totals`.
- V7: bandeja única con compras y gastos, filtros y totales del periodo.
- V8: formulario de compra con tabla editable de insumos y pista del último precio pagado.
- V9: formulario de gasto, deliberadamente corto, con monto dominante y categorías como chips.
- Adjuntar comprobante fotográfico con compresión en el cliente.
- Estado de pago: pagado, pendiente, parcial.

**Fuera de alcance**
- Movimientos de inventario derivados de la compra (KAM-18).
- Cobros y pagos como registros propios (KAM-10).
- Facturación fiscal, retenciones, órdenes de compra, conciliación bancaria.

**Criterios de aceptación**
1. Dado un gasto, entonces no puede guardarse sin monto, categoría y línea de negocio.
2. Dada una compra, entonces no puede guardarse sin proveedor ni sin al menos una línea de insumo.
3. Dada una compra, entonces su total **no se almacena**: se calcula desde sus líneas y coincide con la suma manual.
4. Dado un insumo comprado antes, entonces el formulario muestra su último precio conocido como pista, sin autocompletarlo.
5. Dado un ayudante, entonces `/expenses` no aparece en su menú y el acceso por dirección directa lo redirige.
6. Dada una foto de comprobante de 8 MB, entonces se comprime antes de subir y el guardado no se bloquea esperándola.
7. Un gasto de la línea General queda disponible para el reparto proporcional posterior, sin asignarse a ninguna línea concreta.
8. Medición registrada en la prueba e2e: registrar un gasto toma 5 interacciones o menos.

**Pruebas requeridas**
- Unitarias: validaciones por tipo de egreso, cálculo de total.
- pgTAP: restricciones `purchase_needs_supplier`, `expense_needs_category_and_amount`, `derived_values`.
- e2e: registrar gasto y compra; intento de acceso del ayudante.

---

## KAM-10 · Cobros y pagos

**Objetivo:** saber en todo momento cuánto me deben y cuánto debo, con el detalle de cada movimiento real de dinero.

**Alcance**
- Tabla `payments` con sus restricciones de destino único y dirección.
- Registro de cobro desde el detalle de pedido; registro de pago desde el detalle de egreso.
- Cálculo de saldo pendiente en `order_totals` y `expense_totals`.
- Indicadores "Por cobrar" y "Por pagar", y badges de pago en tarjetas y listados.
- Anulación de un cobro mediante un movimiento inverso, nunca borrando.

**Fuera de alcance**
- Cobros en línea o pasarelas de pago.
- Recordatorios automáticos de cobro.
- Conciliación bancaria.

**Criterios de aceptación**
1. Dado un pedido con anticipo, entonces el saldo pendiente es el total menos la suma de cobros, calculado y no almacenado.
2. Dado un cobro que excede el saldo pendiente, entonces se advierte pero se permite, y el saldo queda negativo visible.
3. Dado un cobro registrado por error, entonces se anula con un movimiento inverso y ambos quedan en la bitácora.
4. Un registro de pago no puede apuntar a la vez a un pedido y a un egreso; la base de datos lo impide.
5. Un cobro siempre tiene dirección `in` y un pago siempre `out`; la restricción lo garantiza.
6. Dado un ayudante, entonces puede registrar cobros de pedidos pero no pagos de egresos.
7. El estado de pago mostrado en el tablero se deriva de los cobros, no de un campo editable.

**Pruebas requeridas**
- Unitarias: cálculo de saldo, casos límite de sobrepago.
- pgTAP: `exactly_one_target`, `direction_matches_target`, permisos por rol.
- e2e: anticipo y saldo en un pedido completo.

---

## KAM-11 · Infraestructura sin conexión

**Objetivo:** que registrar nunca falle por falta de señal, y que nada se pierda ni se duplique al sincronizar.

**Alcance**
- Service worker con Serwist; la aplicación instalable y utilizable sin red.
- Cola outbox en Dexie: encolar, reintentar con espera creciente, ordenar padre antes que hijo.
- Identificadores `uuid` generados en el cliente para todo registro nuevo.
- `occurred_at` fijado por el cliente; `created_at` por el servidor.
- Indicador persistente con el número de registros pendientes de sincronizar.
- Resolución de conflictos: última escritura gana, con constancia en bitácora.

**Fuera de alcance**
- Lectura sin conexión de reportes y listados históricos: solo se garantiza la **captura**.
- Sincronización bidireccional o resolución manual de conflictos.

**Criterios de aceptación**
1. Dado un dispositivo sin red, cuando se registra un pedido, entonces se guarda localmente y la interfaz confirma sin error.
2. Dada la reconexión, entonces los registros se envían en orden padre → hijo y el indicador llega a cero.
3. Dado un envío que se reintenta dos veces por un fallo de red, entonces se crea **un solo** registro en la base de datos.
4. Dada una venta registrada a las 15:40 sin señal y sincronizada a las 21:00, entonces `occurred_at` es 15:40 y `created_at` es 21:00.
5. Dado el cierre de la aplicación con registros pendientes, entonces al reabrirla siguen en la cola y se envían.
6. Dado un registro que falla de forma permanente, entonces se muestra al usuario con la opción de reintentar o descartar, nunca se pierde en silencio.

**Pruebas requeridas**
- Unitarias: cola, orden de envío, deduplicación por uuid, espera creciente.
- e2e: `fair-offline.spec.ts` en su parte de infraestructura, con la red desconectada desde Playwright.

---

## KAM-12 · Modo feria y venta rápida

**Objetivo:** vender en un puesto de feria en menos de 15 segundos por venta, con o sin señal. Es la pantalla que decide si el sistema se usa.

**Alcance**
- `orders` con `kind = 'direct_sale'`, creada directamente en un estado de tipo `final`.
- Grupo de rutas `(fair)` con layout propio, **sin barra superior ni inferior**.
- V6: cuadrícula de productos más vendidos, carrito, barra inferior fija, hoja de cobro.
- Cliente opcional; canal y línea preseleccionados.
- Retorno inmediato a la cuadrícula tras cada venta.
- Indicador de ventas pendientes de sincronizar.

**Fuera de alcance**
- Descuentos, impuestos, cliente obligatorio, búsqueda avanzada.
- Cierre de feria con resumen del evento (Fase 6).
- Impresión de comprobantes.

**Criterios de aceptación**
1. Dado el modo feria activo, entonces no existe ningún elemento de navegación tocable salvo el control explícito de salida.
2. Dada una venta de dos productos, entonces se completa en 4 interacciones o menos: producto, producto, Cobrar, Confirmar.
3. Dada una venta confirmada, entonces la pantalla vuelve a la cuadrícula en menos de un segundo, sin pantallas intermedias.
4. Dada la red desconectada, entonces se pueden registrar al menos 20 ventas seguidas sin degradación perceptible.
5. Dada la reconexión tras esas ventas, entonces existen exactamente 20 registros, con sus horas reales y ninguno duplicado.
6. Una venta directa no aparece en el tablero de pedidos: no tiene ciclo de producción.
7. Los ingresos de ventas directas se suman a los del mismo modo que los de pedidos en cualquier consulta de ingresos.

**Pruebas requeridas**
- e2e: `fair-offline.spec.ts` completo. **Es la prueba crítica del proyecto.**
- Integración: ingresos totales de la línea incluyen pedidos y ventas directas.

---

## KAM-13 · Registro rápido y navegación móvil

**Objetivo:** que el celular sea una herramienta de captura de verdad, no una versión reducida del escritorio.

**Alcance**
- V16 como pantalla de inicio en móvil: seis botones grandes.
- Barra de navegación inferior: Inicio, Pedidos, Tareas, Más.
- Lista "Registrado hoy" con los últimos cinco registros.
- Adaptaciones móviles de las vistas ya construidas: pedidos como lista, egresos como tarjetas, formularios a pantalla completa.
- Botón *+ Registrar* accesible desde cualquier pantalla.

**Fuera de alcance**
- Aplicación nativa o publicación en tiendas.
- Notificaciones push (KAM-17 cubre correo y avisos dentro de la aplicación).

**Criterios de aceptación**
1. Dado un usuario en móvil, cuando inicia sesión, entonces aterriza en `/quick`, no en el panel.
2. Dado cualquier pantalla de la aplicación, entonces registrar un gasto está a 2 toques o menos.
3. Dados los seis botones de registro rápido, entonces todos son alcanzables con el pulgar en una pantalla de 390 px.
4. Dado el tablero de pedidos en móvil, entonces se muestra como lista por defecto, con el kanban disponible como alternativa.
5. Dada la entrada "Tareas" en móvil, entonces abre *Mis pendientes*, no el tablero.
6. Ninguna vista requiere desplazamiento horizontal para completar su acción principal en 390 px.

**Pruebas requeridas**
- e2e con viewport móvil: recorrido de registro rápido de gasto y de pedido.

---

## KAM-14 · Panel principal y variante del ayudante

**Objetivo:** saber en cinco segundos cómo va el negocio, y que el ayudante vea una pantalla útil y completa, no una mutilada.

**Alcance**
- V2 para el dueño: indicadores del mes, comparativo por línea, entregas próximas, insumos bajo mínimo, últimos movimientos de bitácora.
- V2 para el ayudante: sin indicadores de dinero, sin comparativo, sin bitácora, con diseño reequilibrado.
- Botón flotante *+ Registrar* con su menú.
- Campana de notificaciones con contador, apuntando a la bandeja (que llega en KAM-17).

**Fuera de alcance**
- La tarjeta de pendientes queda como marcador de posición hasta KAM-17.
- Insumos bajo mínimo queda como marcador de posición hasta KAM-18.
- Reportes detallados (KAM-20).

**Criterios de aceptación**
1. Dado un dueño con la línea "Todas", entonces los indicadores suman las tres líneas y el comparativo las muestra por separado.
2. Dado un cambio de línea en el selector, entonces todos los indicadores se recalculan para esa línea.
3. Dado un ayudante, entonces no ve ningún monto en la pantalla ni puede obtenerlo por consulta directa.
4. La variante del ayudante no deja huecos ni secciones vacías: es un diseño propio, no el del dueño con piezas ocultas.
5. Ningún indicador se almacena: todos se derivan de las vistas.
6. La pantalla carga en menos de 1,5 segundos con 12 meses de datos sembrados.

**Pruebas requeridas**
- Integración: cifras del panel coinciden con el cálculo directo sobre datos sembrados.
- e2e: `assistant-permissions.spec.ts`.

---

# FASE 2 · Tareas

## KAM-15 · Tareas: modelo y tablero

**Objetivo:** que ningún pendiente viva fuera del sistema, sin que el tablero de tareas se convierta en un segundo tablero de pedidos.

**Alcance**
- Tabla `tasks`, `tags`, `task_tags`.
- V17: tablero con columnas resueltas dinámicamente, arrastre en ambos sentidos, filtros, vistas lista y calendario.
- Alta rápida de tarea: título y línea bastan.
- Asignación de responsable, fecha límite y etiquetas.
- Acción *Crear tarea para este pedido* desde V4, con formulario prellenado.

**Fuera de alcance**
- Descripción Markdown y adjuntos (KAM-16).
- Vínculos y entregables (KAM-21).
- Horas estimadas, dependencias entre tareas, comentarios, Gantt.
- **Cualquier sincronización automática entre pedidos y tareas.**

**Criterios de aceptación**
1. Dada una tarea con título y línea, entonces se guarda; sin línea, no.
2. Dada una tarea en *En revisión*, entonces puede arrastrarse de vuelta a *Por hacer* sin advertencias ni efectos secundarios.
3. Dado un pedido, entonces **nunca** se crea una tarea automáticamente al cambiar su estado.
4. Dada la acción *Crear tarea para este pedido*, entonces el formulario llega con línea, vínculo al pedido y fecha sugerida anterior a la de entrega, y el usuario puede modificar todo.
5. Dado un ayudante, entonces ve solo las tareas de su línea o asignadas a él.
6. Dado el filtro de línea en "Todas", entonces cada tarjeta muestra el color de su línea.
7. Medición registrada en la prueba e2e: crear una tarea toma 3 interacciones o menos.

**Pruebas requeridas**
- Unitarias: validación mínima, prellenado desde pedido.
- pgTAP: visibilidad de tareas por rol y línea.
- e2e: alta rápida; mover hacia atrás; verificar que un cambio de estado de pedido no crea tareas.

---

## KAM-16 · Detalle de tarea, Markdown y adjuntos

**Objetivo:** que una tarea pueda contener todo el contexto de un trabajo —notas, listas de verificación, referencias visuales— sin necesidad de herramientas externas.

**Alcance**
- V18 completa, como página en escritorio y pantalla completa en móvil.
- Editor Markdown con barra de herramientas mínima y vista previa saneada con `rehype-sanitize`.
- Listas de verificación funcionales dentro del cuerpo.
- Tabla `attachments`, buckets de Storage y sus políticas.
- Subida por arrastre con compresión de imágenes y carga en segundo plano.
- Bloque de historial de la tarea, leído de la bitácora.

**Fuera de alcance**
- Vínculos y entregables (KAM-21).
- Edición colaborativa simultánea, comentarios, menciones.
- Previsualización de PDF dentro de la aplicación.

**Criterios de aceptación**
1. Dado un usuario que no conoce Markdown, entonces puede aplicar negrita, listas y listas de verificación desde la barra de herramientas.
2. Dado un cuerpo con `- [ ]`, entonces la vista previa muestra casillas marcables y el estado se guarda.
3. Dado un contenido con etiquetas HTML peligrosas, entonces se sanean y no se ejecutan.
4. Dada una imagen de 10 MB arrastrada, entonces se comprime, se sube en segundo plano y el resto de la tarea sigue editable mientras tanto.
5. Dado un adjunto, entonces solo es accesible para usuarios autenticados de la organización dueña, verificado intentando el acceso desde otra organización.
6. Dada una tarea con 15 adjuntos, entonces se impide agregar más allá del límite configurado, con mensaje claro.
7. El historial de la tarea lee de `activity_log`; no existe una segunda tabla de historial.

**Pruebas requeridas**
- Unitarias: saneado de Markdown, compresión, límites.
- Integración: políticas de Storage entre organizaciones.
- e2e: editar cuerpo, marcar casillas, adjuntar imagen.

---

## KAM-17 · Mis pendientes, recordatorios y avisos

**Objetivo:** que lo urgente aparezca solo, sin que el sistema se vuelva una fuente de ruido que termine silenciada.

**Alcance**
- V20: cuatro grupos con contador, acciones rápidas, deslizar para posponer.
- Tabla `notifications` y V21: bandeja agrupada por tipo.
- Trabajo programado del resumen diario a la hora configurada por el usuario.
- Avisos: vencimiento próximo, vencida, asignación, revisión, tarea estancada, insumo bajo mínimo.
- Preferencias de notificación en V15, con cada tipo apagable por separado.
- Correo transaccional para lo vencido y lo asignado.

**Fuera de alcance**
- Notificaciones push al celular.
- Sonidos, insignias animadas, gamificación.
- Recordatorios sobre pedidos; en esta fase solo tareas e inventario.

**Criterios de aceptación**
1. Dadas cinco tareas que vencen hoy, entonces se envía **un solo** aviso de resumen, no cinco.
2. Dado un tipo de aviso desactivado, entonces no se genera ni se envía, y ningún otro tipo se ve afectado.
3. Dada una tarea vencida, entonces aparece en el grupo Vencidas de V20 y en el panel, ordenada primero.
4. Dado el deslizamiento de una fila, entonces puede posponerse a mañana en un solo gesto.
5. Dado un correo de aviso de tarea asignada, entonces su enlace abre exactamente esa tarea, no una pantalla genérica.
6. Dado un usuario sin sesión que abre ese enlace, entonces inicia sesión y es llevado a la tarea.
7. Dada una tarea sin fecha límite, entonces nunca genera avisos de vencimiento.
8. La bitácora no genera notificaciones en ningún caso.

**Pruebas requeridas**
- Unitarias: agrupación del resumen, respeto de preferencias, cálculo de grupos.
- Integración: trabajo programado con datos sembrados.
- e2e: posponer, marcar hecha, abrir desde enlace externo.

---

# FASE 3 · Control y análisis

## KAM-18 · Inventario suave

**Objetivo:** saber qué se está acabando, sin exigir una disciplina de registro que nadie va a sostener.

**Alcance**
- Tabla `inventory_movements` y vista `item_balances`.
- Entradas automáticas desde líneas de compra, con el índice de idempotencia.
- Registro rápido de consumo desde pedido, tarea o ítem.
- Ajuste por conteo físico, sin exigir justificación.
- Nivel mínimo por insumo y alerta en panel y catálogo.
- Secciones de saldo, movimientos y evolución de precios en V11.

**Fuera de alcance**
- Recetas de producto y descuento automático al producir (Fase 5).
- Merma como concepto propio; por ahora se anota como consumo.
- Valoración de inventario, costo promedio ponderado, punto de reorden automático.

**Criterios de aceptación**
1. Dada una compra registrada, entonces cada línea genera exactamente una entrada de inventario.
2. Dada esa misma compra sincronizada dos veces, entonces sigue existiendo **una sola** entrada.
3. Dado un consumo registrado, entonces el saldo baja y la operación toma 3 interacciones o menos.
4. Dado un ajuste por conteo, entonces el saldo pasa al valor contado y queda registrado quién lo hizo, sin pedir explicación.
5. Dado un saldo que cruza el mínimo, entonces el insumo aparece en la alerta del panel y en el catálogo.
6. El saldo nunca se almacena: se deriva de los movimientos y coincide con la suma manual en la prueba.
7. Los movimientos no se editan ni se archivan; una corrección es siempre un ajuste nuevo.

**Pruebas requeridas**
- pgTAP: `inventory_idempotency`, `derived_values`, imposibilidad de editar movimientos.
- e2e: compra → consumo → ajuste, verificando el saldo en cada paso.

---

## KAM-19 · Activos y recuperación de inversión

**Objetivo:** responder de un vistazo si la impresora 3D y el horno ya se pagaron solos.

**Alcance**
- Tabla `asset_details` y vista `asset_recovery`.
- V12: tarjetas con barra de progreso, costo, fecha, línea y gastos de mantenimiento asociados.
- Alta de activo desde el catálogo o desde el registro de una compra.
- Vinculación de gastos de mantenimiento a un activo.

**Fuera de alcance**
- Depreciación contable, valor residual, tablas de amortización.
- Programación de mantenimiento preventivo; una tarea con fecha basta.

**Criterios de aceptación**
1. Dado un activo con costo y fecha, entonces su barra muestra el margen acumulado de su línea desde esa fecha frente al costo.
2. Dado un activo cuya línea aún no genera margen, entonces la barra muestra 0 % sin errores ni divisiones por cero.
3. Dado un activo ya recuperado, entonces la barra se ve completa y se indica de forma sobria.
4. Dado un gasto de mantenimiento vinculado, entonces suma al costo total del activo y la barra se recalcula.
5. Dado un ayudante, entonces `/assets` no aparece en su menú y no puede leer `asset_details`.
6. La fórmula de recuperación vive en un solo lugar del código.

**Pruebas requeridas**
- Unitarias: fórmula de recuperación, casos límite.
- pgTAP: acceso a `asset_details` por rol.
- e2e: alta de activo y verificación de la barra tras registrar ventas.

---

## KAM-20 · Reportes

**Objetivo:** responder las siete preguntas de negocio sin cálculos aparte y sin abrir una hoja de cálculo.

**Alcance**
- V14 con cinco informes: rentabilidad, en qué se va el dinero, qué se vende más, insumos por acabarse, comparativo entre líneas.
- Selector de periodo con atajos y selector de línea.
- Reparto de gastos de la línea General, con la regla configurable y **visible junto al resultado**.
- Exportación a hoja de cálculo de cualquier informe filtrado.
- Cada fila abre su registro de origen.

**Fuera de alcance**
- Costeo por receta; el costo de materiales se toma de los consumos registrados y los gastos asignados.
- Proyecciones, metas, tableros configurables, métricas inventadas.

**Criterios de aceptación**
1. Dado un periodo, entonces todos los informes usan exactamente el mismo rango y las cifras cuadran entre ellos.
2. Dado el informe comparativo, entonces muestra las tres líneas con ingresos, egresos y margen, incluida Alfarería.
3. Dados gastos en la línea General, entonces se reparten según la regla configurada y la regla aparece escrita junto al resultado.
4. Dado el ranking de más vendidos, entonces puede ordenarse por unidades y por margen, y se distingue el producto que vende mucho pero deja poco.
5. Dada una fila de cualquier informe, entonces al abrirla lleva al pedido, ítem o egreso correspondiente.
6. Dado un ayudante, entonces `/reports` no aparece en su menú ni responde por dirección directa.
7. Las cifras de cada informe coinciden con el cálculo directo sobre datos sembrados, verificado en prueba de integración.
8. Un informe de 12 meses de datos responde en menos de 3 segundos.

**Pruebas requeridas**
- Integración: comparación de cada informe contra cálculo manual con semilla conocida.
- e2e: cambio de periodo y de línea; exportación; acceso denegado al ayudante.

---

# FASE 4 · Conexión y auditoría

## KAM-21 · Vínculos y entregables de tareas

**Objetivo:** que cerrar una tarea deje registros reales en el sistema, para que el trabajo hecho no quede solo como texto.

**Alcance**
- Tablas `task_links` y `task_deliverables`.
- Buscador único de vínculos que resuelve pedidos, contactos, ítems, egresos y activos.
- Bloques "Tareas relacionadas" en V4, V11, V12 y V13.
- V19: asistente de cierre con entregables múltiples, formularios prellenados y casillas de inclusión.
- Marca discreta de *cerrada sin entregables*.

**Fuera de alcance**
- Plantillas de tarea y tareas recurrentes.
- Entregables encadenados o condicionales.
- Justificación obligatoria al cerrar sin crear nada.

**Criterios de aceptación**
1. Dado un vínculo a un pedido, entonces la tarea muestra el estado **actual** del pedido, no una copia del momento del vínculo.
2. Dado un pedido con tareas vinculadas, entonces las muestra en su bloque de relacionadas con su estado.
3. Dada una tarea con dos entregables declarados, entonces el asistente ofrece ambos formularios prellenados con título, línea, adjuntos y notas de la tarea.
4. Dada la opción *Cerrar sin crear nada*, entonces la tarea se cierra sin bloqueos, sin advertencias y sin pedir justificación.
5. Dado un cierre sin entregables, entonces la tarea queda marcada de forma discreta y localizable por filtro.
6. Dado un entregable creado, entonces el registro resultante queda enlazado desde la tarea y visible en la bitácora como creación.
7. Dado un registro vinculado que se archiva, entonces se avisa qué tareas lo referencian y ninguna queda rota.

**Pruebas requeridas**
- Unitarias: prellenado de cada tipo de entregable.
- Integración: creación de los seis tipos desde el asistente.
- e2e: `task-deliverables.spec.ts` con las tres salidas posibles.

---

## KAM-22 · Bitácora: pantalla, filtros y retención

**Objetivo:** poder responder "qué cambió, quién y cuándo" en menos de dos minutos, sin salir del sistema.

**Alcance**
- V23: lista cronológica con redacción en lenguaje natural, filas expandibles con antes y después.
- Filtros por fecha, línea, usuario, tipo de registro, tipo de acción y búsqueda por identificador.
- Historial contextual en V4, V11, V13 y V18, leyendo de la misma fuente.
- Exportación del resultado filtrado.
- Política de retención de 12 meses en V15, con exportación automática previa a cualquier purga.
- Desarchivado desde el evento correspondiente.

**Fuera de alcance**
- Reversión de cambios individuales; recuperar es desarchivar.
- Registros técnicos de fallas del sistema.
- Notificaciones derivadas de la bitácora.

**Criterios de aceptación**
1. Dado cualquier evento, entonces se lee en lenguaje natural, sin nombres de columna ni jerga técnica.
2. Dada una fila expandida, entonces muestra antes y después resaltando solo los campos que cambiaron.
3. Dado un ayudante, entonces `/activity` no aparece ni responde, pero sí ve el historial dentro de los registros que puede abrir.
4. Dado el historial de un pedido, entonces sus eventos coinciden exactamente con los de la bitácora general filtrada por ese pedido.
5. Dado un evento de archivado, entonces permite desarchivar el registro, y el desarchivado queda registrado a su vez.
6. Dada la purga de eventos de más de 12 meses, entonces primero se genera y verifica la exportación, y solo entonces se vacía el detalle.
7. Dada una bitácora con 100.000 eventos, entonces la pantalla filtrada responde en menos de 2 segundos y nunca carga todo.

**Pruebas requeridas**
- Integración: coincidencia entre historial contextual y bitácora filtrada; trabajo de retención con exportación previa.
- e2e: filtrar, expandir, desarchivar.

---

## KAM-23 · Endurecimiento y puesta en producción

**Objetivo:** que el sistema esté listo para que el negocio dependa de él todos los días, incluido el día que algo falle.

**Alcance**
- Suite e2e completa de los siete recorridos de ARCHITECTURE.md.
- Auditoría de accesibilidad básica: contraste, foco visible, navegación por teclado, etiquetas.
- Rendimiento: presupuesto de carga en móvil de gama media, imágenes optimizadas, listas paginadas.
- Estados vacío, cargando y error diseñados y aplicados en toda vista con datos.
- Copias de seguridad automáticas con al menos una fuera del sistema, y **restauración probada**.
- Exportación completa de todos los datos a hoja de cálculo.
- Despliegue, variables de entorno, dominio y monitoreo de errores.
- Verificación final de la lista de comprobación del anexo de base de datos.

**Fuera de alcance**
- Optimizaciones de escala que este negocio no necesita.
- Panel de métricas de la aplicación.

**Criterios de aceptación**
1. Los siete recorridos e2e pasan en CI de forma estable, sin pruebas intermitentes.
2. Toda vista con datos tiene sus tres estados diseñados; "sin resultados tras filtrar" se distingue de "vacío inicial" y ofrece quitar filtros.
3. Ninguna vista de la aplicación declara una vista SQL sin `security_invoker`, verificado por prueba automática.
4. La restauración de una copia de seguridad se ejecuta en un entorno limpio y el sistema queda operativo, con el resultado documentado.
5. La exportación completa produce un archivo con todas las tablas, bitácora incluida.
6. La auditoría de accesibilidad no reporta fallos críticos.
7. El panel principal carga en menos de 2 segundos en un dispositivo móvil de gama media con 12 meses de datos.
8. La lista de comprobación completa del anexo de base de datos está verificada punto por punto.

**Pruebas requeridas**
- Toda la suite, más la prueba automática de `security_invoker` sobre el catálogo de vistas.

---

## Notas sobre el orden

**KAM-03 no se mueve.** La bitácora debe registrar antes de que exista un solo dato real; lo que no se registró el primer mes se perdió para siempre.

**KAM-11 y KAM-12 van juntas o no van.** El modo feria sin la infraestructura sin conexión es una pantalla bonita que pierde ventas.

**Fases 2 y 3 son intercambiables**, como quedó anotado en la especificación: si tu urgencia es saber cuánto ganas, KAM-18 a KAM-20 pueden adelantarse a KAM-15. Lo único prohibido es construir ambas a la vez.

**Fases 5 y 6 no están en este backlog** —recetas, lotes con merma, cotizaciones, seguimiento público, conexión con plataformas externas— porque no deben construirse hasta que las Fases 0 a 4 estén en uso real. Se escribirán como tareas nuevas cuando llegue el momento, siguiendo este mismo formato.

---

*Backlog derivado de la especificación funcional v6.0. Toda tarea se ejecuta como un cambio de OpenSpec; ninguna se implementa directamente desde este documento.*
