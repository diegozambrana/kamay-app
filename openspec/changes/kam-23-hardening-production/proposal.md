# KAM-23 · Endurecimiento y puesta en producción

## Why

Kamay ya registra pedidos, egresos, cobros, tareas, inventario y activos, avisa lo urgente, rinde informes y guarda la bitácora con retención. Lo que todavía no hace es **aguantar el día que algo falle**: hoy no existe un solo `error.tsx` ni un `loading.tsx` en ninguna de las treinta y ocho rutas, no hay copia de seguridad fuera de Supabase, no hay forma de sacar todos los datos de una vez, no hay dominio ni monitoreo, la retención de la bitácora está construida pero nadie la dispara, y nadie ha probado nunca una restauración. Un taller que apunta sus ventas aquí todos los días está confiando en un sistema del que, si mañana se pierde la base, no se recupera nada.

Este cambio es el que convierte «funciona en mi máquina y en CI» en «el negocio puede depender de esto». No añade funcionalidad de producto: estabiliza los siete recorridos de extremo a extremo, aplica los estados transversales que el mapa de navegación declaró hace veinte tareas y nadie construyó, mide accesibilidad y carga contra un presupuesto, y pone en pie lo operativo —respaldo, restauración probada, exportación completa, trabajos programados, despliegue, monitoreo—.

La ambición se mide en una sola frase: **el día que se pierda la base de datos, el sistema vuelve, y quien lo levanta ya sabe cómo porque lo ensayó.**

> **Posición en la secuencia.** El backlog sitúa a KAM-23 como dependiente de **todas** las tareas anteriores, y **KAM-01 a KAM-22 están archivadas**: la última, KAM-22, el 2026-09-10. El alcance íntegro es ejecutable sin esperar a nada. Cuando esta propuesta se escribió faltaban seis tareas y el plan se partió en dos olas; esa partición ya no aplica y se retiró.

