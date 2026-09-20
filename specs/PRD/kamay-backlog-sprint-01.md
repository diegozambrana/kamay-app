# Kamay — Backlog del Sprint 1 · Revisión de la plataforma

> Deriva de: `kamay-backlog.md` (Fases 0–4, completado) · especificación funcional v6.0 · esquema de base de datos · mapa de navegación · ARCHITECTURE.md
> **Origen de las tareas:** observaciones recogidas usando la plataforma ya construida, no una fase planificada de antemano.
> Estado: **abierto** · tareas comprometidas: 7 · observaciones en bandeja: 0

---

## Punto de partida

Las Fases 0 a 4 del backlog original están terminadas y archivadas (KAM-01 a KAM-23), más los cambios posteriores que ya nacieron de usar el sistema:

| Cambio | Qué agregó |
| --- | --- |
| KAM-24 | Menú de cuenta y perfil |
| KAM-25 | La raíz redirige según la sesión |
| KAM-26 | Administrador de la plataforma (super admin) |
| `settings-dialogs-and-tables` | Configuración con diálogos, tablas con menú «⋯» y menú lateral |
| `catalog-fields-by-kind` | Campos del catálogo según el tipo de ítem |
| `item-categories` | Categorías de ítems definidas por la organización |
| `order-form-picker-dialogs` | Elegir productos y cliente en diálogos |
| `navigation-breadcrumbs-and-all-lines-board` | Migas de pan, destinos tras guardar, tablero con «Todas» |

**Este sprint continúa esa línea:** cada tarea sale de una observación concreta al usar la plataforma, no de una lista escrita antes de tocarla.

---

## Cómo usar este backlog

**Dos niveles, y no se saltan.** Primero la observación cruda entra en la **bandeja** (`OBS-NN`): lo que se vio, dónde, y por qué molesta. Solo cuando una observación —o un grupo de ellas— tiene alcance cerrado se promueve a **tarea** (`KAM-NN`, continuando la numeración desde KAM-27). Una observación sin promover no se implementa.

**Una tarea = un cambio de OpenSpec.** Cada tarea de este documento se convierte en `openspec/changes/<slug>/` con su propuesta, su diseño, su delta spec y sus tareas ejecutables. Nada se implementa sin ese paso previo.

**Tamaño deliberado:** las tareas agrupan observaciones relacionadas —de medio día a tres días de trabajo asistido— porque abrir un cambio de OpenSpec por cada detalle suelto obliga a repetir el contexto una y otra vez. Cada tarea entrega **algo utilizable**.

**La sección "Fuera de alcance" no es decorativa.** Es el mecanismo concreto que impide que un asistente agregue funcionalidad que nadie pidió. Debe copiarse literalmente al `proposal.md` del cambio.

**Regla de secuencia:** no se empieza una tarea con la anterior a medio terminar.

**Regla de capacidad:** la bandeja puede crecer sin límite; el sprint no. Las tareas que no entren se quedan en `Candidatos` para el siguiente.

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
- [ ] Si cambió comportamiento ya especificado: la delta spec marca el escenario reemplazado como **BREAKING**, no se agrega uno nuevo en paralelo.
- [ ] No se introdujo ningún concepto ausente del modelo conceptual de la especificación.
- [ ] Ningún valor derivado quedó almacenado en una columna o en un store.
- [ ] La observación que originó la tarea quedó marcada como resuelta en la bandeja.
- [ ] El cambio de OpenSpec quedó archivado.

---

## Objetivo del sprint

> _Pendiente de escribir._ Se redacta cuando la bandeja tenga suficientes observaciones para ver el patrón: una frase que diga qué debería dejar de doler al terminar el sprint.

---

## Resumen de tareas comprometidas

| ID | Tarea | Origen (OBS) | Depende de | Vistas | Estado |
| --- | --- | --- | --- | --- | --- |
| KAM-27 | Registro de herramientas y catálogo por organización | exploración 2026-09-19 | — | V15 (sección nueva), V4, `/extensions/<slug>` | archivada |
| KAM-28 | Solicitudes de pedido por enlace público | exploración 2026-09-19 | — | nueva bandeja, nueva pública `/r/<token>`, V5, V15 | propuesta |
| KAM-29 | Tareas: detalle y edición separados | exploración 2026-09-19 | — | V18 (pasa a dos pantallas), V17, V20 | propuesta |
| KAM-30 | Asistencia de redacción en la descripción de la tarea | exploración 2026-09-19 | 29 | V18, V15 | propuesta |
| KAM-31 | Atributos de catálogo por organización y disponibilidad por variante | exploración 2026-09-19 | — | V10, V11, V15 | propuesta |
| KAM-32 | Enlace público del pedido, de solo lectura y con comentarios | exploración 2026-09-19 | comparte infraestructura con 28 | V4, nueva pública `/p/<token>`, V15 | propuesta |
| KAM-33 | Tablero de tareas con «Todas» las líneas | exploración 2026-09-19 | — | V17 | propuesta |

Estados posibles: `propuesta` · `en cambio de OpenSpec` · `en implementación` · `archivada`.

---

## Bandeja de observaciones

Se anota tal como se vio, sin proponer solución todavía. La columna **Destino** queda vacía hasta que se decide: `KAM-NN` si se promueve, `candidato` si se posterga, `descartada` con el motivo si no procede.

| ID | Fecha | Pantalla / ruta | Qué pasó | Por qué molesta | Severidad | Destino |
| --- | --- | --- | --- | --- | --- | --- |
| _—_ | | | | | | |

**Severidad**
- `bloquea` — impide completar una operación real del negocio.
- `fricción` — se puede completar, pero cuesta más pasos o más atención de lo razonable.
- `confuso` — el sistema no dice lo que hace o lo dice mal.
- `pulido` — no afecta el trabajo; se arregla si hay espacio.

---

# Tareas

> Cada tarea se escribe con esta plantilla. Se copia el bloque completo y se reemplaza; no se implementa nada mientras queden campos por definir.

<!-- PLANTILLA — copiar debajo de esta línea al promover una observación

## KAM-NN · Título en una línea

**Origen:** OBS-01, OBS-04
**Slug del cambio:** `kebab-case-descriptivo`

**Objetivo:** una frase que diga qué deja de doler, en términos del negocio, no de la implementación.

**Alcance**
- …

**Fuera de alcance**
- …

**Criterios de aceptación**
1. Dado …, cuando …, entonces ….

**Pruebas requeridas**
- Unitarias: …
- pgTAP: …
- e2e: …

FIN DE LA PLANTILLA -->

## KAM-27 · Registro de herramientas y catálogo por organización

**Origen:** exploración «Herramientas por tenant» del 2026-09-19 (idea del dueño, no de la bandeja).
**Slug del cambio:** `tenant-tools-registry`

**Objetivo:** que una organización pueda activar herramientas que el núcleo no trae —empezando por la calculadora de costo de impresión 3D— sin que ninguna pueda afectar cómo funciona la plataforma, y que agregar la segunda herramienta cueste una fracción de lo que cuesta la primera.

**Prerrequisito (convención nº 11).** El concepto no puede construirse antes de estar escrito en `kamay-especificacion-producto-v6.md`. La especificación ya nombra «módulos activables» en V15 y «módulos por línea» en la Fase 6, pero con otro significado: apagar partes del núcleo. Antes de abrir el cambio de OpenSpec hay que decidir por escrito si son el mismo concepto o dos, y dejar la definición única en §6.1.

