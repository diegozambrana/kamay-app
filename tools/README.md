# Herramientas (`tools/`)

Una **herramienta** es una utilidad opcional que una organización activa desde un catálogo común (*Configuración → Herramientas*). Vive fuera del núcleo, solo guarda sus **parámetros**, y todo lo que produce aterriza en un concepto que Kamay ya tiene. No es un «módulo activable»: no apaga ni modifica nada del núcleo. Definición: `specs/PRD/kamay-especificacion-producto-v6.md` §6.1. Spec: `openspec/specs/tenant-tools/`.

| Herramienta | Qué hace |
| --- | --- |
| [`print-cost-3d`](print-cost-3d/README.md) | Costo y precios sugeridos de una pieza impresa en 3D |

## La frontera

Ningún archivo de `tools/` importa un cliente de Supabase, `lib/supabase/*`, `services/*`, ni define una Server Action, ni hace `fetch`. Lo verifica `boundary.test.ts`, también sobre archivos sin añadir a git.

- **Leer:** el núcleo resuelve los datos y se los pasa a la herramienta como *props*.
- **Escribir:** solo por una Server Action existente de `actions/`, declarada en el manifiesto (`tables.writes[].via`). Así cada escritura lleva la sesión, el rol, la RLS y la bitácora de quien la usa.
- **Sin tablas propias.** Lo único que una herramienta persiste es su `config` en `organization_tools`.
- **Dos puntos de enganche, lista cerrada:** `page` (`/extensions/<slug>`) y `order-detail` (acción en el detalle del pedido).

## Estructura

```
tools/
├─ types.ts             el contrato: ToolManifest
├─ registry.ts          TOOLS — lista escrita a mano
├─ resolve.ts           qué herramientas puede usar esta persona (puro)
├─ describe-schema.ts   de un esquema Zod a los campos del formulario de parámetros
├─ contract.test.ts     corre sobre TODO el registro
├─ boundary.test.ts     la frontera
└─ <slug>/
   ├─ manifest.ts       slug, rol, enganches, capacidades, tablas, esquemas
   ├─ schema.ts         configSchema · inputSchema · outputSchema
   ├─ <lógica>.ts       funciones puras + su *.test.ts al lado
   ├─ fixtures.ts       casos de referencia reales
   ├─ README.md
   └─ ui/               página y/o acción del pedido
```

El montaje vive en el núcleo: `features/tools/tool-components.tsx` (mapa `slug → componente`), `services/tools/`, `actions/tools.ts`, `app/(app)/extensions/[slug]/`.

## Cómo añadir una herramienta

1. **Carpeta `tools/<slug>/`.** El slug va en minúsculas con guiones; es el de la URL y el de la base.
2. **`schema.ts`** con los tres esquemas Zod. En `configSchema`, cada campo lleva `.default()` (para que parámetros antiguos se completen) y `.meta({ label, help?, unit?, kind? })`. El formulario de parámetros se genera solo y cubre: `number` (`kind: "money" | "percent" | "number"`), `string`, `boolean`, `enum` y **listas de filas** (`z.array(z.object({…escalares…}))`). Las reglas entre campos van en `superRefine`, con el `path` del campo culpable.
3. **La lógica**, en funciones puras `run(config, input) → output`, con sus pruebas al lado.
4. **`fixtures.ts`** con casos reales. El contrato ejecuta cada uno con los valores por defecto y valida la salida.
5. **`manifest.ts`**: `minRole`, `hooks`, `capabilities` (en lenguaje llano: es lo que la dueña lee antes de activar) y `tables` — qué lee el núcleo para ti y sobre qué escribe la acción que llamas.
6. **`README.md`** con las siete secciones: *Qué hace · Parámetros · Entradas · Salidas · Tablas relacionadas · Puntos de enganche · Cómo se prueba*. Cada campo de cada esquema, entre comillas invertidas en su sección.
7. **`ui/`**: los componentes reciben `config` como *prop*. Regístralos en `features/tools/tool-components.tsx`.
8. **Una línea en `registry.ts`.**
9. `npx vitest run --project unit tools/` — el contrato y la frontera te dicen lo que falte.

No hace falta migración, ni servicio, ni acción nueva, ni tocar el menú.

## Límites conocidos

- **Una herramienta de ayudante trabaja con los valores por defecto.** `organization_tools` solo la lee la dueña, porque los parámetros pueden llevar tarifas y márgenes; al ayudante solo le llegan los slugs activos (`active_tool_slugs`). Una herramienta con `minRole: "assistant"` no puede depender, para el ayudante, de parámetros guardados. Cuando aparezca la primera, se decide cómo exponer los que no sean sensibles.
- **Sin internet ni credenciales.** `capabilities.network` y `capabilities.credentials` tienen que ser `false`; el contrato lo exige. Son otro cambio.
