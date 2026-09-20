## Context

Motivación y alcance: ver `proposal.md`. Lo que condiciona el diseño:

- **Capas (convención nº 1).** `app/` → `actions/` → `services/` → `features/`. Solo `services/` habla con Supabase; `"use server"` solo en `actions/`. Una herramienta no encaja en ninguna de las cuatro: es una rebanada que *usa* el núcleo sin ser parte de él. Necesita un lugar propio cuya frontera se pueda verificar por máquina, como ya hace `services/notifications/service-role-boundary.test.ts` con el service role.
- **La navegación sale de una sola declaración.** `components/layout/nav-entries.ts` alimenta el menú lateral, la barra inferior y el panel «Más»; `navEntriesFor(role, platformAdmin)` es pura y hoy no sabe nada de la organización.
- **No existe una operación para añadir una línea.** `actions/orders.ts` ofrece `updateOrder`, que manda la lista completa a la RPC `update_order` y **archiva lo que no venga**. El backlog decía «llamando a la acción de pedidos que ya existe»; no existe. La RLS de `order_items` ya permite `insert` a cualquier miembro.
- **Los costos son de la dueña.** `expenses` y los reportes no tienen lectura para el ayudante (§16). Los parámetros de la calculadora —tarifas y márgenes— son de la misma naturaleza.
- **La hoja de cálculo de origen** tiene las tarifas dentro de las fórmulas (175 Bs/kg, 2,75 Bs/h, 0,85 + 0,15 × colores, 0,5 por armado, 0,5 por llavero, 3 por clicker) y tres multiplicadores fijos (×1,5 «apoyo», ×2 mayor, ×2,5 unidad). Los insumos se suman después del margen.
- Zod 4 (`.meta()`), react-hook-form 7. No hay librería de pruebas por propiedades y no se añade.

## Goals / Non-Goals

**Goals:**

- Que la frontera «una herramienta no toca la base» sea una prueba, no una costumbre.
- Que el costo de la segunda herramienta sea: una carpeta, un manifiesto, una fórmula, un README y una línea en el registro — con las pruebas de contrato heredadas.
- Que la calculadora reproduzca la hoja del taller al centavo cuando se configura como la hoja, y que la curva de margen no pueda invertir precios.

**Non-Goals:**

- Un sistema de plugins. No hay carga dinámica, ni versiones de manifiesto, ni API pública.
- Un generador de formularios para cualquier esquema Zod (ver D7).
- Tocar `update_order` ni el formulario de edición del pedido.

## Decisions

### D1 · «Herramienta» es un concepto nuevo, distinto de «módulo activable»

Se escribe en §6.1 de la especificación v6 antes de cualquier código (tarea 1). **Herramienta:** utilidad opcional que una organización activa desde un catálogo común; vive fuera del núcleo, solo guarda sus parámetros y todo lo que produce aterriza en un concepto existente. **Módulo activable** (V15, Fase 6) sigue significando apagar partes del núcleo y no se construye aquí.

*Alternativa descartada:* unificar ambos. Un interruptor del núcleo y una utilidad añadida tienen garantías opuestas —el primero toca el esquema y los permisos, la segunda tiene prohibido hacerlo— y un solo nombre borraría justo la frontera que este cambio quiere fijar.

### D2 · Directorio `tools/` en la raíz, con su propia estructura

```
tools/
├─ types.ts              ToolManifest, ToolHook, RelatedTables
├─ registry.ts           TOOLS: readonly ToolManifest[]  ← lista cerrada, a mano
├─ resolve.ts            activeToolsFor(slugs, role) · toolBySlug()   (puras)
├─ contract.test.ts      corre sobre TODO el registro
├─ boundary.test.ts      git grep sobre tools/
├─ README.md             cómo se añade una herramienta (lista de pasos)
└─ print-cost-3d/
   ├─ manifest.ts        slug, rol, enganches, capacidades, tablas, esquemas
   ├─ schema.ts          configSchema · inputSchema · outputSchema (Zod + .meta)
   ├─ formula.ts         calculate(config, input) → output   (pura)
   ├─ margin-curve.ts    marginAt() · validateCurve()         (puras)
   ├─ fixtures.ts        filas reales de la hoja del taller
   ├─ *.test.ts          junto a cada archivo
   ├─ README.md
   └─ ui/                page.tsx (cliente) · order-action.tsx (diálogo)
```