**Alcance**
- Tabla `organization_tools`: `organization_id`, `slug`, `config jsonb`, `archived_at`. RLS **solo del dueño** —los parámetros pueden llevar tarifas y márgenes—, sin política `DELETE`, y trigger `log_activity()`. El ayudante solo conoce los slugs activos, por la función `active_tool_slugs`. Activación **por organización**, no por línea.
- Declararla en `lib/export/tables.ts` con sus columnas, para que la prueba del manifiesto de exportación siga en verde.
- **Registro en código** (`tools/`). Un manifiesto por herramienta: `slug`, nombre, descripción para el catálogo, **tres esquemas Zod (parámetros, entradas y salidas)**, puntos de enganche, rol mínimo, **capacidades declaradas** (si sale a internet, si guarda credenciales, qué produce) y **tablas relacionadas** (las que lee y aquellas sobre las que escribe, nombrando la Server Action). Cada herramienta trae su `README.md`, sus pruebas y sus casos de referencia; una prueba de contrato lo verifica sobre todo el registro. El catálogo lee del registro; nada se resuelve en tiempo de ejecución desde datos.
- **Catálogo** como sección nueva de `/settings` (`SETTINGS_SECTIONS`, grupo Organización, `ownerOnly`): lista de herramientas disponibles, detalle con lo que hace y sus capacidades en lenguaje llano, botón para agregar y para desactivar.
- **Formulario de parámetros** derivado del esquema Zod del manifiesto, con los valores del tenant.
- **Dos puntos de enganche, lista cerrada:** (a) página propia en `/extensions/<slug>`, con su entrada en una sección «Herramientas» del sidebar; (b) acción en el detalle de pedido (V4).
- `NAV_ENTRIES` pasa a admitir entradas resueltas por organización, además del filtrado por rol que ya hace.
- **Primera herramienta: calculadora de costo de impresión 3D**, portada de la hoja de cálculo del taller. Entradas por placa: gramos de filamento, minutos de impresión, unidades por placa, colores, armados e insumos extra por unidad. Parámetros del tenant: precio del filamento por kilo, costo por hora de máquina, recargo por color, costo de armado, lista de insumos extra, fondo de fallos, **curva de margen** (anclas costo → margen con interpolación lineal; por defecto 10 → 250 %, 50 → 175 %, 70 → 157 %, 80 → 150 %; una curva que haga bajar el precio al subir el costo se rechaza), proporción por mayor, descuento por docena y redondeo. Salidas: desglose del costo, margen aplicado, precio unitario, por mayor, por docena y de la placa. Solo dueño. Desde el detalle de pedido agrega una línea libre con la acción nueva del núcleo `addOrderLine` (no existía una que añadiera una sola línea: `updateOrder` reemplaza la lista completa).
- **Frontera de aislamiento verificada:** ningún archivo de herramientas importa un cliente de Supabase ni ejecuta SQL; toda escritura pasa por las Server Actions existentes, con la sesión del usuario, su rol, su RLS y su bitácora.

**Fuera de alcance**
- Manifiestos declarativos interpretados en tiempo de ejecución, motores de fórmulas configurables y carga de código de terceros. **Una herramienta es código de este repositorio y entra por PR.**
- Tablas propias de una herramienta. Todo lo que produce aterriza en un concepto que Kamay ya tiene.
- Herramientas que salen a internet, credenciales por organización y estado en sistemas externos (candidatos: *Herramientas con servicios de terceros* y *Puerta de conexión con otras plataformas*).
- Curaduría: el catálogo es **igual para todas** las organizaciones; el administrador de la plataforma no habilita ni deshabilita herramientas por tenant.
- Activación por línea de negocio y parámetros por línea.
- Cobro, planes o cuotas por herramienta.
- Cualquier punto de enganche distinto de los dos declarados: nada en panel, catálogo, tareas ni egresos.

**Criterios de aceptación**
1. Dada una organización sin herramientas activas, cuando el dueño abre el catálogo, entonces ve la calculadora con su descripción y sus capacidades declaradas, y el sidebar **no** muestra ninguna sección «Herramientas».
2. Dada la calculadora activada, entonces la sección «Herramientas» aparece en el sidebar con su entrada y `/extensions/print-cost-3d` responde.
3. Dada una herramienta desactivada, entonces su entrada desaparece del sidebar, su página responde «no encontrada», y **sus parámetros se conservan**: al reactivarla vuelven intactos.
4. Dado un ayudante, entonces el catálogo no aparece en su menú de configuración y la dirección directa lo redirige; puede usar una herramienta activa solo si su manifiesto declara el rol `assistant`.
5. Dada la organización A con la calculadora activa y la organización B sin ella, cuando un usuario de B pide `/extensions/print-cost-3d`, entonces obtiene «no encontrada» y cero filas de configuración de A.
6. Dado un pedido con la calculadora activa, cuando el usuario la abre desde el detalle y confirma, entonces la línea se agrega por la acción de pedidos existente y la bitácora la registra como creación.
7. Dada una herramienta activa cuyo manifiesto ya no está en el registro, entonces no se ofrece en el catálogo ni en el sidebar y ninguna pantalla falla.
8. Ningún archivo del directorio de herramientas importa un cliente de Supabase, `lib/supabase/admin` ni ejecuta SQL, verificado por prueba automática sobre el árbol de importaciones.
9. Ningún resultado de la calculadora se almacena: costo y precios se calculan en cada uso (convención nº 4). Lo único persistente son sus parámetros.
10. La activación, la desactivación y cada cambio de parámetros quedan en `activity_log`.
11. `organization_tools` está declarada en `lib/export/tables.ts` y `tests/integration/export-manifest.test.ts` pasa.

**Pruebas requeridas**
- Unitarias: fórmula de la calculadora y sus casos límite (cero gramos, cero horas, parámetros sin configurar); resolución del registro (activas por organización, manifiesto ausente); formulario generado desde el esquema Zod; `navEntriesFor` con la sección «Herramientas».
- Frontera: prueba de importaciones al estilo de `services/notifications/service-role-boundary.test.ts`.
- pgTAP: RLS de `organization_tools` —aislamiento entre organizaciones, ausencia de `DELETE`, lectura por rol— y el trigger de bitácora.
- Integración: manifiesto de exportación; recorrido activar → configurar → usar → desactivar → reactivar conservando parámetros.
- e2e: activar la calculadora, configurar sus parámetros, abrirla desde su página y desde un pedido agregando la línea; catálogo denegado al ayudante.

**Criterio → prueba que lo verifica** (repaso de cierre, 2026-09-20)

| # | Prueba |
| --- | --- |
| 1 | `tests/e2e/tools.spec.ts` (catálogo sin activas, sin sección en el menú) · `features/tools/tools-catalog.test.tsx` · `components/layout/app-sidebar.test.tsx` |
| 2 | `tests/e2e/tools.spec.ts` · `components/layout/nav-entries.test.ts` · `tools/resolve.test.ts` |
| 3 | `tests/e2e/tools.spec.ts` (desactivar → «no encontrada» → reactivar conserva) · `tests/integration/tools-lifecycle.test.ts` · `supabase/tests/organization_tools.test.sql` |
| 4 | `tests/e2e/tools.spec.ts` (ayudante) · `features/settings/settings-nav.test.tsx` · `tools/resolve.test.ts` (manifiesto de prueba con rol `assistant`) |
| 5 | `supabase/tests/organization_tools.test.sql` · `tests/integration/tools-lifecycle.test.ts` («dos organizaciones no se ven») |
| 6 | `tests/e2e/tools.spec.ts` (línea desde el pedido) · `tests/integration/add-order-line.test.ts` (bitácora: `created`) · `actions/orders.test.ts` · `tools/print-cost-3d/ui/order-action.test.tsx` |
| 7 | `tools/resolve.test.ts` · `tests/integration/tools-lifecycle.test.ts` («herramienta retirada») · `features/tools/tools-catalog.test.tsx` |
| 8 | `tools/boundary.test.ts` (y `tools/contract.test.ts`: acciones usadas = acciones declaradas) |
| 9 | `tools/print-cost-3d/ui/page.test.tsx` («un cálculo no deja rastro», «salir y volver») · `order-action.test.tsx` (la línea no lleva costo ni margen) |
| 10 | `supabase/tests/organization_tools.test.sql` · `tests/integration/tools-lifecycle.test.ts` (`created`, `updated`, `archived`, `unarchived`) |
| 11 | `tests/integration/export-manifest.test.ts` · `tests/integration/export.test.ts` (el ayudante no recibe `herramientas.csv`) |

---

## KAM-28 · Solicitudes de pedido por enlace público

**Origen:** exploración «Recepción de pedidos por enlace» del 2026-09-19 (idea del dueño, no de la bandeja).
**Slug del cambio:** `public-order-intake`

**Objetivo:** que un cliente pueda mandar los detalles de su pedido por sí mismo desde un enlace, sin que eso abra una puerta a los datos de la organización ni ensucie el tablero con todo lo que llegue sin revisar.

**Prerrequisito (convención nº 11).** «Solicitud de pedido» es un concepto nuevo y tiene que quedar definido en §6.1 de `kamay-especificacion-producto-v6.md` antes de construirse, con su frontera escrita: **una solicitud no es un pedido**. La Fase 6 de la especificación ya contempla el seguimiento público del pedido y las cotizaciones; esto es vecino de ambos y no es ninguno de los dos.

**Por qué no puede ser un pedido.** `orders` tiene la restricción `order_needs_customer` (`kind <> 'order' or contact_id is not null`), y quien llena el formulario todavía no es un contacto. El criterio 2 de KAM-08 además impide guardar un pedido sin cliente y sin líneas. Un envío público no puede ser una fila de `orders`, y no debería: la revisión humana es el filtro contra el abuso.

**Solo enlaces dirigidos.** El enlace lo genera siempre una persona de la organización para un cliente concreto, y sirve una sola vez. No existe un enlace abierto que se publique en redes. Eso tiene dos consecuencias que dan forma al resto: **el token es la puerta**, así que no hace falta captcha —y por eso no está en el alcance—, y **la solicitud existe antes de que el cliente abra el enlace**, lo que permite que las imágenes se suban a una carpeta que ya tiene dueño.