> **Lo que las tareas anteriores dejaron para aquí.** Cinco cambios archivados difirieron trabajo a KAM-23 de forma explícita, y este cambio lo recoge en lugar de redescubrirlo:
> - **KAM-22** construyó y probó la rutina de retención (`RetentionService.run()`) pero **no la programó**, por decisión del usuario: «encender el reloj pertenece a KAM-23» (`supabase/README.md` § Trabajos programados).
> - **KAM-22** dejó las exportaciones de la purga en el bucket `activity-exports`, que **solo lee el service role**: «ofrecerla en la interfaz pertenece a la exportación completa de KAM-23».
> - **KAM-22** dejó anotada una deuda menor: `lib/reports/csv.ts` es genérico pese a su carpeta y «el día que aparezca un tercer consumidor, el movimiento a `lib/export/` se justifica solo». La exportación completa es ese tercer consumidor.
> - **KAM-04** dejó abierto el alta pública: «KAM-23 decidirá si se cierra el alta pública en producción».
> - **KAM-18** dejó pendiente que «la restauración de un volcado se documenta en KAM-23»: restaurar no debe volver a disparar los disparadores de inventario ni de auditoría.
> - **KAM-01** y **KAM-03**/**KAM-04** dejaron aquí el despliegue y la verificación global de RLS y de disparadores de auditoría.

## What Changes

### Los siete recorridos e2e, estables

La suite de `tests/e2e/` tiene hoy **veintisiete archivos**, y los siete recorridos que ARCHITECTURE.md declara obligatorios **ya existen**: `auth`, `order-flow` (el flujo A que el documento llama `order-lifecycle`), `fair-offline`, `task-deliverables`, `assistant-permissions`, `status-config` y `archive-restore`. Lo que falta no es escribirlos, es **cerrarlos y estabilizarlos**:

- **`task-deliverables.spec.ts` distingue dos casos de los tres.** Cubre «crear los seleccionados y cerrar» y «cerrar sin crear nada», pero no separa crear **todos** de crear **algunos**, que es lo que ARCHITECTURE.md pide.
- **`assistant-permissions.spec.ts` no recorre todas las rutas reservadas.** Comprueba `/activity`, `/assets`, `/reports` y `/settings/members`, pero no `/expenses` y sus altas, `/settings/retention`, las demás secciones de configuración reservadas ni las rutas de exportación.
- **Se elimina la intermitencia**, que es un requisito propio y no un efecto secundario: cero `waitForTimeout` arbitrarios —quedan dos—, esperas ancladas a estado observable, aislamiento real entre pruebas y ejecución repetida sin reintentos para demostrar estabilidad, no para suponerla. `playwright.config.ts` fija hoy `retries: 2` en CI, que es exactamente lo que hace que una suite intermitente se vea verde.

### Estados transversales en toda vista con datos

El mapa de navegación §12 los definió una vez para reutilizarlos; en la práctica cada pantalla resolvió lo suyo con un `<p>` distinto —`No hay tareas que mostrar`, `No hay egresos en este periodo`, `No hay contactos que coincidan con los filtros`— y **ninguna resolvió cargando ni error**.

- **Cuatro estados, un solo juego de componentes**, sobre las primitivas que ya están instaladas (`components/ui/empty.tsx`, `components/ui/skeleton.tsx`) y sin inventar un sistema nuevo.
- **Vacío inicial**: mensaje breve y neutro más la acción que corresponde. Sin ilustraciones ni textos motivacionales, tal como el mapa lo prohíbe expresamente.
- **Cargando**: esqueletos con la forma del contenido real, **no giradores**. Entra por `loading.tsx` por segmento de ruta, que hoy no existe en ninguna.
- **Error**: explicación en lenguaje humano y botón de reintentar, nunca un código técnico. Entra por `error.tsx` por segmento, más un `global-error.tsx`.
- **Sin resultados tras filtrar**: distinto del vacío inicial y con **«Quitar filtros»** accionable. Es el criterio 2.

### Accesibilidad

- **Auditoría automática** sobre las vistas principales, integrada en la suite e2e y no como un informe suelto que envejece.
- **Contraste, foco visible, navegación completa por teclado y etiquetas** en formularios, diálogos, los tableros de arrastre y el modo feria.
- Los tableros con `@dnd-kit` necesitan **alternativa de teclado**: mover una tarjeta de columna sin ratón no es un extra, es la condición para que la vista sea usable sin puntero.

### Rendimiento

- **Presupuesto de carga explícito**: el panel principal por debajo de **2 segundos** en un móvil de gama media con **12 meses de datos**, medido sobre una semilla que efectivamente contenga esos doce meses.
- **Listas paginadas**: ninguna vista carga una tabla entera.
- **Imágenes optimizadas** en miniaturas de catálogo, activos y adjuntos.

### Copias de seguridad y restauración probada

- **Copias automáticas con al menos una fuera del sistema**: no basta con lo que Supabase retiene por su cuenta, porque una copia que vive dentro del mismo servicio que puede perderse no es una copia.
- **Restauración ensayada en un entorno limpio**, con el resultado **documentado**: es el criterio 4, el único de todo el backlog que no se satisface escribiendo código sino ejecutando un procedimiento y anotando qué pasó.
- **Restaurar no vuelve a disparar nada**: ni movimientos de inventario duplicados ni eventos de bitácora falsos a nombre de quien restaura. Es lo que KAM-18 dejó pendiente.

### Exportación completa

- **Todas las tablas, bitácora incluida**, disponible en cualquier momento como pide la especificación §9, en **un solo archivo comprimido con un CSV por tabla**. El CSV es el formato que el proyecto ya exporta desde KAM-20 —RFC 4180, BOM para que Excel respete los acentos, cifras sumables— y cada archivo se abre en una hoja de cálculo con doble clic.
- **La bitácora completa, no solo lo que queda en la tabla**: el detalle que la retención ya vació vive únicamente en las exportaciones de la purga, y la exportación completa las incluye tal cual. Por primera vez la persona dueña puede descargarlas.
- **Alcanzada por la organización y por RLS**: la exportación sale con los datos que quien la pide puede ver, no con los de la base. Un ayudante no exporta costos.
- **Sin tope silencioso**: la exportación de la bitácora filtrada de KAM-22 corta a 5.000 filas y lo avisa; la completa no corta, porque un respaldo incompleto es peor que ninguno.

### Trabajos programados

- **La retención de la bitácora se enciende** con un disparo mensual protegido por secreto, por el mismo mecanismo que ya dispara el resumen diario de avisos desde KAM-17. El fallo en una organización no detiene a las demás y queda en el monitoreo.

### Despliegue y operación

- **Despliegue con dominio propio**, variables de entorno separadas por ambiente y el cliente de service role **nunca en el bundle de cliente** —verificado, no supuesto—.
- **El alta pública queda cerrada de verdad**: hoy la pantalla no ofrece registrarse, pero la API de alta sí acepta a cualquiera. Solo podrá crear cuenta quien tenga una invitación vigente.
- **Monitoreo de errores** en servidor y navegador, con las organizaciones distinguibles sin filtrar datos personales al proveedor.
- **Ninguna cabecera de desarrollo llega a producción** y el service worker se invalida correctamente en cada despliegue.

### Verificación del anexo de base de datos

Los doce puntos de la §20 del esquema, comprobados **punto por punto y con prueba donde sea comprobable**. La brecha concreta de hoy: `supabase/tests/` tiene cincuenta y siete pruebas pgTAP y **la única de las que ARCHITECTURE.md enumera que no existe es `views_security.test.sql`**. El criterio 3 la exige y es la comprobación más barata de todo el cambio: una vista sin `security_invoker` se ejecuta con los permisos de quien la creó y evapora RLS en silencio. Hay diez vistas en el esquema y nadie comprueba que la undécima lo declare.

**Fuera de alcance** (copiado del backlog):
- Optimizaciones de escala que este negocio no necesita.
- Panel de métricas de la aplicación.

Derivado de lo anterior, tampoco entran: **ninguna funcionalidad de producto nueva**; el rediseño de vistas ya entregadas más allá de aplicarles sus cuatro estados; la exportación contable y la multi-moneda, que la especificación reserva a fases posteriores; las notificaciones push; la puerta de conexión con plataformas externas; y la reescritura de la exportación filtrada de la bitácora ni la de los informes, que siguen como las dejaron KAM-22 y KAM-20.

## Capabilities

### New Capabilities

- `view-states`: los cuatro estados transversales que toda vista con datos debe presentar —vacío inicial con su acción, cargando con esqueletos de la forma real, error en lenguaje humano con reintento, y sin resultados tras filtrar con «Quitar filtros»— diseñados una vez y reutilizados, con la frontera respecto del indicador de sin conexión que `offline-capture` ya declara.
- `accessibility`: contraste, foco visible, navegación completa por teclado —incluida la alternativa al arrastre en los tableros—, etiquetas de formulario y diálogo, y la auditoría automática que verifica que no haya fallos críticos.
- `performance-budget`: el presupuesto de carga del panel principal en móvil de gama media con doce meses de datos, la paginación obligatoria de toda lista y la optimización de imágenes.
- `data-export`: la exportación completa de todos los datos de la organización, bitácora incluida —también el detalle que la retención ya vació—, alcanzada por RLS y por rol.
- `production-operations`: copias de seguridad automáticas con una fuera del sistema, restauración probada y documentada sin volver a disparar nada, trabajos programados protegidos, alta de cuentas limitada a invitaciones vigentes, despliegue con dominio y variables por ambiente, y monitoreo de errores.

### Modified Capabilities

- `project-foundation`: el arnés pasa de «al menos una prueba de cada nivel» a **los siete recorridos completos de ARCHITECTURE.md pasando de forma estable**, con la ausencia de intermitencia como requisito verificable; se añade `views_security.test.sql` al catálogo pgTAP; y la integración continua suma la auditoría de accesibilidad en cada pull request y la medición de rendimiento en el trabajo de estabilidad.
- `tenant-isolation`: la verificación de aislamiento se extiende del catálogo de tablas al **catálogo de vistas** —toda vista declara `security_invoker`, comprobado automáticamente sobre el catálogo y no vista por vista a mano— y se cierra con la lista de verificación §20 del anexo comprobada punto por punto.
- `activity-retention`: el requisito *La retención solo la ejecuta el sistema, y nunca por sí sola en esta entrega* deja de ser cierto. La rutina sigue sin poder invocarla ningún usuario, pero ahora **corre programada en producción**, y el escenario que exigía documentar por qué no se agendaba se sustituye por los que verifican que sí se agenda.

## Impact

**Código afectado**

- `app/**/loading.tsx`, `app/**/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` — **no existe ninguno hoy**. Uno por segmento de ruta con datos.
- `components/shared/` — el juego único de estados transversales, sobre `components/ui/empty.tsx` y `components/ui/skeleton.tsx` ya instalados.
- `features/*/` — cada pantalla de lista sustituye su mensaje suelto por el componente compartido y distingue vacío inicial de sin resultados.
- `components/board/` — alternativa de teclado al arrastre.
- `lib/export/` — **recibe `lib/reports/csv.ts`**, que pasa a tener tres consumidores, y la composición del archivo comprimido.
- `services/export/` y `app/(app)/settings/export/route.ts` — rebanada nueva, calcada de las rutas de exportación de KAM-20 y KAM-22; la exportación sale por la sesión del usuario, jamás con service role.
- `app/api/activity/retention/route.ts` — el punto de entrada programado de la retención, calcado de `app/api/notifications/daily/route.ts`.
- `vercel.json` — el disparo mensual de la retención junto al resumen diario que ya está.
- `supabase/tests/views_security.test.sql` y los controles de catálogo del anexo §20.
- `.github/workflows/` — la auditoría de accesibilidad en la secuencia y el trabajo de estabilidad aparte.
- `next.config.ts` — imágenes y cabeceras de producción.
- `.env.example` — las variables de producción que aún no figuran.
- `supabase/README.md` y `docs/` — el procedimiento de restauración con su acta de ensayos y el de retención ya encendida.

**Se lee pero no se modifica:** `services/activity/retention-service.ts`, cuya rutina se programa tal como KAM-22 la dejó; `app/api/notifications/daily/route.ts`, como patrón del disparo con secreto; `lib/supabase/`, cuya separación de clientes es lo que la verificación de despliegue comprueba.

**Base de datos:** **no se altera ninguna tabla, vista ni índice existente.** Entran dos migraciones nuevas, cada una con su pgTAP (convención nº 6):
- Una política de lectura sobre `storage.objects` para el bucket `activity-exports`, limitada a la persona dueña de la organización de la carpeta, para que la exportación completa incluya la purga sin usar service role.
- El hook de Auth *before user created*: una función que rechaza toda alta cuyo correo no tenga una invitación vigente.
Si la verificación de la §20 descubre un incumplimiento, la corrección entra también como migración nueva y con su pgTAP, nunca editando una existente.

**Dependencias nuevas previstas:** una biblioteca pequeña de compresión para el archivo de exportación, una herramienta de auditoría de accesibilidad integrable en Playwright y un SDK de monitoreo de errores.

**Pruebas:** los siete recorridos e2e cerrados y estables; auditoría de accesibilidad automatizada; `views_security.test.sql` y los controles de catálogo en pgTAP; pgTAP de la política de `activity-exports` y del hook de alta; unitarias sobre la composición de la exportación; integración sobre la exportación por rol y por organización y sobre el disparo de la retención; y una medición de carga del panel contra la semilla de doce meses.

## Supuestos registrados

1. **El alcance íntegro se ejecuta en una sola pasada.** Cuando se propuso, KAM-17 a KAM-22 no existían y el plan se partió en una ola ejecutable y otra bloqueada. Las seis se archivaron entre el 2026-09-08 y el 2026-09-10; la partición se retiró y `tasks.md` ya no tiene grupos bloqueados.

2. **La aplicación no tiene ni un solo `error.tsx` ni `loading.tsx`.** Comprobado sobre las treinta y ocho rutas de `app/`. Los estados de carga y error no están «a medias»: no están.

3. **Los siete recorridos existen; lo que falta es cerrarlos.** `order-flow.spec.ts` cubre el flujo A que ARCHITECTURE.md nombra `order-lifecycle`; se conserva el nombre del repositorio, porque el contrato es el recorrido, no el archivo.

4. **`views_security.test.sql` es la única prueba pgTAP declarada que falta.** Se escribe contra el catálogo (`pg_class.reloptions`), no contra una lista de vistas escrita a mano: una lista se olvida de actualizar, el catálogo no.

5. **La exportación sale por RLS, nunca con service role.** «Todas las tablas» significa todas las que quien exporta puede leer. Por eso las exportaciones de la purga necesitan una política de Storage para la persona dueña, y no una lectura con la clave de servicio tras comprobar el rol a mano: comprobar el rol a mano es exactamente la disciplina que RLS existe para no tener que recordar.

6. **Formato: un archivo comprimido con un CSV por tabla. — DECISIÓN DEL USUARIO.** Se descartó el libro `.xlsx` con una hoja por tabla: habría puesto un segundo serializador junto a `toCsv()` —lo que KAM-22 rechazó expresamente— y obligado a convertir en hojas las exportaciones de la purga, que ya son CSV. El archivo comprimido las lleva tal cual y reutiliza el serializador que ya funciona.

7. **«Al menos una fuera del sistema» excluye la retención propia de Supabase como única copia.** Una copia alojada en el mismo servicio que puede perderse cubre el borrado accidental, no la pérdida del proveedor.

8. **La restauración probada es un procedimiento ejecutado y documentado, no un script escrito.** El entregable incluye el registro de haberlo corrido.

9. **El objetivo de accesibilidad es «sin fallos críticos», que es lo que el backlog pide, y no la conformidad WCAG completa.** Ningún documento de producto fija un nivel de conformidad. Se toma como umbral el nivel AA de contraste, que es el que la auditoría automática mide, y los hallazgos no críticos se registran sin bloquear el cambio.

10. **El proveedor de despliegue ya lo fijó el proyecto.** Los PRD no nombran ninguno, pero KAM-17 dejó `vercel.json` con el disparo del resumen diario y el correo transaccional provisionado por el Marketplace de Vercel. Se despliega ahí y los trabajos programados usan ese mismo mecanismo. Queda sin fijar el proveedor de monitoreo, que no cambia ni las pruebas ni las tareas.

11. **El alta pública se cierra con un hook según invitación. — DECISIÓN DEL USUARIO.** El alta de invitados usa `auth.signUp()` desde el navegador del invitado; cerrar el alta del proveedor por completo rompería ese camino, y crear la cuenta con la API de administración exigiría service role en una acción de usuario (convención nº 2). El hook *before user created* deja la puerta abierta solo a quien trae una invitación vigente, sin privilegio elevado en la aplicación. Se descartó dejar el alta abierta con el argumento de KAM-04 —una cuenta sin membresía no ve nada—: es cierto, pero deja crear cuentas vacías sin límite.
