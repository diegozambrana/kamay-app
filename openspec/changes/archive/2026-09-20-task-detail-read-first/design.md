## Context

Ver `proposal.md` — *Why*. Lo que condiciona el diseño es el estado de los dos componentes:

- **`markdown-editor.tsx`** abre en `tab: "write"` salvo archivada, mantiene `draft` en estado local, guarda al desenfocar el `textarea` (`onBlur`) y con un botón *Guardar descripción* siempre visible, y congela las casillas de la vista previa mientras hay cambios sin guardar (`frozenReason`), porque el servidor reescribe el cuerpo por índice de línea y todavía no tiene lo tecleado.
- **`attachment-panel.tsx`** ya rinde la lista con miniatura, nombre, peso, autor, *Abrir* y *Quitar*. Lo que sobra es el `FileDropzone` siempre desplegado; lo que falta es el visor.

Dos restricciones heredadas que no se tocan:

- El cuerpo se sanea **al rendir**, en cada lectura, nunca al guardar (KAM-16 design D1). Pasar a lectura por omisión hace que ese saneado esté ahora en el camino principal, no en una pestaña secundaria.
- Marcar una casilla reescribe el cuerpo en el servidor por índice (`toggleTaskChecklistItem`). De ahí `frozenReason`.

## Goals / Non-Goals

**Goals:**

- Que abrir una tarea sea leerla también por debajo de la cabecera.
- Que editar el cuerpo y añadir adjuntos sigan a un gesto de distancia, no escondidos.
- Que marcar una casilla siga costando un solo toque.
- Que ver una imagen no expulse de la pantalla.

**Non-Goals:**

- Cambiar qué se guarda, cuándo, o cómo se sanea.
- Tocar la cola de subida, la compresión o los límites.
- Un visor con zoom, rotación o descarga propia: abrir el original ya existe.

## Decisions

### D1 · El editor es un modo, y `draft` nace al entrar

`markdown-editor.tsx` gana un estado `editing`. En lectura rinde `ChecklistPreview` sobre **el cuerpo guardado**; al entrar en edición copia ese cuerpo a `draft`.

**Por qué el borrador nace al entrar** y no vive siempre: hoy `draft` se inicializa con `value` y sobrevive a cualquier cambio del servidor. Con dos modos, un cuerpo que cambió por detrás —porque se marcó una casilla— debe verse al abrir el editor. Naciendo al entrar, el editor siempre parte de lo último guardado.

**Se retira el guardado por `onBlur`.** Con *Guardar* y *Cancelar* explícitos, guardar al desenfocar convierte «pulsé Cancelar» en «ya se había guardado al salir del campo». El único guardado es el botón.

**`frozenReason` deja de hacer falta en lectura**: en lectura no hay borrador, así que el índice que ve el servidor es el mismo que se ve en pantalla. Se conserva para el caso «estoy editando y hay vista previa con cambios sin guardar», que sigue existiendo dentro del modo edición.

### D2 · Cancelar con cambios pide confirmación, reutilizando la guardia que ya existe

`useDiscardConfirm` de `features/orders/discard-guard.tsx` es la misma que usan el formulario de pedido y el de tarea. Se reutiliza tal cual: `leave(() => salirDeEdicion())`.

**Alternativa descartada:** cerrar sin preguntar. El cuerpo es lo más largo que se escribe en la aplicación; perderlo por un clic al lado es el error más caro de la pantalla.

### D3 · Las acciones viven en la cabecera de su tarjeta, no dentro del contenido

*Editar* y *Añadir* se colocan a la derecha del título de su `CardHeader`, que es donde KAM-29 puso *Editar* de la cabecera. Así las tres acciones de la pantalla se leen en la misma columna y ninguna compite con el contenido.

Esto pide que `task-detail.tsx` componga los encabezados de ambas tarjetas, porque la acción pertenece al componente que conoce su estado. Se resuelve pasando la acción como `children` de la cabecera desde el propio componente: `MarkdownEditor` y `AttachmentPanel` rinden su tarjeta entera, en lugar de recibirla ya rendida.

**Alternativa descartada:** que `task-detail.tsx` mantenga el estado de edición y lo baje como props. Sube estado que solo importa dentro, y deja a `task-detail.tsx` sabiendo si el cuerpo está en edición, que no es asunto suyo.

### D4 · El visor es un `Dialog` con la lista de imágenes, no con una sola

El visor recibe **todas** las imágenes de la tarea y el índice activo, no la imagen suelta. Es lo que permite pasar a la siguiente sin cerrarlo y lo que hace que quitar desde dentro pueda decidir a dónde ir.

Navegación con los botones y con las flechas del teclado. `Dialog` de shadcn ya trae el cierre con `Esc`, el foco atrapado y el fondo, así que no hay que inventar nada de eso.

**Qué pasa al quitar desde el visor:** se quita y el visor pasa a la imagen siguiente; si era la última, se cierra. Dejar abierto un visor sobre una imagen que ya no existe sería mentir.

### D5 · Solo las imágenes abren el visor; lo demás sigue igual

La decisión es por `mimeType`, con el mismo `esImagen` que ya decide la miniatura: una sola fuente para «esto es una imagen».

Un adjunto sin `url` firmada —que puede pasar si la firma falló— no abre nada, como hoy.

## Risks / Trade-offs

- **Las pruebas vigentes abren asumiendo el `textarea` visible.** `markdown-editor.test.tsx` y varias e2e empiezan por `getByLabel("Descripción")`. → Es el precio del cambio y se paga una vez: todas pasan a abrir el editor primero. Las aserciones sobre qué se guarda no cambian.
- **Un gesto más para escribir la descripción de una tarea recién creada.** → Mitigado por la invitación pulsable: la tarea vacía tiene un solo sitio donde hacer clic, y lleva al editor.
- **El visor añade superficie nueva** (foco, teclado, imágenes que no cargan). → Se apoya en `Dialog`, que ya resuelve foco y cierre; la imagen que no carga cae en el mismo hueco que hoy deja la miniatura rota.
- **Dos tarjetas pasan a rendir su propia cabecera**, lo que cambia la firma de ambos componentes. → Contenido en `task-detail.tsx` y sus dos pruebas de composición, que ya existen.

## Migration Plan

No hay migración de base de datos: ni esquema, ni RLS, ni `supabase/tests/`. El despliegue es de código y la vuelta atrás es revertir el commit. Ninguna dirección cambia.

`specs/PRD/kamay-mapa-navegacion-ui.md` no cambia: V18 sigue siendo una pantalla con las mismas transiciones; el visor es un diálogo dentro de ella, del mismo tipo que V19.