**Alcance**
- Tabla `order_requests`, **una sola tabla**: organización, línea, `token_hash bytea` (sha256; el token en claro nunca se guarda, igual que `invitations`), prellenado de nombre y teléfono, lo que declara el cliente (nombre, teléfono, nota), `expires_at`, `submitted_at`, el pedido resultante si se aceptó, y `archived_at`. RLS con el patrón de siempre, sin política `DELETE`, con trigger `log_activity()`.
- Estados derivados de esas marcas, nunca almacenados (convención nº 4): *esperando al cliente* → *recibida* → *aceptada* o *descartada*.
- Función `security definer` concedida a `anon` que resuelve el token y devuelve **solo** lo que la página pública necesita: nombre de la organización, línea y prellenado. Nunca la solicitud completa ni nada de otra organización.
- **Ninguna política nueva para `anon` sobre tablas.** Hoy no existe ninguna en todo el esquema y esa propiedad se conserva y se verifica.
- Grupo de rutas público con layout propio sin navegación, al estilo de `(fair)`: `/r/<token>`, fuera del bloqueo de sesión del middleware como ya lo está `app/auth/invite/[token]`.
- Formulario del cliente: nombre, teléfono, nota e imágenes de referencia. **Sin productos, sin líneas, sin cantidades ni precios.**
- **Subida de imágenes sin sesión, con cuarentena.** Bucket privado nuevo `order-requests`, con límite de tamaño y de tipos en su configuración. Ruta `<organization_id>/<request_id>/<archivo>`, que conserva la convención del esquema y mantiene ambas políticas simples: `insert` para `anon` solo cuando una función `security definer` confirma que esa solicitud está esperando al cliente y no ha vencido; `select` para miembros de la organización con el mismo `is_member((storage.foldername(name))[1]::uuid)` que ya usan los demás buckets. **Sin `update` y sin `delete` para `anon`:** no puede sobrescribir ni leer lo subido, ni enumerar nada. Tope de cantidad de imágenes por solicitud y compresión en el cliente, como en KAM-09 y KAM-16.
- **Bandeja de solicitudes** dentro de la aplicación: leer con sus imágenes, aceptar o descartar.
- **Aceptar** abre el alta de pedido prellenada, creando el contacto al vuelo; el pedido se crea por la acción que ya existe, con sus reglas intactas, y las imágenes pasan de la cuarentena a ser adjuntos del pedido en el bucket `attachments`.
- **Generar y enviar:** desde la aplicación se crea la solicitud con el teléfono prellenado y se abre WhatsApp con el mensaje y el enlace mediante `wa.me`, sin API ni credencial.
- Autor en la bitácora: `actor_label` = «Formulario público», sin `actor_id`. La columna ya existe.
- Aviso al dueño de solicitud recibida: tipo nuevo en `notifications`, apagable por separado como los demás (KAM-17).
- Declarar la tabla en `lib/export/tables.ts`, con `token_hash` en `EXCLUDED_COLUMNS` y su motivo escrito, igual que `invitations.token_hash`.

**Fuera de alcance**
- **Enlace abierto y público** que cualquiera pueda usar, y con él la validación de humano (captcha) y el límite de envíos por origen. Con enlaces de un solo uso generados por una persona, el captcha no protege de nada que el token no proteja ya.
- Que una solicitud se convierta en pedido automáticamente. **Siempre la acepta una persona.**
- Elegir productos, cantidades o precios desde el formulario público.
- Seguimiento público del estado del pedido y cotizaciones formales (Fase 6).
- Envío automatizado por WhatsApp Business API: el enlace se abre en el WhatsApp de quien lo manda.
- Cobro o anticipo desde el formulario.
- Que el cliente consulte, corrija o retire su solicitud después de enviarla.
- Cuenta, registro o sesión para el cliente.
- Recepción por correo, formulario embebido en un sitio ajeno o API de entrada.

**Criterios de aceptación**
1. Dada una solicitud generada con su enlace, cuando alguien sin sesión lo abre, entonces ve el formulario con el nombre de la organización, el teléfono ya relleno y corregible, y **nada más** de la organización: ni catálogo, ni precios, ni contactos, ni otras solicitudes.
2. Dado un envío con nombre, teléfono y nota, entonces la solicitud queda marcada como recibida y **no** se crea ningún pedido ni ningún contacto.
3. Dado un envío sin nombre o sin teléfono, entonces se impide con un mensaje claro que señala el campo.
4. Dado un token inválido, vencido, ya usado o de una solicitud archivada, entonces la página dice que el enlace no sirve **sin revelar si la organización existe**.
5. No existe ninguna política para `anon` sobre ninguna tabla, verificado por pgTAP sobre el catálogo de políticas.
6. Dado un usuario anónimo con un token válido, cuando sube una imagen, entonces solo puede escribir dentro de `<organization_id>/<request_id>/`; intentar leer lo subido, sobrescribirlo, o escribir en la carpeta de otra solicitud u otra organización falla.
7. Dada una solicitud ya recibida o vencida, entonces una subida a su carpeta falla.
8. Dada una solicitud recibida, entonces la bitácora la registra con `actor_label` «Formulario público» y `actor_id` nulo.
9. Dada una solicitud aceptada, entonces el alta de pedido llega prellenada con nombre, teléfono y nota, sus imágenes quedan como adjuntos del pedido, y el pedido se crea por la acción existente respetando sus reglas de siempre.
10. Dada una solicitud descartada, entonces se archiva, no se borra, y desaparece de la bandeja.
11. Dado un ayudante, entonces la bandeja se comporta según el rol que se decida y queda verificado por prueba, sin depender de que la pantalla lo oculte.
12. Ningún estado de la solicitud se almacena: se deriva de `submitted_at`, `expires_at`, el pedido resultante y `archived_at`.
13. `order_requests` está declarada en `lib/export/tables.ts`, `token_hash` figura en `EXCLUDED_COLUMNS` con su motivo, y la prueba del manifiesto de exportación pasa.

**Preguntas de diseño abiertas** (se resuelven en el `design.md`, no aquí)
- **Vigencia del enlace:** cuántos días vive antes de vencer, y si se puede regenerar sin perder la solicitud.
- **Rol del ayudante** frente a la bandeja: si puede generar enlaces y aceptar solicitudes, o solo leerlas.
- **Retención:** las solicitudes descartadas se archivan y nunca se borran, y sus imágenes se quedan en la cuarentena. Decidir si entran en la política de 12 meses de KAM-22 y qué pasa con los objetos del bucket.

**Pruebas requeridas**
- Unitarias: esquema Zod del formulario público; derivación del estado de la solicitud en sus cuatro casos; resolución del token (vigente, vencido, usado, archivado); armado del enlace `wa.me`.
- pgTAP: ausencia de políticas para `anon` en tablas; las políticas del bucket de cuarentena en todos sus casos —escribir en la carpeta propia con la solicitud abierta, y los cuatro intentos que deben fallar—; la función de resolución devuelve solo lo mínimo; aislamiento entre organizaciones; ausencia de `DELETE`; bitácora con `actor_label`.
- Integración: aceptar una solicitud crea pedido y contacto por las acciones existentes y traslada las imágenes a `attachments`; descartar archiva; el aviso se genera y respeta la preferencia apagada.
- e2e: recorrido público completo sin sesión (abrir el enlace con el teléfono relleno, adjuntar una imagen, enviar, confirmación); enlace vencido; aceptar desde la bandeja verificando que el pedido queda con sus adjuntos.

---

## KAM-29 · Tareas: detalle y edición separados

**Origen:** exploración del 2026-09-19 (idea del dueño, no de la bandeja).
**Slug del cambio:** `task-detail-edit-split`

**Objetivo:** que abrir una tarea sea leerla y que cambiarla sea un acto deliberado con su propio Guardar, como ya ocurre con los pedidos, sin perder lo que hoy se hace de un toque mientras se trabaja.

**Esto reemplaza una decisión vigente, no llena un hueco.** La edición campo por campo fue el design D3 de KAM-16, con su razón escrita: *«una tarea se toca muchas veces al día por un solo dato, y un botón Guardar al pie obligaría a bajar hasta él para cambiar un responsable»*. La especificación `task-detail` lo consolidó como el requisito **«Los campos de la tarea se editan y se guardan uno a uno»** con sus cuatro escenarios. La delta spec SHALL marcar ese requisito como **BREAKING** y reemplazarlo; no se agrega un requisito nuevo en paralelo. Los escenarios de validación que siguen vigentes —título vacío, recordatorio sin fecha— se mudan a la edición, no desaparecen.

