## Context

`CatalogScreen` monta un único `<ItemFormDialog open={adding} …>` para el alta y lo deja montado siempre; `adding` solo abre y cierra el `Dialog`. El contenido del diálogo (Radix) se desmonta al cerrarse, así que los campos no controlados (`defaultValue` del nombre, descripción, precio…) y el estado interno de `AttributeFields` y `FileDropzone` sí se reinician. Pero el estado que vive en el propio `ItemFormDialog`, por encima del `Dialog`, sobrevive entre aperturas:

- `photos` (la foto elegida: el `FileDropzone` es controlado y vuelve a mostrar su vista previa),
- `lineId`, `unitId`, `categoryId` (inicializados con `useState(...)` una sola vez, así que tampoco siguen a `defaultLineId` ni a `kind` cuando cambian la pestaña o el filtro),
- `error`.

Tras un alta exitosa solo se hace `onOpenChange(false)`; nada limpia ese estado. `VariantsList` repite el patrón con `<VariantFormDialog open={adding} …>`, donde lo que sobrevive es `error`.

La edición ya resuelve lo mismo con `key={editing.id}` y montaje condicional, así que el patrón existe en el código.

## Goals / Non-Goals

**Goals:**
- Que cada apertura del alta de ítem y de variante parta del estado inicial derivado de las props vigentes (`kind`, `defaultLineId`), sin tocar el contrato de los diálogos.

**Non-Goals:**
- Cambiar el flujo de guardado o el manejo del fallo de la foto (ver «Fuera de alcance» en `proposal.md`).
- Tocar otros diálogos de alta fuera del catálogo.

## Decisions

### Remontar el diálogo de alta en cada apertura con una clave

`CatalogScreen` guarda un contador de aperturas del alta; el botón de alta y la acción del vacío inicial lo incrementan al abrir (`openCreate()`), y el diálogo recibe `key={createKey}`. Cada apertura es una instancia nueva de `ItemFormDialog` cuyos `useState` se inicializan con las props del momento: la pestaña (`kind`) y la línea (`activeLineId`) vigentes, sin foto ni error. Mismo patrón en `VariantsList`.

Se incrementa **al abrir**, no al cerrar, para no remontar el diálogo mientras corre su animación de salida (se vería vaciarse antes de desaparecer).

**Alternativas consideradas:**
- *Montaje condicional* (`{adding && <ItemFormDialog open …/>}`), como la edición: también reinicia, pero corta la animación de cierre del alta y cambia el comportamiento visual hoy aceptado. La clave conserva el diálogo montado y solo cambia la instancia al abrir.
- *Limpiar el estado dentro de `ItemFormDialog`* con un `useEffect` sobre `open`, o reseteando en `onOpenChange`: obliga a enumerar a mano cada `useState` (hoy cinco, mañana más) y es fácil que el siguiente campo nuevo se olvide. Además un efecto que resetea estado a partir de props es el patrón que React desaconseja frente a una `key`. La clave reinicia todo por construcción, incluido lo que se añada después.

### Pruebas en los tres niveles que aplican

- **Unitarias** (Vitest + Testing Library) en `catalog-screen.test.tsx` y en una prueba de `VariantsList`: abrir alta, llenar/elegir foto (un `File` en el input del dropzone), cerrar o guardar con las acciones simuladas, reabrir y comprobar que el formulario está en blanco. Cubren cada escenario del delta.
- **E2e** (Playwright) en un spec de catálogo: crear un producto con foto, pulsar «Nuevo producto» otra vez y comprobar que no hay vista previa; guardar el segundo y verificar en su detalle que no tiene foto. Es el reporte original de punta a punta.
- Sin pgTAP: no hay cambio de esquema.

## Risks / Trade-offs

- [Remontar descarta cualquier cosa que alguien quisiera conservar entre altas] → Es justamente lo pedido; no hay requisito de borrador persistente.
- [Una prueba unitaria que elija la foto depende de cómo el `FileDropzone` expone su input] → Usar `userEvent.upload` sobre el input que ya usan las pruebas de `item-form-dialog.test.tsx`; si no hay precedente, buscarlo por su etiqueta «Fotografía».
- [El e2e sube una foto real contra el Storage local compartido] → Cada prueba crea su propia organización (convención del proyecto), así que no pisa otros datos.
