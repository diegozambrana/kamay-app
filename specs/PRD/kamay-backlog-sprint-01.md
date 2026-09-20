# Kamay — Backlog del Sprint 1 · Revisión de la plataforma

> Deriva de: `kamay-backlog.md` (Fases 0–4, completado) · especificación funcional v6.0 · esquema de base de datos · mapa de navegación · ARCHITECTURE.md
> **Origen de las tareas:** observaciones recogidas usando la plataforma ya construida, no una fase planificada de antemano.
> Estado: **abierto** · tareas comprometidas: 4 · observaciones en bandeja: 0

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
| KAM-27 | Registro de herramientas y catálogo por organización | exploración 2026-09-19 | — | V15 (sección nueva), V4, `/extensions/<slug>` | propuesta |
| KAM-28 | Solicitudes de pedido por enlace público | exploración 2026-09-19 | — | nueva bandeja, nueva pública `/r/<token>`, V5, V15 | propuesta |
| KAM-29 | Tareas: detalle y edición separados | exploración 2026-09-19 | — | V18 (pasa a dos pantallas), V17, V20 | propuesta |
| KAM-30 | Asistencia de redacción en la descripción de la tarea | exploración 2026-09-19 | 29 | V18, V15 | propuesta |

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
- Tabla `organization_tools`: `organization_id`, `slug`, `config jsonb`, `archived_at`. RLS con el patrón de siempre, sin política `DELETE`, y trigger `log_activity()`. Activación **por organización**, no por línea.
- Declararla en `lib/export/tables.ts` con sus columnas, para que la prueba del manifiesto de exportación siga en verde.
- **Registro en código.** Un manifiesto por herramienta: `slug`, nombre, descripción para el catálogo, esquema Zod de sus parámetros, puntos de enganche, rol mínimo y **capacidades declaradas** (si sale a internet, si guarda credenciales, qué produce). El catálogo lee del registro; nada se resuelve en tiempo de ejecución desde datos.
- **Catálogo** como sección nueva de `/settings` (`SETTINGS_SECTIONS`, grupo Organización, `ownerOnly`): lista de herramientas disponibles, detalle con lo que hace y sus capacidades en lenguaje llano, botón para agregar y para desactivar.
- **Formulario de parámetros** derivado del esquema Zod del manifiesto, con los valores del tenant.
- **Dos puntos de enganche, lista cerrada:** (a) página propia en `/extensions/<slug>`, con su entrada en una sección «Herramientas» del sidebar; (b) acción en el detalle de pedido (V4).
- `NAV_ENTRIES` pasa a admitir entradas resueltas por organización, además del filtrado por rol que ya hace.
- **Primera herramienta: calculadora de costo de impresión 3D.** Entradas: gramos de filamento y horas de impresión. Parámetros del tenant: precio del filamento por kilo, costo por hora de máquina, margen unitario, margen por mayor. Salidas: costo, precio unitario, precio por mayor. Desde el detalle de pedido puede agregar una línea llamando a la acción de pedidos que ya existe.
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

## Candidatos ya identificados

Postergaciones explícitas que ya están escritas en el backlog original o en sus cambios archivados. **No están comprometidas en este sprint**; se listan para no volver a descubrirlas y para tenerlas a mano si una observación las vuelve urgentes.

| Candidato | Dónde se postergó |
| --- | --- |
| **Herramientas que llaman a servicios de terceros** — una herramienta sale a internet detrás de un puerto al estilo de `lib/email/port.ts` (adaptador real, uno en memoria y uno que falla), degrada de forma honesta sin conexión y su resultado aterriza como adjunto de un registro existente. Herramienta de prueba: generador de llaveros a partir de un PNG. Pendiente de decidir con qué credencial se llama al servicio: si es de cada organización, se mueve al candidato siguiente. | KAM-27, fuera de alcance |
| **Puerta de conexión con otras plataformas** — credencial privada por organización, vínculo entre un ítem del catálogo y su equivalente en un sistema externo, revocación, y la plataforma externa identificada como autor en la bitácora. Caso de uso: publicar productos en Katu. **No es una herramienta más:** guarda un secreto del tenant y deja estado fuera de Kamay que desactivar no revierte. Necesita su propio cambio. | KAM-27, fuera de alcance · especificación v6 §10 (Fase 6) |
| Envío automatizado por WhatsApp (Business API, plantillas aprobadas) en lugar del enlace `wa.me` que abre el WhatsApp de quien manda | KAM-28, fuera de alcance · especificación v6 §10 «deseables después» |
| **Enlace abierto de recepción de pedidos** — un enlace fijo por línea, publicable en redes, que cualquiera puede usar. Trae consigo lo que el enlace dirigido no necesita: validación de humano (captcha), límite de envíos por origen, rotación del enlace, y una carpeta de cuarentena que no puede apoyarse en una solicitud preexistente. | KAM-28, fuera de alcance |
| Asistencia de redacción en otros campos y pantallas: notas de pedido, descripciones de ítems, nombres de producto, mensajes al cliente | KAM-30, fuera de alcance |
| Escribir una descripción desde cero con asistencia, cuando no hay nada escrito | KAM-30, fuera de alcance |
| Credencial de IA propia por organización, en lugar de una sola de la plataforma | KAM-30, fuera de alcance |
| Seguimiento público del estado del pedido para el cliente | KAM-28, fuera de alcance (Fase 6) |
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
| 2026-09-19 | Se comprometió KAM-30 (asistencia de redacción en la descripción de la tarea). Queda fuera del sistema de herramientas de KAM-27 porque no cabe en sus dos puntos de enganche, y establece el puerto para llamar a modelos al estilo de `lib/email/port.ts`. Regla rectora: el asistente propone y la persona acepta; nada se sobrescribe en silencio. |
| 2026-09-19 | Se comprometió KAM-29 (detalle y edición de tareas separados). Reemplaza el requisito vigente «Los campos de la tarea se editan y se guardan uno a uno» (design D3 de KAM-16), así que va como `BREAKING`. Se trazó la línea: el detalle conserva lo que se hace mientras se trabaja —casillas, adjuntos, vínculos, entregables, estado— y la edición reúne los datos que describen la tarea. Queda por confirmar de qué lado vive el editor del cuerpo en Markdown. |
| 2026-09-19 | KAM-28 reducida a **enlaces dirigidos de un solo uso**. Dos consecuencias: el captcha sale del alcance porque el token ya es la puerta, y las dos tablas se fusionan en una sola, porque la solicitud existe antes de que el cliente abra el enlace. Las imágenes se resuelven con un bucket de cuarentena `order-requests` con ruta `<organización>/<solicitud>/`. El enlace abierto y público queda como candidato. |
| 2026-09-19 | Exploración «Herramientas por tenant». Se comprometió KAM-27 (registro, catálogo y calculadora 3D) y bajaron a candidatos las herramientas con servicios de terceros y la puerta de conexión con plataformas externas. Decisiones tomadas: las herramientas son código del repositorio y entran por PR; activación por organización; catálogo igual para todas; ninguna herramienta tiene tablas propias. |

---

*Las tareas de este sprint se ejecutan como cambios de OpenSpec; ninguna se implementa directamente desde este documento.*