**Dónde queda la línea.** El detalle conserva lo que se hace **mientras se trabaja**; la edición reúne los datos que **describen** la tarea.

| Se queda en `/tasks/[id]` | Se muda a `/tasks/[id]/edit` |
| --- | --- |
| Marcar casillas del cuerpo | Título |
| Cambiar de estado (y el asistente de cierre) | Línea de negocio |
| Adjuntar y quitar adjuntos | Responsable |
| Vínculos y entregables | Fecha límite y recordatorio |
| Historial | Etiquetas |
| El cuerpo, rendido y con casillas marcables | El cuerpo, como texto que se escribe |

**Alcance**
- Ruta nueva `app/(app)/tasks/[id]/edit/` con su `page.tsx`, `loading.tsx` y `error.tsx`, siguiendo exactamente la forma de `app/(app)/orders/[id]/edit/`.
- `features/tasks/task-form.tsx` gana modo edición: hoy solo crea. Un único formulario para alta y edición, como el de pedidos.
- El detalle deja de rendir controles para los campos que se mudan: los muestra como texto, con una acción **Editar** hacia la ruta nueva.
- Migas de pan `Tareas › <título> › Editar`, con el tramo del medio enlazado al detalle, reutilizando el encabezado de `MainContainer`.
- Conservación de la vista de origen con el parámetro `from`, al estilo de `lib/orders/list-href.ts`, para que volver desde la edición y desde el detalle regrese al tablero, la lista, el calendario o *Mis pendientes* con sus filtros.
- Guardar con conexión espera a que el envío se confirme y aterriza en el detalle, con el mismo tratamiento de plazo que `order-form.tsx` estrenó en `navigation-breadcrumbs-and-all-lines-board`.
- Confirmación antes de descartar cambios, reutilizando `useDiscardConfirm` de `features/orders/discard-guard.tsx`, incluida la salida por una miga de pan.
- Tarea archivada: `/tasks/[id]/edit` no ofrece el formulario y explica su estado con las mismas migas, como ya lo hace la página de edición de pedidos.
- Actualizar `kamay-mapa-navegacion-ui.md`: V18 pasa a ser dos pantallas.

**Fuera de alcance**
- Cambiar el detalle de pedidos, egresos, ítems o contactos. **Solo tareas.**
- Mover al formulario de edición lo que se queda en el detalle: casillas, adjuntos, vínculos, entregables y cambio de estado.
- Rediseñar el detalle más allá de convertir en texto los campos que se mudan.
- Edición masiva de varias tareas, o edición desde el tablero sin abrir la tarea.
- Cambios en el alta de tarea (`/tasks/new`) más allá de que comparta el formulario.
- Tocar el modelo, las acciones de servidor o los permisos de `tasks`.

**Criterios de aceptación**
1. Dado el detalle de una tarea, cuando se abre, entonces título, línea, responsable, fecha límite y etiquetas se muestran como texto y no como controles, y existe una acción *Editar* que lleva a `/tasks/[id]/edit`.
2. Dado `/tasks/[id]/edit`, entonces el formulario llega con los valores actuales y sus migas son `Tareas › <título> › Editar`, con los dos primeros tramos enlazados y el último sin enlace.
3. Dado un cambio y la acción Guardar con conexión, entonces el formulario espera la confirmación del envío y aterriza en `/tasks/[id]` mostrando los valores nuevos.
4. Dado un formulario con cambios y una salida sin guardar —cancelar, una miga de pan o el atrás del navegador—, entonces se pide confirmación antes de descartar.
5. Dado un formulario sin cambios, entonces salir no pregunta nada.
6. Dado un título vacío, entonces se impide guardar con un mensaje que señala el campo. *(Escenario vigente, ahora en la edición.)*
7. Dado un recordatorio sin fecha límite, entonces se impide guardar. *(Escenario vigente, ahora en la edición.)*
8. Dada una tarea archivada, cuando se pide `/tasks/[id]/edit`, entonces no se ofrece el formulario, se explica que está archivada y las migas son las mismas.
9. Dado el detalle, entonces marcar una casilla del cuerpo sigue funcionando sin entrar a editar y persiste. *(Escenario de KAM-16 intacto.)*
10. Dado el detalle, entonces adjuntar, quitar adjuntos, vincular, declarar entregables y cambiar de estado siguen ocurriendo ahí, sin pasar por la edición.
11. Dada una vista de origen —tablero, lista, calendario o *Mis pendientes*—, cuando se entra al detalle, se edita y se guarda, entonces volver regresa a esa vista con sus filtros.
12. Dado un ayudante que no puede ver una tarea, entonces `/tasks/[id]/edit` tampoco responde.
13. En un viewport de 390 px la edición ocupa la pantalla completa, sin barra de navegación inferior y sin desplazamiento horizontal.
14. Dada una edición que cambia tres campos de una vez, entonces la bitácora registra esos tres campos y solo esos, con su valor anterior y el nuevo.
15. Ningún valor de la tarea se calcula ni se guarda dos veces por existir dos pantallas: ambas leen la misma fuente.

**Preguntas de diseño abiertas** (se resuelven en el `design.md`, no aquí)
- **El cuerpo en Markdown.** La tabla de arriba lo parte: se lee y se marca en el detalle, se escribe en la edición. Hay que confirmar que eso no encarece el caso «abro la tarea y anoto dos líneas», que hoy cuesta un clic. La alternativa es dejar el editor del cuerpo en el detalle y que la edición cubra solo los campos de cabecera.
- **Sin conexión.** Decidir si la edición de tarea pasa por la cola de captura como la de pedidos, con su plazo de espera, o si guarda directo.

**Pruebas requeridas**
- Unitarias: `task-form` en modo edición (valores iniciales, validaciones de título y recordatorio, destino tras guardar, guardia de descarte); el detalle ya no rinde controles para los campos mudados; migas de ambas pantallas; conservación de la vista de origen.
- Integración: una edición de tres campos deja un solo registro de bitácora con esos tres campos.
- e2e: editar una tarea desde el tablero y volver a la vista de origen; intentar salir con cambios sin guardar; abrir la edición de una tarea archivada; marcar una casilla desde el detalle sin entrar a editar; acceso denegado al ayudante.

---

## KAM-30 · Asistencia de redacción en la descripción de la tarea

**Origen:** exploración del 2026-09-19 (idea del dueño, no de la bandeja).
**Slug del cambio:** `task-body-writing-assist`
**Depende de:** KAM-29, solo para saber dónde vive el editor del cuerpo y por lo tanto dónde va el botón.

**Objetivo:** que una descripción escrita a las apuradas pueda quedar completa y ordenada sin reescribirla a mano, sin que el asistente toque nunca el texto de alguien sin permiso.

**No es una herramienta de KAM-27.** Sería la primera candidata del casillero «herramientas que llaman a servicios de terceros», pero no cabe: los dos puntos de enganche definidos son página propia y acción en el detalle de pedido, y esto vive dentro del editor. Entra como funcionalidad de primera clase y **establece el patrón para llamar a un modelo**, que las herramientas podrán reutilizar después.

**La regla que ordena todo lo demás:** el texto es de quien lo escribió. El asistente **propone**, la persona **acepta**. Nada se sobrescribe en silencio, ni al guardar, ni al abrir, ni al cerrar.

**Alcance**
- Puerto `lib/ai/port.ts` al estilo exacto de `lib/email/port.ts`: una interfaz mínima, el proveedor concreto detrás de un adaptador, más un adaptador en memoria para que **ninguna prueba toque la red** y un adaptador que siempre falla, para demostrar que un fallo del modelo no se lleva por delante el editor.
- Acción de servidor que recibe el cuerpo, llama al puerto y devuelve la propuesta. La credencial vive solo en el servidor.
- En el editor de Markdown, una acción *Mejorar la descripción* que muestra la propuesta **junto al texto actual**, con aceptar y descartar.
- Instrucción al modelo con tres exigencias verificables: responde en español, conserva la estructura de Markdown, y conserva los ítems de lista de verificación con su estado marcado.
- **Aviso deterministra:** si la propuesta pierde ítems de verificación que el original tenía, la pantalla lo advierte antes de que se pueda aceptar.
- La propuesta se rinde por el mismo camino saneado que cualquier cuerpo: la salida del modelo es texto no confiable.
- Variable de entorno **opcional** en `lib/env.ts`, en un grupo nuevo cuya ausencia **apaga la función** en lugar de romper la compilación. Se reporta el nombre, nunca el valor, como ya hace ese módulo.
- Activación por organización, apagada por omisión, con el aviso explícito de que el texto de la tarea sale hacia un tercero.
- Límite de uso por organización y por periodo, para que el gasto no dependa de la buena voluntad.
- Sin conexión: la acción se muestra no disponible por falta de red, no fallida.
- La bitácora registra el cambio del cuerpo dejando constancia de que fue asistido; el autor sigue siendo la persona que aceptó.