El registro es una lista escrita a mano, no un `glob`: añadir una herramienta es un diff visible en `registry.ts`, y el criterio 7 («manifiesto ausente») se prueba quitando un elemento de una lista.

*Alternativa descartada:* repartirla en `lib/tools/`, `features/tools/<slug>/`, `services/…`. La frontera dejaría de ser un prefijo de ruta y el README no tendría dónde vivir junto a lo que documenta.

El **núcleo** de las herramientas sí sigue las capas: `services/tools/organization-tool-service.ts`, `actions/tools.ts`, `features/tools/` (catálogo, formulario de parámetros, montaje de enganches), `app/(app)/settings/tools/`, `app/(app)/extensions/[slug]/page.tsx`.

### D3 · El manifiesto declara tablas *por la operación que usa*

```ts
tables: {
  reads:  [{ table: "organization_tools", why: "sus parámetros" }],
  writes: [{ table: "order_items", via: "addOrderLine" }],
}
```

Una herramienta no toca tablas, así que «tablas relacionadas» significa: qué lee el núcleo para dársela y sobre qué escribe la Server Action que llama. `contract.test.ts` cruza `via` con los `import … from "@/actions/…"` reales del directorio de la herramienta (mismo `git grep --untracked` que la prueba del service role): operación usada y no declarada, o declarada y no usada, rompe la prueba. `table` se cruza con `EXPORT_TABLES`.

### D4 · `organization_tools`: lectura solo de la dueña + función para los identificadores

```sql
organization_tools(id uuid pk, organization_id, slug text, config jsonb not null default '{}',
                   archived_at, created_at, updated_at, unique (organization_id, slug))
-- select / insert / update: is_owner(organization_id). Sin DELETE. Trigger log_activity().
-- check: slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'

active_tool_slugs(p_organization_id uuid) returns setof text
-- security definer, search_path fijo, exige is_member(p_organization_id), solo slugs no archivados
```

El backlog pedía «el patrón de siempre» (lectura para miembros). Se aparta a propósito: `config` lleva tarifas y la curva de margen, y con lectura de miembro el ayudante las obtendría con una consulta directa aunque la pantalla se las oculte. Pero el menú del ayudante **sí** necesita saber qué está activo (criterio 4: herramientas con rol `assistant`). La función devuelve solo identificadores. En `lib/export/tables.ts` va con `ownerOnly: true`.

*Alternativa descartada:* partir en dos tablas (activación / parámetros). Más esquema para lo mismo, y rompe «desactivar conserva parámetros» en una sola fila.

`id` es UUID generable en el cliente (convención nº 9) aunque hoy no haya alta sin conexión. Activar es un *upsert* lógico en el servicio: si la fila existe, `archived_at = null`; si no, `insert` con los valores por defecto del manifiesto.

### D5 · Resolución: una lectura por petición, en el layout

`app/(app)/layout.tsx` ya resuelve sesión y rol. Llama una vez a `OrganizationToolService.activeSlugs()` (la función de D4), lo cruza con el registro en `resolve.ts` y pasa al *shell* una lista serializable `{ slug, name, href }` — **no** los manifiestos, que llevan esquemas Zod y no cruzan a cliente. El icono se resuelve en cliente desde un mapa `slug → icono`.

`navEntriesFor(role, platformAdmin, tools = [])` gana un tercer parámetro y `NavEntry` gana `group?: "tools"`. Las entradas de herramientas se añaden tras «Configuración» y antes de las de plataforma, con `mobile: "more"`. El menú lateral pinta el título «Herramientas» cuando encuentra la primera entrada con ese grupo; sin entradas no hay título. La función sigue siendo pura y las pruebas existentes no cambian.

`/extensions/[slug]/page.tsx`: registro → activa → rol ≥ `minRole` → lee `config` → monta la página de la herramienta con la `config` como *prop*. Cualquier fallo → `notFound()`, indistinguible entre «no existe», «no activa» y «no es tu rol». Consecuencia de D4: la lectura de `config` solo devuelve fila a la dueña, así que **una herramienta con rol `assistant` trabaja, para el ayudante, con los valores por defecto de su manifiesto**. Se documenta en `tools/README.md`; la única herramienta real de este cambio es de dueña.

El criterio 4 (rol `assistant`) se prueba con un manifiesto de prueba inyectado en `resolve.ts`, no con una segunda herramienta real.

