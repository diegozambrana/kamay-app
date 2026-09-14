# Kamay · Manual de pruebas (QA)

> Cómo probar la plataforma a mano, qué resultado esperar en cada caso y cómo apoyarse en las pruebas automáticas. Está pensado para un equipo de QA que no conoce el código.
>
> Documentos relacionados: [Manual de uso](manual-de-uso.md) (describe cada pantalla) · [Estado de la plataforma](estado-de-la-plataforma.md) (lo que se sabe que falta) · [Documento técnico](documento-tecnico.md).

## Índice

1. [Alcance y criterios](#1-alcance-y-criterios)
2. [Entorno de pruebas](#2-entorno-de-pruebas)
3. [Convenciones de este manual](#3-convenciones-de-este-manual)
4. [Lista de comprobación transversal](#4-lista-de-comprobación-transversal)
5. [Casos de prueba por módulo](#5-casos-de-prueba-por-módulo)
   - [AUT · Autenticación y organizaciones](#aut--autenticación-y-organizaciones)
   - [NAV · Navegación y cascarón](#nav--navegación-y-cascarón)
   - [PAN · Panel](#pan--panel)
   - [REG · Registro rápido](#reg--registro-rápido)
   - [PED · Pedidos](#ped--pedidos)
   - [COB · Cobros y pagos](#cob--cobros-y-pagos)
   - [FER · Venta rápida / modo feria](#fer--venta-rápida--modo-feria)
   - [TAR · Tareas](#tar--tareas)
   - [PEN · Mis pendientes](#pen--mis-pendientes)
   - [EGR · Egresos](#egr--egresos)
   - [CAT · Catálogo](#cat--catálogo)
   - [INV · Inventario](#inv--inventario)
   - [CON · Contactos](#con--contactos)
   - [ACT · Activos](#act--activos)
   - [REP · Reportes](#rep--reportes)
   - [BIT · Bitácora](#bit--bitácora)
   - [NOT · Notificaciones](#not--notificaciones)
   - [CFG · Configuración](#cfg--configuración)
   - [OFF · Sin conexión](#off--sin-conexión)
   - [ROL · Permisos del ayudante](#rol--permisos-del-ayudante)
6. [Pruebas automáticas](#6-pruebas-automáticas)
7. [Plantilla para reportar un defecto](#7-plantilla-para-reportar-un-defecto)

---

## 1. Alcance y criterios

Este manual cubre **todas las vistas** de la aplicación (V1 a V23 del mapa de navegación) en los dos roles, en escritorio y en móvil, con y sin conexión.

Criterios generales de aceptación que aplican a cualquier caso:

- Ningún texto visible en inglés, ningún identificador técnico (UUID, nombres de columna) salvo donde el manual lo indique como conocido.
- Ninguna operación **borra** datos: siempre archiva, anula o cancela.
- Un usuario **nunca** ve datos de otra organización.
- El ayudante **nunca** ve montos de egresos, costos, activos ni bitácora.
- Una pantalla que falla al cargar muestra un error en lenguaje humano con **Reintentar**, nunca una pantalla en blanco ni un volcado técnico.

---

## 2. Entorno de pruebas

### 2.1 Local (recomendado)

Requisitos: Docker, Node.js, Supabase CLI. Puesta en marcha (detalle en el [documento técnico](documento-tecnico.md#3-puesta-en-marcha)):

```bash
supabase start
```

```bash
supabase db reset
```

```bash
npm run dev
```

La aplicación queda en `http://localhost:3010`. Servicios auxiliares:

| Servicio | Dirección | Para qué |
| --- | --- | --- |
| Aplicación | http://localhost:3010 | Pruebas manuales |
| Supabase Studio | http://127.0.0.1:54423 | Inspeccionar tablas |
| Mailpit | http://127.0.0.1:54424 | Leer los correos de recuperación de contraseña |

`supabase db reset` **devuelve la base a su estado inicial** (borra lo que se haya registrado en pruebas). Úsalo al empezar una ronda.

### 2.2 Cuentas de prueba

Todas con contraseña `kamay123`.

| Correo | Rol | Organización | Uso |
| --- | --- | --- | --- |
| `geeko@kamay.test` | Dueña | Geeko Store | Cuenta principal, con datos de ejemplo |
| `ayudante@kamay.test` | Ayudante | Geeko Store | Pruebas de permisos |
| `multi@kamay.test` | Dueño | Taller Kamay y Kamay Feria | Selección de organización |
| `owner@kamay.test` | Dueño | Taller Kamay | Organización sin datos |
| `historico@kamay.test` | Dueño | Kamay Histórico | Doce meses de datos, para rendimiento |
| `superadmin@kamay.test` | Administrador de la plataforma | Ninguna (ve todas) | Vistas *Organizaciones* y *Usuarios*, selector de organización |

Geeko Store trae cuatro líneas (Sublimación, Impresión 3D, Alfarería, General), pedidos #1 a #10 con distintos estados de cobro, compras y gastos, insumos bajo mínimo y un activo (*Prensa de tazas*).

### 2.3 Dispositivos y navegadores

- **Escritorio**: Chrome a 1280 px de ancho o más.
- **Móvil**: Chrome con emulación de un teléfono de 390–412 px (Pixel 7 o similar) o un teléfono real. Varios comportamientos cambian por ancho de pantalla (barra inferior, aterrizaje en `/quick`, vista por defecto en pedidos).
- Repetir los casos marcados con 🌙 en **tema oscuro**.

---

## 3. Convenciones de este manual

Cada caso tiene:

- **ID**: módulo + número (por ejemplo `PED-03`).
- **Rol**: con qué cuenta probar. Si no se indica, con la dueña.
- **Precondición**, **Pasos** y **Resultado esperado**.
- Prioridad: **P0** (bloquea el uso), **P1** (funcionalidad principal), **P2** (secundario).

Las capturas de `docs/capturas/` muestran el aspecto esperado de cada pantalla con los datos semilla.

---

## 4. Lista de comprobación transversal

Aplicar a **cada vista con datos** (pedidos, tareas, egresos, catálogo, contactos, activos, reportes, bitácora, mis pendientes, configuración):

| # | Comprobación | Resultado esperado |
| --- | --- | --- |
| T1 | Entrar a la vista con una organización sin datos (`owner@kamay.test`) | Estado vacío con texto explicativo y, cuando aplica, un botón de acción (*Crear pedido*, *Crear el primer ítem*…). Nunca una tabla vacía sin mensaje. |
| T2 | Filtrar hasta no obtener resultados | Mensaje *Sin resultados* distinto del vacío inicial, con botón **Quitar filtros** que limpia también el campo de búsqueda. |
| T3 | Recargar la vista | Aparece un esqueleto de carga con la forma del contenido (no una rueda giratoria). |
| T4 | Simular fallo de red (DevTools › Network › Offline) y navegar a otra vista | Página **Sin conexión** con el texto que explica que lo registrado se guarda en el dispositivo. |
| T5 | Móvil a 390 px | Ningún desplazamiento horizontal de la página; el tablero se desplaza dentro de sí mismo. |
| T6 | Navegación por teclado (Tab) | El foco es visible en todos los controles; los diálogos se cierran con Escape. |
| T7 | 🌙 Tema oscuro | Contraste legible en tablas, badges y gráficos. |
| T8 | Abrir una dirección inexistente (`/loquesea`) o un registro de otra organización | Página *no encontrado* con salida al inicio; nunca información de que el registro existe en otra organización. |

---

## 5. Casos de prueba por módulo

### AUT · Autenticación y organizaciones

| ID | P | Precondición | Pasos | Resultado esperado |
| --- | --- | --- | --- | --- |
| AUT-01 | P0 | Sin sesión | Abrir `/dashboard` | Redirige a `/auth/login?next=%2Fdashboard`. |
| AUT-02 | P0 | Sin sesión | Entrar con `geeko@kamay.test` / `kamay123` en escritorio | Aterriza en `/dashboard`, con el menú lateral y el nombre *Geeko Store* en la barra superior. |
| AUT-03 | P0 | Sin sesión, móvil | Igual que AUT-02 | Aterriza en `/quick` con la barra inferior de cuatro ranuras (Inicio, Pedidos, Tareas, Más). |
| AUT-04 | P1 | Sin sesión | Correo válido y contraseña incorrecta | Mensaje *Correo o contraseña incorrectos.* Sin pistas de si el correo existe. |
| AUT-05 | P1 | Sin sesión | Correo mal formado o contraseña de menos de 6 caracteres | Validación en el campo: *Ingresa un correo válido.* / *La contraseña debe tener al menos 6 caracteres.* |
| AUT-06 | P1 | Sin sesión | Abrir `/quick` sin sesión, entrar | Después de entrar vuelve a `/quick` (respeta `next`). |
| AUT-07 | P1 | — | Entrar con `multi@kamay.test` | Pantalla **Elige una organización** con dos botones. Elegir uno lleva al panel de esa organización. |
| AUT-08 | P1 | — | **¿Olvidaste tu contraseña?** → correo `geeko@kamay.test` → **Enviar enlace** | Mensaje neutro *Si el correo está registrado…*; en Mailpit llega un correo con enlace. Abrirlo lleva a **Nueva contraseña**; guardar una nueva permite entrar con ella. |
| AUT-09 | P1 | — | Repetir AUT-08 con un correo inexistente | Exactamente el mismo mensaje neutro; no llega correo. |
| AUT-10 | P1 | — | Abrir `/auth/reset-password` directamente | Vuelve a `/auth/login` con *El enlace no es válido o ya expiró.* |
| AUT-11 | P0 | Dueña en Configuración › Usuarios y roles | Invitar `nuevo@ejemplo.com` como Ayudante, copiar el enlace, abrirlo en una ventana de incógnito, crear cuenta con ese correo y una contraseña | Entra directo al panel de Geeko Store como ayudante. La invitación desaparece de *pendientes* y la persona aparece en *Equipo*. |
| AUT-12 | P0 | — | Abrir el mismo enlace de invitación por segunda vez | *La invitación no es válida o ya fue utilizada.* |
| AUT-13 | P0 | — | Intentar crear una cuenta desde el enlace con un correo **distinto** al invitado | *No se pudo crear la cuenta con ese correo.* No se crea cuenta (no existe registro público). |
| AUT-14 | P1 | Sesión iniciada | Borrar cookies del sitio y recargar | Vuelve al inicio de sesión (no hay botón de cerrar sesión: comportamiento conocido). |

### NAV · Navegación y cascarón

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| NAV-01 | P1 | Recorrer las 11 entradas del menú lateral con la dueña | Cada una abre su pantalla y queda marcada como activa. |
| NAV-02 | P1 | Abrir el selector de línea, elegir **Sublimación**, ir a Pedidos, Tareas, Egresos, Catálogo | La línea elegida se mantiene en todas las pantallas y aparece en el selector. |
| NAV-03 | P1 | Con Sublimación elegida, cerrar el navegador y volver a entrar | La línea sigue seleccionada (se guarda por organización, un año). |
| NAV-04 | P1 | Elegir **Todas** | Pedidos y tareas en tablero piden elegir una línea; lista y calendario muestran todo. |
| NAV-05 | P1 | Pulsar el icono de tema | Cambia a oscuro; recargar mantiene el tema. 🌙 |
| NAV-06 | P1 | Móvil: pulsar **Más** | Panel inferior con el resto de secciones del rol; elegir una lo cierra y navega. |
| NAV-07 | P1 | Móvil: abrir `/orders/new` | La barra inferior y el botón **+** no aparecen; **Guardar** y **Cancelar** están visibles sin desplazarse. |
| NAV-08 | P2 | Pulsar el icono junto al nombre de la organización | El menú lateral se pliega a iconos con tooltips; el estado se recuerda al recargar. |
| NAV-09 | P1 | Pulsar el botón **+** en el panel | Hoja **Registrar** con seis accesos (cuatro para el ayudante). |

### PAN · Panel

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| PAN-01 | P1 | Entrar como dueña con línea *Todas* | Tarjetas **Ingresos**, **Egresos**, **Margen**, **Por cobrar**; **Comparativo por línea**; **Entregas próximas**; **Últimos movimientos**; **Pendientes**; **Insumos bajo mínimo** (ver `capturas/panel.png`). |
| PAN-02 | P1 | Elegir la línea Sublimación | Ingresos, egresos, comparativo y entregas se limitan a la línea; **Pendientes** no cambia (ignora la línea a propósito). |
| PAN-03 | P1 | Pulsar una entrega, un insumo, un movimiento | Abren el pedido, el ítem y el registro correspondiente. |
| PAN-04 | P1 | Registrar un cobro de 100 en un pedido de Sublimación (COB-01) y volver al panel | **Ingresos** de la línea suben 100 y **Por cobrar** baja 100. |
| PAN-05 | P0 | Entrar como `ayudante@kamay.test` | Panel **sin ninguna cifra de dinero**: solo Entregas próximas, Pendientes e Insumos bajo mínimo (ver `capturas/ayudante-panel.png`). |
| PAN-06 | P2 | Entregas próximas con un pedido de fecha pasada | Fila con la marca roja **Vencido**. |
| PAN-07 | P2 | Entrar con `historico@kamay.test` en móvil emulando 4G lento | El panel se pinta en menos de 2 s en visita repetida (la primera en frío puede tardar más; ver estado de la plataforma). |

### REG · Registro rápido

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| REG-01 | P1 | Abrir `/quick` con la dueña | Seis accesos: Venta rápida, Pedido, Compra, Gasto, Consumo, Tarea; lista **Registrado hoy**. |
| REG-02 | P1 | Con el ayudante | Solo cuatro accesos: sin **Compra** ni **Gasto**. |
| REG-03 | P1 | Pulsar cada acceso | Venta rápida → `/fair`; Pedido → `/orders/new`; Compra → `/expenses/purchases/new`; Gasto → `/expenses/costs/new`; Consumo → diálogo sin salir de la pantalla; Tarea → `/tasks/new`. |
| REG-04 | P1 | Registrar un consumo y volver a `/quick` | Aparece en **Registrado hoy** con tipo *Consumo*, línea y hora. Máximo 5 filas. |
| REG-05 | P2 | Sin datos del día | *Todavía no registraste nada hoy.* |

### PED · Pedidos

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| PED-01 | P1 | Línea Sublimación, vista **Tablero** | Columnas *Registrado, En diseño, En cola, Sublimando, Listo para entrega, Entregado, Cancelado* con contador; tarjetas con número, cliente, líneas, fecha, entrega, estado de cobro y total (ver `capturas/pedidos-tablero.png`). |
| PED-02 | P1 | Cambiar a línea Alfarería | Las columnas cambian a las de Alfarería (*Reservado, Listo para entrega, Entregado, Cancelado*). |
| PED-03 | P1 | Vista **Lista** y **Calendario** con *Todas* | Ambas muestran pedidos de todas las líneas; el calendario tiene la sección *Sin fecha comprometida* y marca **Hoy**. La vista elegida queda en la URL (`?view=`). |
| PED-04 | P1 | Buscar `María` | Solo pedidos de esa clienta. Buscar `zzz` → *Sin resultados* con **Quitar filtros**. |
| PED-05 | P0 | **Nuevo pedido**: línea Sublimación, cliente *María Céspedes*, producto *Taza personalizada* (elegir variante), cantidad 2, fecha *Mañana*, Recojo, **Guardar** | Abre el detalle con el siguiente número correlativo, estado *Registrado*, total = 2 × precio, badge **Sin cobrar**. La bitácora registra *registró el pedido*. |
| PED-06 | P1 | Nuevo pedido sin cliente ni líneas, **Guardar** | *Elige o crea un cliente* y *Agrega al menos una línea*; no se guarda. |
| PED-07 | P1 | Nuevo pedido con cliente nuevo: escribir `Cliente Prueba`, **Crear «Cliente Prueba»**, teléfono opcional, **Crear** | Queda seleccionado sin perder el formulario; después existe en Contactos como *Cliente*. |
| PED-08 | P1 | **Línea libre** sin descripción | *Una línea sin producto necesita una descripción*. |
| PED-09 | P1 | Cambiar la línea de negocio después de agregar un producto de otra línea | Aviso *Se quitó una línea que no pertenece a esta línea de negocio.* |
| PED-10 | P1 | **Guardar y crear otro** | Aviso *Pedido #N guardado. Puedes registrar otro.*; conserva línea y canal; limpia cliente, líneas, fecha y nota. |
| PED-11 | P1 | Escribir algo y pulsar **Cancelar** | Diálogo *¿Descartar los cambios?* → **Seguir editando** mantiene todo; **Descartar** vuelve al tablero. Sin cambios, Cancelar sale sin preguntar. |
| PED-12 | P1 | Arrastrar un pedido de *En diseño* a *En cola* | Se mueve al instante, recibe posición de cola; la bitácora registra *cambió el estado*. En móvil, un toque corto abre el pedido y no lo mueve. |
| PED-13 | P1 | Menú de la tarjeta → *Mover a* → otra columna | Mismo resultado que arrastrar. |
| PED-14 | P1 | En *En cola*, arrastrar el #3 encima del #1 | Las posiciones se renumeran (#3 pasa a 1). |
| PED-15 | P1 | Pedido con fecha comprometida pasada en columna *En diseño* | Icono rojo **Retrasado**. Moverlo a *Listo para entrega* o *Entregado* quita la marca (los estados en espera y finales no cuentan como retraso). |
| PED-16 | P1 | Detalle → selector **Estado** → *Sublimando* | Cambia y aparece en el historial. Solo se ofrecen estados de la línea del pedido. |
| PED-17 | P1 | **Cancelar pedido** → confirmar | Pasa a *Cancelado*, sigue visible y editable, historial intacto. El botón desaparece cuando ya está cancelado. |
| PED-18 | P1 | **Editar**: cambiar cantidad, quitar una línea, agregar imagen (JPG < 5 MB), **Guardar** | Total recalculado; la línea quitada no aparece; la imagen se ve como miniatura en **Imágenes de referencia**. La línea de negocio y el estado no son editables. |
| PED-19 | P2 | Editar: subir un archivo que no sea imagen o mayor de 5 MB | *El archivo tiene que ser una imagen.* / *La imagen no puede pesar más de 5 MB.* |
| PED-20 | P1 | **Crear tarea para este pedido** | Formulario de tarea con título *Diseñar arte pedido #N*, línea del pedido, fecha límite 3 días antes de la entrega y casilla *Vincular con el pedido #N* marcada. Guardar crea la tarea; el pedido la muestra en **Tareas relacionadas**. |
| PED-21 | P0 | Mover un pedido por todos sus estados hasta *Entregado* | **No** se crea ninguna tarea automáticamente. |
| PED-22 | P1 | Historial → **Ver cambio** en una edición | Se muestran solo los campos que cambiaron, con antes y después. |
| PED-23 | P1 | Marcar **Ver archivados** | Aparecen pedidos archivados atenuados con badge **Archivado** (usar la bitácora para archivar/desarchivar; no hay botón en el detalle: comportamiento conocido). |
| PED-24 | P2 | Ayudante abre el detalle de un pedido | Ve todo salvo el bloque **Historial**; puede cambiar estado, editar y registrar cobros. |
| PED-25 | P2 | Pie de la lista con más de 50 pedidos cerrados | *Se muestran todos los pedidos abiertos y los 50 cerrados más recientes* con **Mostrar más**. |

### COB · Cobros y pagos

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| COB-01 | P0 | Pedido #1 (total 190, cobrado 60) → **Registrar cobro** → monto propuesto 130 → **Registrar** | Saldo 0, badge **Pagado**, movimiento listado con fecha y forma de pago. |
| COB-02 | P1 | Registrar cobro de 50 en un pedido con saldo 30 | Aviso *Este cobro excede el saldo pendiente en 20…*; se permite; saldo −20 en azul; badge **Cobrado de más**. |
| COB-03 | P1 | Monto 0 o vacío | *Escribe un monto mayor que cero*. |
| COB-04 | P1 | Dueña: **Anular** un cobro → confirmar | Movimiento tachado con badge **Anulado**; saldo vuelve a subir; bitácora con el cobro y su anulación. |
| COB-05 | P0 | Ayudante: abrir el mismo pedido | Puede **Registrar cobro**; **no** ve el botón **Anular**. |
| COB-06 | P1 | Egreso (dueña) → **Registrar pago** | Mismo diálogo en sentido de pago; **Por pagar** de la bandeja de egresos baja. |
| COB-07 | P1 | Pedido archivado | El botón **Registrar cobro** no aparece. |
| COB-08 | P2 | Panel después de COB-01 | **Ingresos** del mes incluye el cobro. |

### FER · Venta rápida / modo feria

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| FER-01 | P1 | Registro rápido → **Venta rápida** con línea *Todas* | Pantalla **Abrir la feria** sin menú ni barras; selector de línea y canal; **Empezar a vender**. Solo existe el enlace **Salir del modo feria**. |
| FER-02 | P1 | Con una línea ya elegida globalmente | Se salta el paso de apertura (o solo pide canal) y muestra la cuadrícula. |
| FER-03 | P0 | Tocar *Taza personalizada* dos veces y *Bolsa de regalo* una | Carrito: `2 × Taza personalizada`, `1 × Bolsa de regalo`, *3 unidades*, total correcto; **Cobrar** habilitado. |
| FER-04 | P0 | **Cobrar** → **Confirmar** con el monto propuesto y Efectivo | La hoja se cierra y el carrito se vacía en menos de 1 s; la venta aparece en **Registrado hoy** de `/quick` como *Venta rápida* y en la bitácora; **no** aparece en el tablero de pedidos; el panel suma el ingreso. |
| FER-05 | P1 | Cobrar con monto 0 | Se registra la venta sin cobro (queda *Sin cobrar* en ingresos por cobrar). |
| FER-06 | P1 | Cobrar con monto menor al total | Venta con **Anticipo**. |
| FER-07 | P1 | Quitar una línea con la **X** del carrito | Desaparece y el total baja. |
| FER-08 | P0 | Abrir la feria con red, activar modo avión, vender 3 veces, volver a activar la red | Cada venta se confirma al instante; el indicador de *ventas por sincronizar* muestra 3 y vuelve a 0 al reconectar; en la bitácora hay exactamente 3 ventas con la **hora real** en que se hicieron; ninguna duplicada. |
| FER-09 | P1 | Sin red y sin haber abierto la feria antes en ese navegador | Mensaje *Para vender sin señal, abre la feria una vez con conexión…* |
| FER-10 | P1 | Línea sin productos con precio (por ejemplo Impresión 3D) | *Esta línea no tiene productos con precio de venta…* |
| FER-11 | P1 | Ayudante | Puede atender la feria completa. |
| FER-12 | P1 | **Salir del modo feria** | Vuelve a `/quick`. |

### TAR · Tareas

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| TAR-01 | P1 | `/tasks` con línea Alfarería, **Tablero** | Columnas del flujo de tareas de la organización (*Por hacer, Haciendo, En revisión, Hecho*) con contador. |
| TAR-02 | P1 | Con *Todas* | Aviso *Elige una línea para ver el tablero*; **Lista** y **Calendario** sí muestran todas. |
| TAR-03 | P0 | **Nueva tarea** (alta rápida) → escribir `Probar horno` → Enter | Aparece en *Por hacer* de la línea activa; el campo se vacía y conserva el foco. Escape cierra. |
| TAR-04 | P1 | `/tasks/new` completo: título, línea, responsable, fecha límite, etiqueta nueva `hornada-07` | Se crea y vuelve al tablero. Crear otra con etiqueta `Hornada-07` reutiliza la misma etiqueta. |
| TAR-05 | P1 | Guardar sin título o sin línea | *Escribe un título para la tarea* / *Elige una línea de negocio*. |
| TAR-06 | P1 | Arrastrar de *Haciendo* a *Por hacer* | Permitido (mover hacia atrás es válido). |
| TAR-07 | P1 | Filtros: Responsable, Etiqueta, Estado, Vínculo, *Cerradas sin entregables*, *Ver archivadas* | Cada filtro reduce las tarjetas y queda en la URL; combinarlos hasta cero muestra *Ninguna tarea coincide…* con quitar filtros. |
| TAR-08 | P1 | Detalle: cambiar el título y salir del campo | Se guarda solo; recargar lo conserva. Vaciarlo → *El título no puede quedar vacío.* |
| TAR-09 | P1 | Detalle: fijar **Recordatorio** sin fecha límite | *Primero ponle una fecha límite…* Quitar la fecha límite borra el recordatorio. |
| TAR-10 | P1 | **Descripción**: escribir `**negrita** y - [ ] casilla`, **Vista previa**, **Guardar descripción** | La vista previa muestra negrita y una casilla; marcar la casilla actualiza la descripción guardada. Con cambios sin guardar aparece *Hay cambios sin guardar* y las casillas no se pueden marcar. |
| TAR-11 | P1 | **Adjuntos**: subir una foto de 3 MB y un PDF | Ambos aparecen; la foto se comprime (miniatura ligera). Quitar uno lo retira y libera espacio (queda *Quedan 15 de 15* al quitar todos). |
| TAR-12 | P1 | Subir 16 archivos o uno de 6 MB | *Esta tarea ya tiene 15 adjuntos…* / *Un adjunto no puede pesar más de 5 MB.* El lote se rechaza completo. |
| TAR-13 | P1 | **Vínculos**: buscar `María` y vincular el contacto; buscar `#1` y vincular el pedido | Aparecen con su tipo y estado actual; el pedido #1 muestra la tarea en **Tareas relacionadas**. Quitar el vínculo lo retira. |
| TAR-14 | P1 | Ayudante en Vínculos | No puede buscar ni vincular **activos**. |
| TAR-15 | P0 | **Entregables**: declarar *Nuevo proveedor* y *Gastos registrados*; mover la tarea a *Hecho* | Se abre **Cerrar la tarea** con dos secciones. Marcar *Nuevo proveedor* con nombre `Arcillas del Sur` y **Crear seleccionados y cerrar** → la tarea queda en *Hecho*, el proveedor existe en Contactos, el entregable muestra **Creado** y el otro sigue pendiente. |
| TAR-16 | P0 | Repetir con **Cerrar sin crear nada** | La tarea cierra sin pedir justificación; queda marcada *cerrada sin entregables* y aparece con el filtro correspondiente. |
| TAR-17 | P1 | Declarar *Nuevo activo* como ayudante | No se ofrece / *Solo la persona dueña declara un activo.* |
| TAR-18 | P1 | Cerrar una tarea vinculada a un pedido | El **pedido no cambia de estado**. |
| TAR-19 | P2 | Ayudante con líneas restringidas (marcar solo Alfarería en Configuración) | Solo ve tareas de Alfarería, de General y las asignadas a él. |
| TAR-20 | P2 | Historial de la tarea como ayudante | *No hay historial que mostrar.* (nunca un error). |

### PEN · Mis pendientes

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| PEN-01 | P1 | Crear tareas asignadas a ti con fecha ayer, hoy, en 3 días y sin fecha; abrir `/my-tasks` | Cada una en su grupo: **Vencidas**, **Hoy**, **Próximos 7 días**, **Sin fecha**, con badge de línea. Ignora el selector de línea. |
| PEN-02 | P1 | Pulsar ✓ en una tarea | Queda tachada en su sitio (no desaparece); el botón pasa a *Deshacer*. En el tablero está en el estado final. |
| PEN-03 | P1 | Reloj (**Posponer a mañana**) en una vencida | Pasa al grupo **Próximos 7 días** con fecha de mañana. |
| PEN-04 | P1 | Móvil: deslizar una fila a la izquierda | Pospone a mañana. |
| PEN-05 | P1 | Campo de fecha (**Reprogramar**) | Cambia la fecha límite y de grupo. |
| PEN-06 | P2 | Buscar `zzz` | *Ninguna tarea coincide con lo que buscas.* |
| PEN-07 | P2 | Panel → tarjeta **Pendientes** | Cuenta lo mismo que esta pantalla (vencidas / hoy / 7 días). |

### EGR · Egresos

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| EGR-01 | P0 | Ayudante abre `/expenses` por URL | Redirige al panel; la entrada **Egresos** no está en su menú. |
| EGR-02 | P1 | Dueña, `/expenses` con Sublimación y mes actual | Resumen **Compras / Gastos / Total del periodo**; tabla con fecha, tipo, proveedor o categoría, línea y monto (ver `capturas/egresos-lista.png`). |
| EGR-03 | P1 | Filtros Tipo, Proveedor, Categoría, Desde/Hasta | Cada uno reduce las filas y queda en la URL; a cero → *Ningún egreso coincide…* |
| EGR-04 | P0 | **Nueva compra**: proveedor *Distribuidora Andina*, insumo *Papel de transferencia* cantidad 10 precio 90, línea Sublimación, **Guardar** | Detalle con total 900, **Sin pagar**. En el ítem *Papel de transferencia* aparece un movimiento **Entrada por compra +10** y el precio 90 en *Evolución de precios*. |
| EGR-05 | P1 | Compra sin proveedor o sin insumos | *Elige o crea un proveedor.* / *Agrega al menos un insumo*. |
| EGR-06 | P1 | Compra con proveedor nuevo escrito al vuelo | **Crear «nombre»** → queda seleccionado; existe luego como *Proveedor* en Contactos. |
| EGR-07 | P1 | Compra que incluye la máquina *Prensa de tazas* (ítem tipo Activo) | Al guardar se ofrece **Declarar activo** con costo y fecha prellenados; aceptar marca esa compra como adquisición; declinar no deshace la compra. |
| EGR-08 | P0 | **Nuevo gasto**: monto 35, categoría *Transporte*, con línea *Todas* | **General** viene preseleccionada; guardar en 5 interacciones o menos; aparece en la bandeja con *Todas* y no con Sublimación. |
| EGR-09 | P1 | Gasto con **Asignar a un pedido** #1 | El reporte de rentabilidad del pedido #1 muestra ese costo. |
| EGR-10 | P1 | Detalle → **Adjuntar comprobante** (JPG) | Miniatura visible. Un PDF → *Formato no admitido…* |
| EGR-11 | P1 | Detalle de un gasto → **Mantenimiento de un activo** → *Prensa de tazas* | En `/assets`, el mantenimiento del activo sube y la recuperación baja. |
| EGR-12 | P1 | **Archivar** un egreso → confirmar | Badge **Archivado**; desaparece de la bandeja salvo con *Ver archivados*; **Desarchivar** lo restaura; los pagos quedan congelados mientras está archivado. |

### CAT · Catálogo

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CAT-01 | P1 | `/catalog`, pestañas Insumos / Productos / Activos | Tabla con foto, nombre, unidad, precio de venta y línea; insumos bajo mínimo con badge. |
| CAT-02 | P1 | Buscar `sublimacion` (sin tilde) | Encuentra *Taza para sublimación*. |
| CAT-03 | P0 | **Nuevo ítem**: nombre `Llavero`, tipo Producto, línea Sublimación, precio 15, foto | Aparece en Productos con miniatura. Detalle muestra los datos. |
| CAT-04 | P1 | Nombre repetido | *Ya existe un registro con ese nombre.* |
| CAT-05 | P1 | Detalle → **Agregar variante** `Grande` precio 20; luego otra `Grande` | La primera aparece en Variantes; la segunda → *Ese ítem ya tiene una variante con ese nombre.* |
| CAT-06 | P1 | Nuevo pedido → agregar *Llavero* | Pide elegir variante; el precio de la variante se propone. |
| CAT-07 | P1 | **Archivar** un ítem (dueña) → confirmar | Deja de aparecer y de ofrecerse en pedidos; con *Ver archivados* se ve y ofrece **Desarchivar**; los pedidos que lo usaban siguen mostrándolo. Historial intacto. |
| CAT-08 | P1 | Ayudante | No ve **Archivar** ni **Desarchivar**; sí **Ver** y **Editar**. |
| CAT-09 | P1 | Archivar un ítem que una tarea vincula | El diálogo avisa *Una tarea apunta a este registro…*; tras archivar, la tarea lo muestra como **Archivado**, sin romperse. |
| CAT-10 | P2 | **Quitar fotografía** | Confirmación; la foto deja de verse. |
| CAT-11 | P2 | Más de 50 ítems | *Se muestran los primeros 50 por orden alfabético* con **Mostrar más**. |

### INV · Inventario

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| INV-01 | P1 | Detalle de *Papel de transferencia* | Bloque **Saldo** con cifra, *Mínimo 100 u*, badge **Bajo mínimo**; **Movimientos**; **Evolución de precios** (ver `capturas/catalogo-detalle-insumo.png`). |
| INV-02 | P0 | **Registrar consumo** cantidad 1 | Saldo baja 1; movimiento *Consumo −1*. |
| INV-03 | P1 | Consumo cantidad 0 | *La cantidad tiene que ser mayor que cero*. |
| INV-04 | P0 | **Ajuste por conteo** con cantidad 10 (saldo 1) | Movimiento *Ajuste por conteo +9*; saldo 10. No pide motivo. |
| INV-05 | P1 | Ajuste con la misma cantidad que el saldo | *Todo cuadra*; no se crea movimiento. |
| INV-06 | P1 | Consumo que deja el saldo negativo | Se permite; el saldo se muestra negativo con la nota *faltan entradas por registrar*. |
| INV-07 | P1 | Registro rápido → **Consumo** | Diálogo con selector de insumo; registrar en 3 interacciones. |
| INV-08 | P0 | Ayudante en el detalle del insumo | Puede registrar consumo y conteo; **no** ve *Evolución de precios de compra* ni ningún costo. |
| INV-09 | P1 | Subir el saldo por encima del mínimo con un conteo | El badge **Bajo mínimo** desaparece del catálogo, del panel y del reporte *Insumos por acabarse*. |

### CON · Contactos

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CON-01 | P1 | `/contacts` | Lista con badges *Proveedor*, *Cliente*, *Proveedor y cliente*; panel derecho *Ningún contacto elegido*. |
| CON-02 | P0 | **Nuevo contacto** sin marcar ningún rol | *Un contacto tiene que ser proveedor, cliente o ambos.* |
| CON-03 | P1 | Crear con los dos roles | Aparece en los filtros *Proveedores* y *Clientes*. |
| CON-04 | P1 | Correo `no-es-correo` | *El correo no tiene un formato válido*. |
| CON-05 | P1 | Elegir un contacto | Panel con datos, **Editar**, **Archivar** (dueña), tareas relacionadas e historial. No cambia la URL (se puede llegar por `?id=`). |
| CON-06 | P1 | **Archivar** → luego *Ver archivados* → **Desarchivar** | Igual que CAT-07. |
| CON-07 | P2 | Buscar `cespedes` | Encuentra *María Céspedes*. |

### ACT · Activos

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| ACT-01 | P0 | Ayudante abre `/assets` | Redirige al panel; sin entrada en el menú. |
| ACT-02 | P1 | Dueña, línea Sublimación | Tarjeta *Prensa de tazas*: costo 900, mantenimiento 120, fecha, barra con porcentaje (ver `capturas/activos.png`). |
| ACT-03 | P1 | Pulsar la tarjeta | Panel con **Costo total**, **Egresos del activo** (adquisición y mantenimientos con **Desvincular**), formulario **Datos del activo**. |
| ACT-04 | P1 | Registrar un cobro grande en un pedido de Sublimación | El porcentaje de recuperación sube (margen de la línea desde la fecha de compra ÷ costo + mantenimiento). Nunca pasa de 100 % ni baja de 0 %. |
| ACT-05 | P1 | Ítem tipo Activo en línea *Compartido* | Sin barra; texto *Compartido entre líneas…* |
| ACT-06 | P1 | Catálogo → ítem tipo Activo sin declarar → **Declarar como activo** con costo y fecha | Aparece en `/assets`. Costo negativo → *El costo no puede ser negativo.* |
| ACT-07 | P2 | *Ver archivados* | Muestra activos archivados. |

### REP · Reportes

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| REP-01 | P0 | Ayudante abre `/reports` | Redirige al panel. |
| REP-02 | P1 | Dueña, periodo *Este mes*, línea *Todas* | Cinco informes: Rentabilidad, En qué se va el dinero, Qué se vende más, Insumos por acabarse, Comparativo entre líneas (ver `capturas/informes.png`). |
| REP-03 | P1 | Cambiar a *Mes anterior* y a *Rango libre* con fechas | Los cinco se recalculan juntos; la URL cambia; un rango invertido muestra aviso y conserva el anterior. |
| REP-04 | P1 | Elegir línea Alfarería | Cuatro informes se limitan a la línea; **Comparativo** sigue mostrando todas (con nota). El selector global de línea **no** cambia. |
| REP-05 | P1 | Rentabilidad | Pedidos con *sin costo registrado* tienen costo 0 y margen 100 %; el pedido con gasto asignado (EGR-09) muestra su costo y margen real. |
| REP-06 | P1 | Comparativo con regla *Proporcional a los ingresos* | La columna *De General* reparte los gastos de General según ingresos y la leyenda al pie lo explica. Cambiar la regla en Configuración › General a *Partes iguales* cambia el reparto. |
| REP-07 | P1 | **Exportar** en cada informe | Descarga un CSV que abre en Excel con acentos correctos; incluye título, periodo, línea y (en el comparativo) la regla de reparto. |
| REP-08 | P1 | Insumos por acabarse → **Crear tarea** | Abre nueva tarea con el insumo vinculado. |
| REP-09 | P1 | Móvil | Un informe por vez con pestañas. |
| REP-10 | P2 | Organización sin datos | Cada informe con su texto vacío (*No hubo egresos en este periodo.*, etc.). |

### BIT · Bitácora

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| BIT-01 | P0 | Ayudante abre `/activity` | Redirige al panel. |
| BIT-02 | P1 | Dueña | Eventos agrupados por día, frases en español (*Dueña Geeko registró el pedido #12*), botón **Ver cambio** con antes/después; cabecera con *Retención vigente: 12 meses* (ver `capturas/bitacora.png`). |
| BIT-03 | P1 | Hacer un cambio en un pedido y volver | El evento aparece arriba con hora y autor. |
| BIT-04 | P1 | Filtros Desde/Hasta, Línea, Usuario, Tipo de registro, Tipo de acción, Buscar `#1` | Cada filtro va a la URL; el botón atrás recupera el filtro anterior; combinarlos a cero → *sin coincidencias* con **Quitar los filtros**. |
| BIT-05 | P1 | Archivar un contacto, filtrar acción *Archivó*, pulsar **Desarchivar** en el evento | El botón pasa a *Desarchivado*; el contacto vuelve a la lista. |
| BIT-06 | P1 | **Exportar** con el filtro del mes | Descarga CSV con el detalle legible; el propio evento *exportó* queda en la bitácora. |
| BIT-07 | P1 | Exportar sin filtros con muchísimos eventos | Mensaje que pide acotar el rango (no un archivo recortado en silencio). |
| BIT-08 | P2 | **Cargar más** | Añade la siguiente página; el cursor viaja en la URL. |

### NOT · Notificaciones

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| NOT-01 | P1 | Campana con avisos sin leer | Insignia con el número; panel agrupado por tipo; pulsar un aviso lo marca leído y abre la tarea. **Marcar todas como leídas** deja la insignia en cero. |
| NOT-02 | P1 | Como dueña, asignar una tarea al ayudante; entrar como ayudante | Aviso *Te asignaron «…»* en **Tareas asignadas**. Asignarse una tarea a uno mismo **no** genera aviso. |
| NOT-03 | P1 | Mover una tarea del ayudante a *En revisión* siendo la dueña | El ayudante recibe *«…» quedó en revisión*; la dueña (quien lo hizo) no. |
| NOT-04 | P1 | Tarea con fecha límite ayer; ejecutar el trabajo horario (ver §6.4) | Un único aviso *Se venció «…»* aunque el trabajo corra varias veces. |
| NOT-05 | P1 | Cinco tareas que vencen hoy, hora de resumen = hora actual; ejecutar el trabajo | **Un solo** aviso *Tienes N tareas para hoy*, no cinco. |
| NOT-06 | P1 | Configuración › Notificaciones: desactivar *Tarea asignada*, **Guardar**, repetir NOT-02 | No llega el aviso; los demás tipos siguen. |
| NOT-07 | P1 | Ayudante abre `/settings/notifications` | Puede ver y guardar sus preferencias (son personales). |
| NOT-08 | P2 | Aviso cuya tarea fue archivada | Texto *Ya no está disponible.* sin enlace. |
| NOT-09 | P2 | *Recibir también por correo* activado | Hoy **no** llega correo (proveedor sin conectar; comportamiento conocido). |

### CFG · Configuración

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| CFG-01 | P0 | Ayudante abre `/settings/general`, `/settings/lines`, `/settings/members` | Redirige al panel; solo ve las pestañas **Notificaciones** y **Exportar**. |
| CFG-02 | P1 | General: cambiar nombre y moneda `bob` | *Cambios guardados.*; la moneda se guarda como `BOB`; el nombre nuevo aparece en la barra superior. Moneda `bolivianos` → *La moneda usa tres letras…* |
| CFG-03 | P1 | General › Reparto: **Manual** con 60/30 en dos líneas | Aviso *Suman 90 % de 100 %*; al guardar → error de que faltan 10 %. Con 60/40 guarda. |
| CFG-04 | P1 | Líneas: crear `Serigrafía` color Verde | Aparece de inmediato en el selector global con su punto verde, sin recargar. |
| CFG-05 | P1 | Líneas: **Archivar** Serigrafía | Desaparece del selector; sigue en **Archivados** con **Restaurar**; la línea *General* no ofrece Archivar. |
| CFG-06 | P1 | Líneas: crear otra `Sublimación` | *Ya existe un registro con ese nombre.* |
| CFG-07 | P1 | Canales / Categorías / Unidades: crear, editar, archivar, restaurar | Mismo patrón; unidad con código vacío → *El código no puede quedar vacío*. |
| CFG-08 | P0 | Estados › Pedidos › Sublimación: **Agregar estado** `Control de calidad` tipo *En curso*; arrastrarlo entre *Sublimando* y *Listo para entrega* | Aparece como columna nueva en el tablero de Sublimación en esa posición; el tablero de Alfarería **no** cambia; los pedidos existentes conservan su estado. |
| CFG-09 | P1 | Editar `En cola`: quitar *Columna en cola* y cambiar tipo a *En curso* | Guarda; las tarjetas dejan de mostrar posición. Marcar *Columna en cola* en un estado *En curso* → *Solo un estado En espera puede ser columna en cola.* |
| CFG-10 | P1 | Archivar el único estado *Final* | *Todo juego necesita al menos un estado inicial y uno final.* |
| CFG-11 | P1 | Archivar un estado con pedidos | Pide *Mover los registros que lo usaban a*; tras archivar, esos pedidos aparecen en el estado destino y el estado archivado queda en la lista **Archivados** (solo lectura). |
| CFG-12 | P1 | **Usar el juego de la organización** en Sublimación | La línea vuelve a usar el juego general; el tablero muestra sus columnas. **Crear juego propio para esta línea** lo recrea copiado. |
| CFG-13 | P1 | Estados › Tareas › Toda la organización | Juego por defecto *Por hacer, Haciendo, En revisión, Hecho*. |
| CFG-14 | P0 | Usuarios y roles: invitar, revocar, cambiar rol, restringir líneas, archivar | Ver AUT-11/12; **Revocar** elimina la pendiente; cambiar el rol se refleja al entrar esa persona; marcar líneas restringe sus tareas (TAR-19); **Archivar** la pasa a *Sin acceso* y ya no puede entrar. |
| CFG-15 | P1 | Cambiar el rol de la única dueña a Ayudante | *La organización debe conservar al menos una persona dueña.* |
| CFG-16 | P1 | Retención: 0, 121, 6.5, 24 | Errores para los tres primeros; 24 guarda y la cabecera de la bitácora dice *24 meses*. |
| CFG-17 | P1 | Exportar (dueña) → **Descargar exportación** | Progreso *Armando el archivo…*; ZIP `kamay-exportacion-…zip` con un CSV por tabla incluida `bitacora.csv`; la bitácora registra *exportó*. |
| CFG-18 | P1 | Exportar (ayudante) | ZIP sin `egresos`, `lineas-de-compra`, `activos`, `invitaciones` ni `bitacora`. |

### OFF · Sin conexión

Usar DevTools › Network › *Offline* o el modo avión. Las pruebas que requieren cargar una página sin red (service worker) solo funcionan con la compilación de producción (`npm run build && npm run start`), no con `npm run dev`.

| ID | P | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| OFF-01 | P0 | Con la app abierta, cortar la red, crear un pedido sin imágenes, **Guardar** | Aviso *Pedido guardado · pendiente de sincronizar…*; no navega al detalle; en la barra aparece el indicador *1 registro por sincronizar*; en `/quick` aparece con **Sin enviar**. |
| OFF-02 | P0 | Restaurar la red | En menos de 30 s el indicador desaparece; el pedido está en el tablero con su número y su hora de registro es la del momento en que se guardó. |
| OFF-03 | P0 | Guardar el mismo pedido dos veces por corte de red durante el envío | Un solo pedido, un solo número. |
| OFF-04 | P1 | Sin red: registrar un consumo y un ajuste por conteo | Ambos quedan en la cola y se aplican al reconectar en orden. |
| OFF-05 | P1 | Sin red: intentar adjuntar una imagen en un pedido o tarea | Aviso de que los adjuntos necesitan conexión; el resto se guarda. |
| OFF-06 | P1 | Pulsar el indicador | Bandeja **Registros por sincronizar** con estado, detalle y hora de cada entrada; solo las fallidas tienen **Reintentar** / **Descartar**; descartar pide confirmación. |
| OFF-07 | P1 | Con compilación de producción, sin red, abrir `/reports` | Página **Sin conexión**; abrir `/fair` (visitada antes) funciona con el catálogo guardado y su antigüedad. |
| OFF-08 | P1 | Cambiar de organización con registros pendientes de la otra | Las entradas aparecen *En espera* con el motivo *Se registró en otra organización…* |

### ROL · Permisos del ayudante

Resumen de lo que debe cumplirse siempre con `ayudante@kamay.test`:

| ID | P | Comprobación | Resultado esperado |
| --- | --- | --- | --- |
| ROL-01 | P0 | Menú lateral y panel **Más** | Sin Egresos, Reportes, Activos, Bitácora ni Configuración. |
| ROL-02 | P0 | URL directa a `/expenses`, `/reports`, `/assets`, `/activity`, `/settings/general` | Redirige al panel; **no** aparece ninguna pantalla *no autorizado*. |
| ROL-03 | P0 | Panel, detalle de pedido, catálogo | Ninguna cifra de egreso, costo, precio de compra ni margen. |
| ROL-04 | P0 | Detalle de pedido, ítem, contacto, tarea | Sin bloque **Historial** (o vacío), sin botones **Archivar** / **Anular**. |
| ROL-05 | P1 | Registro rápido | Sin **Compra** ni **Gasto**; `/expenses/costs/new` por URL redirige. |
| ROL-06 | P1 | Configuración | Solo Notificaciones y Exportar. |
| ROL-07 | P1 | Campana | Sí tiene notificaciones. |
| ROL-08 | P1 | Exportación | ZIP sin tablas de dueño (CFG-18). |

---

## 6. Pruebas automáticas

La plataforma tiene tres niveles de pruebas que cubren la mayoría de los casos anteriores. Correrlas antes de una ronda manual ahorra tiempo.

### 6.1 Comandos

| Nivel | Comando | Qué cubre | Duración aprox. |
| --- | --- | --- | --- |
| Unitarias | `npm run test:unit` | Cálculos, validaciones, componentes aislados (~2 000 pruebas) | 1–2 min |
| Integración (app) | `npm run test:integration` | Acciones y servicios contra la base local | 2–5 min |
| Integración (base) | `supabase test db` | Reglas de la base: aislamiento, permisos, triggers, vistas (~900 aserciones en 64 archivos) | 2–4 min |
| End-to-end | `npm run test:e2e` | 34 recorridos en navegador, escritorio y móvil | ~18 min |

Requisitos: `supabase start` en marcha y `.env.local` con las llaves locales. Los e2e levantan el servidor solos.

Para correr un solo recorrido:

```bash
npx playwright test tests/e2e/order-flow.spec.ts --project desktop
```

Con interfaz visual:

```bash
npm run test:e2e:ui
```

### 6.2 Recorridos e2e disponibles

`accessibility`, `activity`, `archive-restore`, `assets`, `assistant-permissions`, `auth`, `deployment`, `expenses`, `fair-offline`, `images`, `inventory`, `invitation`, `mobile-capture`, `my-tasks`, `offline-capture`, `order-board`, `order-edit`, `order-entry`, `order-flow`, `order-payments`, `orders-tasks-independence`, `pagination`, `performance`, `production-settings`, `reports`, `settings`, `status-config`, `task-board`, `task-deliverables`, `task-detail`, `task-from-order`, `task-quick-add`, `theme`, `view-states`.

Cada uno crea su propia organización de prueba, así que se pueden correr en paralelo y no ensucian Geeko Store (salvo algunas de integración, que sí escriben en Geeko Store: por eso `supabase db reset` antes de una ronda manual).

### 6.3 Qué solo se prueba en CI

- Todo lo que necesita **cargar una página sin red** (service worker) usa la compilación de producción; en local esas pruebas se saltan con el aviso *necesita la compilación de producción*.
- `deployment.spec.ts` simula un despliegue y corre aparte con `E2E_DEPLOYMENT=1`.
- La medición de rendimiento (`@performance`) corre en el trabajo *Estabilidad*, no en cada PR.

### 6.4 Ejecutar los trabajos programados a mano

Los avisos se generan con un trabajo horario y la retención con uno mensual. Para probarlos en local se llaman con el secreto de `.env.local`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3010/api/notifications/daily
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3010/api/activity/retention
```

Sin cabecera o con un secreto incorrecto la respuesta es `401 {"error":"No autorizado"}`. Los correos **no** se envían en ningún entorno todavía.

### 6.5 Accesibilidad

`accessibility.spec.ts` audita con axe-core (WCAG 2.1 AA) las vistas principales en escritorio, móvil y ambos temas; falla ante violaciones críticas o serias. Para una revisión manual: contraste, foco visible, etiquetas en todos los campos y navegación completa por teclado del tablero (menú *Mover a*).

---

## 7. Plantilla para reportar un defecto

```
Título: [MÓDULO-ID] Resumen en una línea
Entorno: local / preview / producción · commit o fecha
Rol y cuenta: dueña (geeko@kamay.test) / ayudante
Dispositivo: escritorio 1280 / móvil 412 · tema claro / oscuro · con red / sin red
Línea de negocio activa: Todas / Sublimación / …
Precondición:
Pasos:
  1.
  2.
Resultado obtenido:
Resultado esperado (según manual de pruebas / manual de uso):
Evidencia: captura, video, texto del error
Frecuencia: siempre / a veces (n de m)
```

Antes de reportar, comprobar que el caso no está en la lista de **comportamientos conocidos** del [estado de la plataforma](estado-de-la-plataforma.md#4-hallazgos-y-huecos).