**Fuera de alcance**
- Aplicar la mejora automáticamente, al guardar o en cualquier otro momento. **Siempre la acepta una persona.**
- Escribir una descripción desde cero cuando no hay nada escrito.
- Asistencia en cualquier otro campo o pantalla: notas de pedido, descripciones de ítems, nombres de producto, mensajes al cliente.
- Conversación con el modelo, varias vueltas de refinamiento o historial de intentos.
- Credencial de IA por organización: se usa una sola de la plataforma.
- Resumir, traducir, sugerir precios, estimar tiempos, generar imágenes o proponer etiquetas.
- Enviar datos del taller para entrenar o mejorar un modelo.

**Criterios de aceptación**
1. Dado un cuerpo escrito y la acción *Mejorar*, entonces se muestra la propuesta junto al texto actual y **nada se guarda** hasta que la persona acepta.
2. Dada una propuesta descartada, entonces el cuerpo queda exactamente como estaba, carácter por carácter.
3. Dada una propuesta que pierde ítems de verificación presentes en el original, entonces la pantalla lo advierte antes de permitir aceptar.
4. Dado un cuerpo vacío, entonces la acción no se ofrece.
5. Dado un proveedor que falla o tarda más del plazo, entonces se avisa en lenguaje llano y el editor sigue usable con el texto intacto.
6. Dado un dispositivo sin conexión, entonces la acción se muestra no disponible por falta de red, no como un fallo.
7. Dada una organización que no activó la asistencia, entonces la acción no aparece **y** la acción de servidor la rechaza igual, verificado sin pasar por la interfaz.
8. Dada la variable de entorno ausente, entonces la aplicación compila y arranca igual y la función queda apagada para todas las organizaciones.
9. Dada una propuesta aceptada, entonces la bitácora registra el cambio del cuerpo con constancia de que fue asistido, y el autor es la persona.
10. Dada una respuesta del modelo con HTML peligroso o un enlace con esquema peligroso, entonces se sanea igual que cualquier cuerpo y no se ejecuta ni navega.
11. Ninguna prueba de la suite sale a la red: existen los tres adaptadores y las pruebas usan el de memoria y el que falla.
12. Dado el límite de uso de una organización superado, entonces la acción se rechaza con un mensaje sobrio.
13. La credencial nunca llega al navegador: ninguna variable `NEXT_PUBLIC_*` la contiene, verificado con la frontera que ya vigila `lib/env.ts`.
14. La propuesta llega en español.

**Preguntas de diseño abiertas** (se resuelven en el `design.md`, no aquí)
- **Cómo se llama al modelo.** Pediste la API de Claude. Dos caminos: el SDK de Anthropic directo, o la pasarela de IA de Vercel con un modelo de Claude, que conserva Claude pero agrega control de gasto, observabilidad y cambiar de modelo sin tocar código. Con el puerto de por medio, la decisión es reversible: es otro archivo al lado.
- **Qué sale exactamente.** Solo el cuerpo, o también el título y la línea como contexto. Cuanto menos salga del taller, mejor; hay que decidirlo a conciencia, no por omisión.
- **Dónde vive el interruptor de la organización:** una llave en `organizations.settings`, como `allocation` y `activity_retention`, o una fila de la tabla de herramientas de KAM-27 si ese cambio ya está hecho.
- **Dónde y cómo se cuenta el límite de uso**, y si el ayudante puede gastar cuota.

**Pruebas requeridas**
- Unitarias: detección de ítems de verificación perdidos entre original y propuesta; la acción no se ofrece con cuerpo vacío; estado de la propuesta (pendiente, aceptada, descartada) y que descartar no muta el original; comportamiento con el adaptador que falla y con el que tarda.
- Frontera: ninguna variable pública lleva la credencial; el puerto no se importa desde código de cliente.
- Integración: la acción de servidor rechaza a una organización sin la asistencia activada y a una que superó su límite; la bitácora queda con la marca de asistido.
- e2e: mejorar una descripción, ver la propuesta, descartarla y comprobar que el texto no cambió; aceptarla y comprobar que sí; el aviso de conexión ausente.

---

## KAM-31 · Atributos de catálogo definidos por la organización, y disponibilidad por variante

**Origen:** exploración del 2026-09-19 (idea del dueño, no de la bandeja).
**Slug del cambio:** `catalog-custom-attributes`

**Objetivo:** que cada organización describa sus insumos y productos con los datos que su rubro necesita —el color, la marca y las temperaturas de un filamento; la capacidad y el acabado de una taza— y que la disponibilidad se vea por variante y no sumada por ítem, **sin un segundo catálogo y sin guardar nada derivado**.

**Lo que ya existe y no hay que construir**
- `item_variants.attributes jsonb` está en el esquema desde KAM-06, con los ejemplos `'11oz'`, `'Negro'`, `'XL'` escritos en la migración. Falta quien lo escriba y lo lea, no la columna.
- `item_categories` por tipo y organización, gestionadas por la dueña en Configuración, con filtro en el catálogo.
- `expense_items.variant_id` e `inventory_movements.variant_id` existen, y el formulario de compra ya arrastra la variante hasta la base. La entrada de inventario se genera sola desde la línea de compra, con su índice de idempotencia.
- El último precio pagado ya se ofrece como pista al comprar.

**El hueco real.** `item_balances` agrupa por `i.id` y descarta `variant_id`: el saldo del negro y el del rojo se suman en uno. Ver la disponibilidad por color exige que la vista distinga la variante.

**Lo que no se guarda.** La migración del catálogo es explícita: `items` no tiene `last_cost` ni `current_stock` porque «guardarlos aquí es exactamente el error que hizo inmantenible la versión anterior». **El precio por kilo no es una columna:** se deriva de las compras. Un valor escrito a mano queda viejo al cambiar de proveedor y la calculadora daría un número falso con cara de verdad.

**Alcance**
- **Definición de atributos por categoría de ítem.** Cada categoría declara una lista ordenada de atributos: nombre, tipo, unidad cuando corresponde, si es obligatorio, y si aplica **al ítem o a la variante**. Se declara una vez y sirve para todos los ítems de esa categoría.
- Gestión de esa definición dentro de la sección «Categorías de ítem» de Configuración, con el mismo patrón de tabla, menú «⋯», diálogo y archivado que ya usan las demás secciones.
- **Valores:** los de variante en `item_variants.attributes`, que ya existe; los de ítem en una columna `attributes jsonb` nueva en `items`.
- Formularios de ítem y de variante: campos generados desde la definición de su categoría, validados con Zod en el cliente **y en el servidor**, con la misma disciplina que `catalog-fields-by-kind` aplicó a los campos por tipo.
- Detalle de ítem (V11): los atributos se muestran como datos con su etiqueta, no como texto suelto dentro de la descripción.
- Catálogo (V10): filtro por los atributos de tipo lista, junto al filtro de categoría que ya existe.
- **Disponibilidad por variante:** `item_balances` distingue la variante, o una vista hermana la agrega. El detalle del ítem muestra el saldo de cada variante.
- Semilla de la línea de Impresión 3D: categoría de insumo «Filamento» con color, marca, temperatura mínima, temperatura máxima y velocidad recomendada.
- Declarar la definición de atributos en `lib/export/tables.ts`.

**Fuera de alcance**
- **Guardar precio por kilo, último costo o saldo en cualquier columna.** Se derivan (convención nº 4) y la prueba que lo vigila sigue en verde.
- Un catálogo nuevo separado del de ítems. Un filamento es un insumo y una taza es un producto.
- **Biblioteca de imágenes o diseños disponibles.** No tiene unidad, ni saldo, ni compra, ni mínimo: es otro problema y merece su propia tarea.
- Mínimo y alerta de bajo stock por variante: el mínimo sigue siendo del ítem.
- Atributos declarados por línea de negocio en lugar de por categoría.
- Fórmulas, cálculos o validaciones cruzadas entre atributos.
- Conectar estos atributos con la calculadora de KAM-27: podrá leerlos, pero cablearla no es parte de esta tarea.
- Atributos en contactos, pedidos, tareas o egresos.