### D6 · `addOrderLine`: acción estrecha del núcleo

`actions/orders.ts` gana `addOrderLine({ orderId, line })`: valida `line` con el `orderLineSchema` que ya existe, toma `getSessionContext()`, comprueba con `OrderService.getById` que el pedido está al alcance y no archivado, e inserta con `OrderItemService.add()`. `revalidateOrders(orderId)`. La bitácora la escribe el trigger que `order_items` ya tiene.

*Alternativa descartada — reutilizar `updateOrder`:* obliga al diálogo a leer todas las líneas y reenviarlas; si alguien añadió una entre la lectura y el envío, `update_order` la archiva. Un fallo silencioso con dinero.
*Alternativa descartada — llevar a la persona al formulario de edición con la línea precargada:* más pasos, y acopla la herramienta al estado interno del formulario.

### D7 · Formulario de parámetros: intérprete acotado de Zod, con salida de emergencia

`tools/describe-schema.ts` recorre el `z.object` del manifiesto y lo convierte en descriptores de campo según el tipo y `.meta({ label, help, unit, kind, options })`; `features/tools/config-form.tsx` los pinta con estado local —como el resto de los formularios del proyecto, que no usan react-hook-form— y `features/tools/config-draft.ts` hace el ida y vuelta entre lo guardado y el texto de los campos:

| Zod | Campo |
| --- | --- |
| `z.number()` | número; `kind: "percent"` muestra 15 y guarda 0,15; `kind: "money"` usa la moneda de la organización |
| `z.string()` | texto |
| `z.boolean()` | interruptor |
| `z.enum()` | selector |
| `z.array(z.object({…escalares…}))` | tabla de filas con añadir / quitar |

Cualquier otra forma hace fallar `contract.test.ts` con «tipo de parámetro no soportado». Las validaciones entre campos (la curva monótona) son `superRefine` del esquema y su error se pinta en el `path` que devuelven. `updateToolConfig` vuelve a validar con el mismo esquema en el servidor.

Las listas de filas entran porque la primera herramienta necesita dos (insumos y anclas); dejarlas fuera habría forzado un formulario a medida en la herramienta nº 1, que es justo lo que el generador existe para evitar.

### D8 · La fórmula

Pura, sin React, sin fechas, sin E/S: `calculate(config, input) → output`. Las ecuaciones están en la spec `print-cost-3d`. Decisiones:

- **Recargo por color** como `1 + r × (colores − 1)`: algebraicamente igual a `0,85 + 0,15 × colores` de la hoja, pero con un solo parámetro que significa algo.
- **El armado entra en el costo** (lleva margen) y **los insumos van fuera** (sin margen), tal como en la hoja. Se mantiene: es el comportamiento con el que el taller ya fijó sus precios. Si se quiere cambiar, es un parámetro nuevo en otro cambio.
- **Por mayor = margen unitario × proporción** (por defecto 0,8 = 2,0 ÷ 2,5 de la hoja), no una segunda curva: una sola curva que mantener, y el mayor nunca supera al unitario.
- **«Apoyo» (×1,5) no se porta.** Era un precio para una persona concreta. **Precio de la placa** se calcula sobre el precio por mayor.
- **Fondo de fallos** por defecto 0 % para que los valores por defecto reproduzcan la hoja.
- **Aritmética:** `number` de JS, como `lib/orders/lines.ts`. El redondeo comercial se aplica al final sobre cada precio (`Math.round(p / paso) * paso`); las pruebas de referencia comparan con `toBeCloseTo(…, 6)`.
- **Evolución de parámetros:** cada campo del `configSchema` lleva `.default()`. Leer es `safeParse`: lo que falta se rellena; si falla, la página no calcula y enlaza a los parámetros.

### D9 · La curva de margen

Anclas ordenadas; fuera del rango se sujeta al extremo; dentro, interpolación lineal. El «piso» no es un concepto aparte: es la última ancla (80 → 150 %).

*Alternativa descartada — tramos escalonados* («hasta 10 → 250 %, hasta 50 → 200 %…»): en cada frontera el precio cae al subir el costo (9,90 × 2,5 = 24,75 > 10,10 × 2,0 = 20,20).