**Criterios de aceptación**
1. Dada una categoría de insumo «Filamento» con cinco atributos declarados, cuando se crea una variante de un filamento, entonces el formulario ofrece esos cinco campos y ninguno más.
2. Dado un atributo obligatorio sin valor, entonces no se guarda, y el rechazo ocurre también en el servidor cuando la petición no viene de la interfaz.
3. Dado un atributo numérico con unidad, entonces se guarda como número y se muestra con su unidad; un valor no numérico se rechaza.
4. Dado un atributo retirado de la categoría, entonces los valores ya guardados se conservan y se siguen mostrando, pero el campo no se ofrece de nuevo.
5. Dado un ítem cuya categoría no declara atributos, entonces su formulario se ve exactamente como hoy.
6. Dadas dos variantes de un filamento con compras y consumos distintos, entonces la disponibilidad se muestra por variante y cada saldo coincide con la suma de sus movimientos.
7. El saldo por variante no se almacena en ninguna columna: se deriva, y la prueba de valores derivados lo verifica.
8. Ninguna columna de `items` ni de `item_variants` guarda precio por kilo, último costo ni saldo.
9. Dada una compra de una variante de filamento, entonces genera exactamente una entrada de inventario para esa variante, y sincronizarla dos veces sigue dejando una sola.
10. Dado un ayudante, entonces puede llenar los atributos de un ítem pero no definir, editar ni archivar los atributos de una categoría.
11. Dada una organización A con atributos definidos, entonces la organización B no los ve ni puede usarlos.
12. Tras `supabase db reset`, la línea de Impresión 3D tiene la categoría «Filamento» con sus cinco atributos.
13. Los atributos se declaran una vez por categoría: crear el segundo filamento no vuelve a definirlos.
14. La definición está declarada en `lib/export/tables.ts` y la prueba del manifiesto de exportación pasa.

**Preguntas de diseño abiertas** (se resuelven en el `design.md`, no aquí)
- **Qué tipos de atributo admite el primer corte** (texto, número con unidad, lista de opciones, color) y si «color» merece ser un tipo propio o es una lista de opciones definida por la organización.
- **Precio de referencia de un insumo nunca comprado:** si se admite como atributo claramente rotulado de referencia, con la regla de que el valor derivado de una compra real siempre manda. La alternativa es no admitirlo y que la calculadora pida el dato cuando falta.
- **Unidad del filamento:** si se registra en kilos o en gramos, y cómo se convierte para la calculadora sin guardar factores en ninguna parte.
- **Mínimo por variante:** queda fuera de alcance, pero hay que anotar qué se ve en el panel cuando un color se acaba y el ítem completo no está bajo el mínimo.

**Pruebas requeridas**
- Unitarias: generación del formulario desde la definición; validación por tipo de atributo; conservación del valor de un atributo retirado; la definición de una categoría no se aplica a otra.
- pgTAP: el saldo por variante coincide con la suma de sus movimientos; ausencia de columnas derivadas; idempotencia de la entrada de compra por variante; RLS de la definición y permisos por rol.
- Integración: comprar dos variantes y verificar la disponibilidad de cada una; manifiesto de exportación.
- e2e: definir la categoría «Filamento» con sus atributos, crear dos filamentos con color y marca, comprar uno, y ver en el detalle la disponibilidad por variante y los datos técnicos.

---

## KAM-32 · Enlace público del pedido, de solo lectura y con comentarios del cliente

**Origen:** exploración del 2026-09-19. Promueve el candidato «Seguimiento público del estado del pedido», que estaba anotado desde KAM-28.
**Slug del cambio:** `public-order-share`

**Objetivo:** que el cliente vea su pedido y pueda decir algo sobre él sin que nadie le dicte el estado por WhatsApp cinco veces, y sin abrir ninguna puerta a lo que no le corresponde.

**Prerrequisito (convención nº 11).** «Seguimiento público del pedido» ya figura en la Fase 6 de la especificación, así que el concepto existe. **El comentario del cliente no.** Alguien de fuera de la organización escribiendo dentro del sistema es un concepto nuevo y tiene que quedar definido en §6.1 antes de construirse, con su frontera: un comentario es contenido, no un evento de bitácora, y no convierte al cliente en usuario.

**Comparte infraestructura con KAM-28.** El grupo de rutas público, el patrón de token con `token_hash` al estilo de `invitations`, la función `security definer` concedida a `anon` y el autor externo en la bitácora son los mismos. La primera de las dos que se implemente los establece; la segunda los reutiliza.

**Alcance**
- Tabla `order_shares`: organización, pedido, `token_hash bytea` (sha256; el token en claro nunca se guarda), `expires_at`, `archived_at`, quién lo generó. Un solo enlace vigente por pedido, revocable y regenerable. RLS de siempre, sin `DELETE`, con trigger `log_activity()`.
- Tabla `order_comments`: organización, pedido, nombre declarado por quien comenta, cuerpo, `occurred_at`, `archived_at`. Inmutable para quien la escribió; la organización la archiva, nunca la borra.
- Función `security definer` concedida a `anon` que resuelve el token y devuelve **solo** el contenido público: número del pedido, estado, fecha comprometida, líneas con su descripción, cantidad y precio unitario, el total de `order_totals`, y la lista de adjuntos. Nada más, y nada de otro pedido.
- **Lectura pública de las imágenes sin service role.** Política `select` para `anon` sobre el bucket de adjuntos, guardada por una función `security definer` que use la forma de `attachments.storage_path` (`{organization_id}/{entity_type}/{entity_id}/…`) para confirmar que el objeto pertenece a un pedido con enlace vigente. Sin `insert`, `update` ni `delete` para `anon`.
- Ruta pública `/p/<token>` en el grupo de rutas público, con layout propio sin navegación y fuera del bloqueo de sesión del middleware.
- Página pública: los datos del pedido, sus imágenes y un campo para dejar un comentario con el nombre de quien lo deja. Límite de comentarios por enlace y ventana de tiempo.
- **En el detalle del pedido (V4):** un bloque *Compartir con el cliente* con el campo de la URL, **botón de copiar** —siguiendo el patrón ya probado de `features/settings/members/invite-dialog.tsx`, con el navegador inyectado para que la prueba lo lea de vuelta— y **botón de compartir** que invoque la función de compartir del dispositivo, inyectada del mismo modo y con respaldo a copiar cuando no exista.
- **Vista previa obligatoria antes de activar:** «así lo verá tu cliente», con el contenido exacto. Activar es un acto explícito, nunca un efecto secundario.
- Los comentarios recibidos se leen en el detalle del pedido.
- Aviso al dueño cuando llega un comentario: tipo nuevo en `notifications`, apagable por separado.
- Autor en la bitácora: `actor_label` = «Cliente», sin `actor_id`.
- Declarar ambas tablas en `lib/export/tables.ts`, con `token_hash` en `EXCLUDED_COLUMNS`.

**Fuera de alcance**
- **Cualquier cifra que no sea lo que el cliente paga.** Ni costo, ni margen, ni proveedor, ni último precio pagado. El total público es el de `order_totals`, que es precio de venta.
- Responder al comentario desde la aplicación, o cualquier forma de conversación de ida y vuelta.
- Que el cliente apruebe, rechace o pida cambios: no es un flujo de aprobación.
- Que el cliente vea otros pedidos suyos, inicie sesión o tenga cuenta.
- Pago o anticipo desde el enlace.
- Documento imprimible o PDF del pedido (Fase 6).
- Comentarios en tareas, egresos, ítems o contactos.
- Enlace público de una venta directa: no tiene ciclo que seguir.
- Aviso automático al cliente cuando el pedido cambia de estado.

**Criterios de aceptación**
1. Dado un pedido sin enlace, entonces el detalle ofrece generarlo y no muestra ninguna URL.
2. Dada la generación, entonces antes de activarse se muestra exactamente lo que el cliente verá, y activar requiere una acción explícita.
3. Dado un enlace vigente, entonces el detalle muestra su URL en un campo, con copiar y compartir.
4. Dada la acción de copiar, entonces la URL queda en el portapapeles.
5. Dado un dispositivo con función de compartir del sistema, entonces el botón la invoca con esa URL; sin ella, el botón no se ofrece y copiar sigue disponible.
6. Dado el enlace abierto sin sesión, entonces se ven el número del pedido, su estado, la fecha comprometida, las líneas con descripción, cantidad y precio unitario, el total y las imágenes adjuntas.
7. Dado el enlace abierto, entonces **no** se ve ningún costo, margen, proveedor, ni dato de otro pedido, contacto o ítem del catálogo. Verificado sobre la forma del objeto que devuelve la función, no solo sobre la pantalla.
8. Dado un enlace revocado, vencido, inválido, o de un pedido archivado, entonces la página lo dice **sin revelar si la organización o el pedido existen**.
9. No existe ninguna política para `anon` sobre ninguna tabla: el acceso público pasa solo por la función de resolución, verificado por pgTAP.
10. Dada una imagen de un pedido con enlace vigente, entonces un anónimo la lee; la de un pedido sin enlace vigente no, aunque conozca su ruta exacta.
11. Dado un enlace que se revoca, entonces sus imágenes dejan de ser accesibles de inmediato.
12. Dado un comentario del cliente, entonces se lee en el detalle del pedido, la bitácora lo registra con `actor_label` «Cliente» y `actor_id` nulo, y se genera el aviso al dueño.
13. Dado un comentario enviado, entonces quien lo escribió no puede editarlo ni borrarlo; la organización lo archiva y no lo borra.
14. Dados más comentarios que el límite en su ventana de tiempo, entonces los siguientes se rechazan con un mensaje sobrio.
15. Ningún total se almacena: el público se lee de `order_totals` como cualquier otro.
16. Ambas tablas están declaradas en `lib/export/tables.ts`, `token_hash` figura en `EXCLUDED_COLUMNS`, y la prueba del manifiesto pasa.