**Validación de monotonía, exacta y sin muestreo.** En un segmento con pendiente `s ≤ 0`, el precio `p(c) = c · m(c)` es una parábola cóncava; su derivada `m(c) + c·s` es mínima en el extremo derecho. Basta exigir `m₂ + c₂ · s ≥ 0` por segmento. Para la curva por defecto: 0,81 · 0,94 · 0,94. `validateCurve` devuelve el segmento infractor para el mensaje.

**Prueba de propiedad sin dependencia nueva:** un generador congruencial con semilla fija produce ~200 curvas; para cada una que `validateCurve` acepta, se recorre una rejilla de costos y se afirma que el precio no decrece; para cada una que rechaza por monotonía, se afirma que existe un par que decrece. Determinista, así que un fallo se reproduce.

### D10 · El enganche del pedido

`features/orders/order-detail.tsx` recibe `toolActions: { slug, label }[]` ya filtrado en el servidor y monta `features/tools/order-tool-actions.tsx`, que resuelve `slug → componente` desde un mapa en cliente (`tools/print-cost-3d/ui/order-action.tsx`). `order-detail` no importa nada de `tools/`. Lista vacía → no se pinta nada. El diálogo de la calculadora recibe la `config` como *prop* desde el servidor y llama a `addOrderLine`.

### D11 · Pruebas y cobertura

`vitest.config.ts` suma `tools/**` al umbral del 90 %. Las pruebas de contrato generan sus casos con `describe.each(TOOLS)`. El README se verifica por texto: existen los siete encabezados y cada clave de los tres esquemas aparece entre comillas invertidas en su sección.

## Risks / Trade-offs

- **[El cambio excede los tres días del backlog]** → Las tareas están ordenadas para que el grupo 8 (enganche del pedido) sea separable: hasta el grupo 7 hay catálogo y calculadora en su página, entregable por sí solo. Si se parte, los requisitos del delta `orders` y el último de `print-cost-3d` se mueven al segundo cambio.
- **[El intérprete de Zod depende de la forma interna de los esquemas de Zod 4]** → Se aísla en una función `describeSchema()` con pruebas propias; una subida de Zod que la rompa falla ahí y no en pantalla.
- **[`addOrderLine` comprueba «no archivado» en la acción, no en la base]** → Ventana mínima entre la lectura y el `insert`. Se acepta: el peor caso es una línea en un pedido recién archivado, visible y archivable, y queda en la bitácora. Comprobado en la tarea 9.1: `order_items` no tiene ningún trigger que lo impida (solo `audit`; `20260903120000_order_entry.sql` explica por qué no lleva `enforce_archive_rules`), así que la comprobación queda en la acción y el riesgo se acepta tal cual.
- **[Los valores por defecto son los de un taller boliviano]** → 175 Bs/kg no significa nada para una organización en otra moneda. La página nombra siempre las tarifas en uso y enlaza a cambiarlas; el catálogo dice «revisa los parámetros» al activar.
- **[Una herramienta de ayudante no puede leer parámetros (D4/D5)]** → Limitación consciente y documentada. Cuando aparezca la primera, se decide si basta una marca `sensitive` por parámetro o una segunda función.
- **[La convención nº 4 y `config`]** → `config` guarda parámetros, no derivados. La curva son datos de entrada. Ningún precio se guarda; la línea del pedido guarda el precio *acordado*, que es un hecho, como cualquier otra línea.
- **[Entradas de menú que aparecen y desaparecen]** → El layout se revalida al activar y desactivar (`revalidatePath("/", "layout")`).

## Migration Plan

1. Migración `YYYYMMDDHHMMSS_organization_tools.sql` (tabla, políticas, trigger, función) + `supabase/tests/organization_tools.test.sql`. Base local compartida: aplicar con `psql`. Es aditiva; ninguna organización tiene filas.
2. Desplegar. Sin herramientas activas la aplicación se ve idéntica (criterio 1).
3. Geeko Store: activar la calculadora y cargar sus insumos (Llavero 0,50 · Clicker 3,00) a mano desde el catálogo. No se siembra por migración: es una decisión de la dueña.

**Vuelta atrás:** revertir el despliegue basta; la tabla puede quedarse vacía sin efecto. No se borra.

## Open Questions

- ¿Conviene con el tiempo una marca por parámetro para que una herramienta de ayudante pueda leer parte de su configuración? Se decide cuando exista la primera.
- ¿El icono de cada herramienta lo declara el manifiesto (como nombre) o el mapa de cliente? Hoy el mapa; no afecta a specs ni tareas.