**Preguntas de diseño abiertas** (se resuelven en el `design.md`, no aquí)
- **¿Se muestra `orders.notes`?** Es un campo de nota de propósito general y puede contener texto escrito cuando nadie de fuera lo iba a leer: activar un enlace no puede exponer retroactivamente lo que era privado. Tres candidatos: no mostrarlo nunca; agregar un campo aparte de descripción para el cliente; o mostrarlo confiando en que la vista previa obligatoria haga de salvaguarda. **Lo mismo aplica a `order_items.description`.**
- **¿Se muestran los cobros y el saldo pendiente?** Es útil para el cliente y es información de dinero. Decidirlo a conciencia.
- **Vigencia del enlace** y qué pasa al regenerarlo: si el anterior muere y si los comentarios recibidos sobreviven.
- **Qué nombre de estado ve el cliente:** los nombres son configurables por línea y pueden ser jerga interna.

**Pruebas requeridas**
- Unitarias: armado de la URL; copiar; compartir con y sin la capacidad del dispositivo; **la forma del objeto público no incluye ningún campo interno**; la vista previa muestra lo mismo que la página pública.
- pgTAP: ausencia de políticas para `anon`; la función de resolución con token vigente, vencido, revocado y de pedido archivado; la política de lectura del bucket en todos sus casos, incluido el intento con ruta conocida y enlace revocado; comentarios sin `DELETE`; bitácora con `actor_label`.
- Integración: un comentario genera el aviso y respeta la preferencia apagada; revocar corta el acceso a las imágenes.
- e2e: generar el enlace con su vista previa, abrirlo sin sesión, ver líneas y total, dejar un comentario, leerlo en el detalle, revocar y comprobar que la página ya no responde.

---

## KAM-33 · Tablero de tareas con «Todas» las líneas

**Origen:** exploración del 2026-09-19 (idea del dueño, no de la bandeja).
**Slug del cambio:** `tasks-all-lines-board`

**Objetivo:** que con «Todas» activa el tablero de tareas muestre el trabajo pendiente completo, igual que ya hace el de pedidos, en lugar de pedir que se elija una línea.

**Resuelve una contradicción que ya está en la especificación.** El requisito *Tarjeta de tarea* dice: «Cuando el selector de línea está en «Todas», cada tarjeta SHALL mostrar además el color de su línea de negocio», con su escenario abriendo **el tablero** en «Todas». Pero `app/(app)/tasks/page.tsx` documenta lo contrario: «Con "Todas" activa no hay un juego único de columnas; el tablero pide elegir línea». Ese escenario hoy no se puede verificar en el tablero. Al cerrar esto vuelve a ser verificable.

**Qué se modifica y qué se conserva.** El requisito *Las columnas del tablero salen del juego de estados de la línea* habla solo de la línea activa: hay que **modificarlo** para cubrir el modo «Todas» con columnas por tipo, marcando el cambio en la delta spec. El requisito de la tarjeta y el del arrastre **no se reemplazan**: se cumplen también en el modo nuevo.

**Ya está construido y probado, del cambio de pedidos de hoy**
- `KIND_COLUMNS` y `targetStatusFor(lineStatuses, kind)` en `lib/orders/kind-board.ts`, con sus pruebas. No tienen nada de pedidos salvo el comentario.
- La prop opcional `canMoveTo(item, columnId)` de `components/board/kanban-board.tsx`, que filtra el menú «Mover a…» y trata un soltar no permitido como soltar fuera. El tablero de tareas no la pasa todavía.
- `app/(app)/tasks/page.tsx` ya carga `listAllForFlow(..., "task")`, así que los estados de todas las líneas ya viajan.

**Alcance**
- Mover `kind-board.ts` a un lugar compartido —`lib/statuses/` ya existe y contiene `kinds.ts`— y generalizar su comentario. Los dos tableros lo importan del mismo sitio.
- `app/(app)/tasks/page.tsx`: con «Todas», resolver el juego de estados de tarea de cada línea activa, para que el tablero sepa a qué estado corresponde cada tipo en cada línea. Es lo que ya hace la página de pedidos.
- `features/tasks/board/tasks-screen.tsx`: con «Todas», el tablero agrupa por tipo de estado en lugar de pedir una línea. Cada tarjeta muestra el color de su línea y el nombre de su estado real.
- Arrastrar a una columna de tipo mueve la tarea al primer estado de ese tipo del juego de **su** línea; si su línea no tiene ninguno de ese tipo, el destino no se ofrece, vía `canMoveTo`.
- Soltar en «Terminados» conserva la regla del asistente de cierre: abre V19 solo si la tarea tiene entregables declarados sin cumplir, resolviendo antes el estado `final` de su propia línea.

**Fuera de alcance**
- Las vistas lista y calendario: **ya cruzan todas las líneas** y no se tocan.
- El tablero con una línea concreta: se comporta exactamente como hoy.
- El alta rápida: con «Todas» ya usa la línea compartida, y así queda.
- El tablero de pedidos, más allá de que su importación apunte al lugar nuevo.
- Reordenar, agrupar por responsable o por etiqueta, o cualquier columna que no sea un tipo de estado.
- Renombrar o reordenar los tipos de estado.
- *Mis pendientes* (V20), que no es un tablero por líneas.

**Criterios de aceptación**
1. Dado el selector en «Todas», cuando se abre el tablero de tareas, entonces se muestran las tareas de todas las líneas y **no** se pide elegir una línea.
2. Dado ese modo, entonces las columnas son *Por empezar, En curso, En espera, Terminados y Cancelados*, en ese orden.
3. Dada una tarjeta en ese modo, entonces muestra el color de su línea y el nombre de su estado real.
4. Dada una tarea arrastrada a la columna de un tipo, entonces pasa al primer estado de ese tipo, por posición, del juego de **su** línea.
5. Dada una tarea cuya línea no tiene ningún estado de ese tipo, entonces la columna no la acepta y el menú «Mover a…» no ofrece ese destino.
6. Dada una tarea con un entregable sin cumplir soltada en «Terminados», entonces se abre el asistente de cierre, igual que con una línea concreta.
7. Dada una tarea sin entregables soltada en «Terminados», entonces se cierra sin abrir ningún diálogo.
8. Dado el selector en una línea concreta, entonces el tablero rinde el juego de estados de esa línea, como hoy.
9. Dadas las vistas lista y calendario, entonces siguen cruzando todas las líneas sin cambio alguno.
10. Dado un ayudante restringido a una línea con el selector en «Todas», entonces sigue viendo solo las tareas que le corresponden: **«Todas» no amplía la visibilidad de nadie.** Verificado con consulta directa, no solo en la pantalla.
11. Dado el alta rápida con «Todas», entonces sigue creando la tarea en la línea compartida.
12. `KIND_COLUMNS` y `targetStatusFor` viven en un solo lugar y los dos tableros lo importan; las pruebas del tablero de pedidos siguen en verde.
13. Ninguna comparación por nombre de estado: el agrupado y el destino se deciden por `kind` (convención nº 5).

**Preguntas de diseño abiertas** (se resuelven en el `design.md`, no aquí)
- **El filtro de estado (`?status=`)** apunta a un estado concreto, y en este modo las columnas son tipos y los estados pertenecen a líneas distintas. Decidir si el filtro se conserva, se reinterpreta como filtro por tipo o se oculta.
- **La ventana de tareas cerradas.** Hoy el tablero limita las cerradas por el presupuesto de rendimiento de KAM-23; con todas las líneas la columna «Terminados» crece. Decidir si el tamaño de la ventana se mantiene o se ajusta, y medirlo.

**Pruebas requeridas**
- Unitarias: agrupado del tablero por tipo con tareas de tres líneas; `canMoveTo` negando el tipo ausente; la decisión del asistente de cierre disparada desde una columna de tipo; el comportamiento elegido para el filtro de estado. Las pruebas de `kind-board` se mudan con el archivo.
- Integración: un ayudante restringido a una línea, con «Todas» activa, obtiene el mismo recorte que con su línea.
- e2e: abrir el tablero con «Todas», mover una tarea entre columnas de tipo y verificar que aterriza en el estado de su propia línea; intentar soltar una tarea en un tipo que su línea no tiene; cerrar con entregables y ver el asistente.

---

## Candidatos ya identificados

Postergaciones explícitas que ya están escritas en el backlog original o en sus cambios archivados. **No están comprometidas en este sprint**; se listan para no volver a descubrirlas y para tenerlas a mano si una observación las vuelve urgentes.

| Candidato | Dónde se postergó |
| --- | --- |
| **Herramientas que llaman a servicios de terceros** — una herramienta sale a internet detrás de un puerto al estilo de `lib/email/port.ts` (adaptador real, uno en memoria y uno que falla), degrada de forma honesta sin conexión y su resultado aterriza como adjunto de un registro existente. Herramienta de prueba: generador de llaveros a partir de un PNG. Pendiente de decidir con qué credencial se llama al servicio: si es de cada organización, se mueve al candidato siguiente. | KAM-27, fuera de alcance |
| **Puerta de conexión con otras plataformas** — credencial privada por organización, vínculo entre un ítem del catálogo y su equivalente en un sistema externo, revocación, y la plataforma externa identificada como autor en la bitácora. Caso de uso: publicar productos en Katu. **No es una herramienta más:** guarda un secreto del tenant y deja estado fuera de Kamay que desactivar no revierte. Necesita su propio cambio. | KAM-27, fuera de alcance · especificación v6 §10 (Fase 6) |
| Envío automatizado por WhatsApp (Business API, plantillas aprobadas) en lugar del enlace `wa.me` que abre el WhatsApp de quien manda | KAM-28, fuera de alcance · especificación v6 §10 «deseables después» |
| **Enlace abierto de recepción de pedidos** — un enlace fijo por línea, publicable en redes, que cualquiera puede usar. Trae consigo lo que el enlace dirigido no necesita: validación de humano (captcha), límite de envíos por origen, rotación del enlace, y una carpeta de cuarentena que no puede apoyarse en una solicitud preexistente. | KAM-28, fuera de alcance |
| **Biblioteca de imágenes y diseños disponibles** — la lista de diseños que se pueden imprimir o sublimar. No encaja en el catálogo de ítems: no tiene unidad, ni saldo, ni compra, ni mínimo. Es una biblioteca de archivos con sus propias preguntas (quién los subió, en qué pedidos se usaron, derechos de uso). | KAM-31, fuera de alcance |
| Mínimo y alerta de bajo stock por variante, en lugar de por ítem | KAM-31, fuera de alcance |
| Asistencia de redacción en otros campos y pantallas: notas de pedido, descripciones de ítems, nombres de producto, mensajes al cliente | KAM-30, fuera de alcance |
| Escribir una descripción desde cero con asistencia, cuando no hay nada escrito | KAM-30, fuera de alcance |
| Credencial de IA propia por organización, en lugar de una sola de la plataforma | KAM-30, fuera de alcance |
| Responder al comentario del cliente desde la aplicación, o conversación de ida y vuelta en el enlace público | KAM-32, fuera de alcance |
| Que el cliente apruebe, rechace o pida cambios en su pedido desde el enlace | KAM-32, fuera de alcance |
| Aviso automático al cliente cuando su pedido cambia de estado | KAM-32, fuera de alcance |
| Documento imprimible o PDF del pedido | KAM-32, fuera de alcance (Fase 6) |
| Activación de herramientas por línea de negocio, con parámetros por línea | KAM-27, fuera de alcance |
| Curaduría del catálogo de herramientas por organización (base para planes y cobro) | KAM-27, fuera de alcance |
| Cierre de feria con resumen del evento | KAM-12, fuera de alcance (Fase 6) |
| Notificaciones push al celular | KAM-17, fuera de alcance |
| Recordatorios sobre pedidos (hoy solo tareas e inventario) | KAM-17, fuera de alcance |
| Campos estructurados de personalización en pedidos (hoy: nota y foto) | KAM-08, decisión pendiente |
| Descuentos, impuestos y condiciones de pago en pedidos | KAM-08 y KAM-12, fuera de alcance |
| Reglas automáticas de transición entre estados | KAM-05, fuera de alcance |
| Plantillas de tarea y tareas recurrentes | KAM-21, fuera de alcance |
| Mantenimiento preventivo programado de activos | KAM-19, fuera de alcance |
| Merma como concepto propio (hoy se anota como consumo) | KAM-18, fuera de alcance |
| Recetas de producto y descuento automático al producir | KAM-18, fuera de alcance (Fase 5) |
| Cotizaciones, lotes con merma, seguimiento público, plataformas externas | `kamay-backlog.md`, Fases 5 y 6 |

---

## Bitácora del sprint

| Fecha | Qué cambió en este documento |
| --- | --- |
| 2026-09-19 | Documento creado sobre la estructura de `kamay-backlog.md`; bandeja y resumen vacíos, a la espera de observaciones. |
| 2026-09-19 | Exploración «Recepción de pedidos por enlace». Se comprometió KAM-28. Hallazgo decisivo: lo que llega por el enlace no puede ser un pedido (`order_needs_customer` y el criterio 2 de KAM-08), así que se define el concepto nuevo «solicitud de pedido» con revisión humana obligatoria. WhatsApp se resuelve con un enlace `wa.me`, sin integración. Queda abierta la mecánica de subida de imágenes sin sesión. |
| 2026-09-19 | Se comprometió KAM-33. La exploración encontró que la especificación **ya exige** que la tarjeta muestre el color de su línea con «Todas» en el tablero, mientras el código pide elegir una línea: el ticket resuelve esa contradicción más que agregar una función. Casi todo está construido por el cambio de pedidos de hoy (`KIND_COLUMNS`, `targetStatusFor`, la prop `canMoveTo`); el trabajo es compartir el helper y respetar la regla del asistente de cierre al soltar en «Terminados». Lista y calendario ya cruzan todas las líneas. |
| 2026-09-19 | Se comprometió KAM-32, que promueve el candidato «seguimiento público del pedido» (Fase 6). Dos riesgos identificados y cerrados: el total público es **precio de venta**, nunca costo ni margen; y `orders.notes` es un campo general que puede contener texto escrito cuando era privado, así que activar un enlace no puede exponerlo retroactivamente —de ahí la vista previa obligatoria—. Las imágenes se leen sin service role con una política apoyada en la forma de `attachments.storage_path`. El comentario del cliente es un concepto nuevo y va a la especificación primero. |
| 2026-09-19 | Se comprometió KAM-31. La exploración encontró que el catálogo ya cubre el caso: un filamento es un insumo, cada marca y color es una variante, y `item_variants.attributes` existe desde KAM-06 sin que nadie lo escriba. El trabajo real son los atributos declarados por categoría y que `item_balances` deje de descartar `variant_id`. El precio por kilo **no se guarda**: se deriva de las compras. La biblioteca de imágenes queda fuera porque no es un ítem. |
| 2026-09-19 | Se comprometió KAM-30 (asistencia de redacción en la descripción de la tarea). Queda fuera del sistema de herramientas de KAM-27 porque no cabe en sus dos puntos de enganche, y establece el puerto para llamar a modelos al estilo de `lib/email/port.ts`. Regla rectora: el asistente propone y la persona acepta; nada se sobrescribe en silencio. |
| 2026-09-19 | Se comprometió KAM-29 (detalle y edición de tareas separados). Reemplaza el requisito vigente «Los campos de la tarea se editan y se guardan uno a uno» (design D3 de KAM-16), así que va como `BREAKING`. Se trazó la línea: el detalle conserva lo que se hace mientras se trabaja —casillas, adjuntos, vínculos, entregables, estado— y la edición reúne los datos que describen la tarea. Queda por confirmar de qué lado vive el editor del cuerpo en Markdown. |
| 2026-09-19 | KAM-28 reducida a **enlaces dirigidos de un solo uso**. Dos consecuencias: el captcha sale del alcance porque el token ya es la puerta, y las dos tablas se fusionan en una sola, porque la solicitud existe antes de que el cliente abra el enlace. Las imágenes se resuelven con un bucket de cuarentena `order-requests` con ruta `<organización>/<solicitud>/`. El enlace abierto y público queda como candidato. |
| 2026-09-19 | Exploración «Herramientas por tenant». Se comprometió KAM-27 (registro, catálogo y calculadora 3D) y bajaron a candidatos las herramientas con servicios de terceros y la puerta de conexión con plataformas externas. Decisiones tomadas: las herramientas son código del repositorio y entran por PR; activación por organización; catálogo igual para todas; ninguna herramienta tiene tablas propias. |

---

*Las tareas de este sprint se ejecutan como cambios de OpenSpec; ninguna se implementa directamente desde este documento.*
