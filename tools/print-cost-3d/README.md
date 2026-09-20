# Calculadora de impresión 3D (`print-cost-3d`)

Primera herramienta del registro de Kamay (KAM-27). Reemplaza la hoja de cálculo «Calculadora 3D» con la que el taller cotizaba, con cada tarifa que allí estaba escrita dentro de la fórmula convertida en un parámetro de la organización.

> Este documento lo verifica `tools/contract.test.ts`: las siete secciones son obligatorias, y las de parámetros, entradas y salidas tienen que nombrar **todos** los campos de su esquema entre comillas invertidas. Si añades un campo y no lo documentas aquí, la prueba falla.

## Qué hace

A partir de los datos de **una placa de impresión** (lo que muestra el laminador: gramos y tiempo), calcula el costo de producir cada unidad y sugiere cuatro precios: unitario, por mayor, por docena y de la placa completa.

El margen **no es fijo**: baja a medida que sube el costo de producción, siguiendo una curva de anclas que la dueña configura. Una pieza de 5 Bs aguanta venderse al 250 %; una de 70 Bs, no.

```
tiempo     = days × 1440 + hours × 60 + minutes      ← el laminador lo dice así
material   = grams × filamentPricePerKg ÷ 1000
máquina    = tiempo × machineCostPerHour ÷ 60
impresión  = (material + máquina) ÷ units × (1 + colorSurcharge × (colors − 1))
armado     = assemblies × assemblyCost
fallos     = (impresión + armado) × failureRate
COSTO      = impresión + armado + fallos

margen     = curva(COSTO)                    ← interpolación lineal entre anclas
insumos    = Σ cantidad × costo              ← se suman SIN margen
unitario   = COSTO × margen + insumos
por mayor  = COSTO × margen × wholesaleRatio + insumos
docena     = por mayor × (1 − dozenDiscount) × 12
placa      = por mayor × units
```

Solo la dueña puede usarla (`minRole: "owner"`): muestra costos y márgenes.

**No guarda nada de lo que calcula** (convención nº 4). Lo único persistente son los parámetros.

## Parámetros

Se editan en *Configuración → Herramientas*. Esquema: `configSchema` en `schema.ts`. Los porcentajes se guardan como fracción (0,15 = 15 %) y los márgenes como multiplicador (2,5 = 250 %); el formulario los muestra ×100.

| Campo | Qué es | Por defecto |
| --- | --- | --- |
| `filamentPricePerKg` | Precio del filamento por kilo | 175 |
| `machineCostPerHour` | Costo por hora de máquina (incluye luz y desgaste) | 2,75 |
| `colorSurcharge` | Recargo por cada color adicional al primero | 15 % |
| `assemblyCost` | Costo de un armado. Entra en el costo y **lleva margen** | 0,50 |
| `extras` | Lista de insumos extra: nombre y costo unitario. **Sin margen** | vacía |
| `failureRate` | Fondo de fallos, como porcentaje del costo | 0 % |
| `marginCurve` | Anclas «costo → margen» del precio unitario | 10 → 250 % · 50 → 175 % · 70 → 157 % · 80 → 150 % |
| `wholesaleRatio` | Qué parte del margen unitario se cobra por mayor | 80 % |
| `dozenDiscount` | Descuento por docena, sobre el precio por mayor | 5 % |
| `rounding` | Redondeo de los precios: `none`, `half` (0,50) o `unit` | `unit` |

**La curva de margen** (`margin-curve.ts`). Por debajo de la primera ancla vale su margen; por encima de la última, el suyo; entre dos, se interpola en línea recta. Una curva solo se acepta si los costos crecen, los márgenes son ≥ 100 % y no suben, y **el precio nunca baja al subir el costo**. Esto último se comprueba de forma exacta: en cada segmento, `margen₂ + costo₂ × pendiente ≥ 0`. Una curva por tramos escalonados no pasaría: 9,90 × 2,5 = 24,75 pero 10,10 × 2,0 = 20,20.

Todos los campos llevan `.default()`: unos parámetros guardados por una versión anterior se completan al leerlos. Si aun así no son válidos, la página no calcula y enlaza a la edición.

## Entradas

Esquema: `inputSchema`. Todo se refiere a **una placa**. Nunca se guardan.

| Campo | Qué es | Límites | Por omisión |
| --- | --- | --- | --- |
| `grams` | Gramos de filamento de la placa | ≥ 0 | 0 |
| `days` | Días del tiempo de impresión | ≥ 0 | 0 |
| `hours` | Horas del tiempo de impresión | ≥ 0 | 0 |
| `minutes` | Minutos del tiempo de impresión | ≥ 0 | 0 |
| `units` | Unidades que salen de la placa | entero ≥ 1 | 1 |
| `colors` | Cantidad de colores (AMS) | entero ≥ 1 | 1 |
| `assemblies` | Armados por unidad | ≥ 0 | 0 |
| `extraQuantities` | Cuántos lleva cada unidad de cada insumo, por nombre: `{ "Llavero": 1 }` | ≥ 0 | `{}` |

El tiempo se escribe en tres campos porque así lo reporta el laminador; `printMinutes` los suma y eso es lo único que entra en la fórmula: 11 h, 660 min y 10 h con 60 min dan el mismo costo. Un insumo que ya no está en los parámetros se ignora.

## Salidas

Esquema: `outputSchema`. Nunca se guardan. Los costos van sin redondear (la pantalla los muestra con dos decimales); el redondeo configurado se aplica **solo a los cuatro precios**, cada uno calculado desde valores sin redondear.

| Campo | Qué es |
| --- | --- |
| `materialCost` | Costo del filamento de toda la placa |
| `machineCost` | Costo del tiempo de máquina de toda la placa |
| `printCostPerUnit` | Impresión por unidad, ya con el recargo por color |
| `assemblyCost` | Armado por unidad |
| `failureCost` | Fondo de fallos por unidad |
| `unitCost` | **Costo de producción por unidad** |
| `margin` | Multiplicador aplicado, salido de la curva (2,5 = 250 %) |
| `extrasCost` | Insumos por unidad, a su costo |
| `unitPrice` | Precio unitario sugerido |
| `wholesalePrice` | Precio por mayor |
| `dozenPrice` | Precio por docena |
| `platePrice` | Precio de la placa completa, a precio por mayor |

## Tablas relacionadas

La herramienta **no toca ninguna tabla** (`tools/boundary.test.ts`). Esto es lo que el núcleo lee para ella y sobre qué escribe la acción que llama:

| Tabla | Acceso | Cómo |
| --- | --- | --- |
| `organization_tools` | Lectura | El núcleo lee `config` y se la pasa como *prop*. Solo la dueña (RLS). |
| `order_items` | Escritura | Por la Server Action `addOrderLine` de `actions/orders.ts`: una línea libre con descripción, cantidad y precio. No guarda ni el costo ni el margen. |

Indirectamente: `activity_log` registra la creación de la línea (trigger de `order_items`) y `order_totals` la incluye en el total derivado.

## Puntos de enganche

- `page` — página propia en `/extensions/print-cost-3d`, con entrada en la sección «Herramientas» del menú (`ui/page.tsx`).
- `order-detail` — acción en el detalle del pedido: se calcula, se elige precio unitario o por mayor, se ajustan descripción, cantidad y precio, y al confirmar se añade la línea (`ui/order-action.tsx`).

## Cómo se prueba

```bash
npx vitest run --project unit tools/
```

- `fixtures.ts` — ocho filas reales de la hoja del taller con sus costos y precios esperados. `SPREADSHEET_CONFIG` reproduce la hoja (margen fijo ×2,5, por mayor 80 %, sin redondeo).
- `formula.test.ts` — la fórmula contra esas filas, y los casos límite: placa vacía, un solo color, fondo de fallos, insumos sin margen, redondeos, entradas inválidas.
- `margin-curve.test.ts` — los escenarios de la curva por defecto, los rechazos, y una **prueba de propiedad** con 200 curvas de semilla fija: toda curva aceptada da un precio que no decrece; toda curva rechazada por monotonía tiene de verdad un par de costos donde decrece.
- `schema.test.ts` — valores por defecto, parámetros antiguos que se completan, parámetros inservibles.
- `ui/*.test.tsx` — la página y el diálogo del pedido.
- `tools/contract.test.ts` y `tools/boundary.test.ts` — el contrato y la frontera, heredados del registro.
- e2e: `tests/e2e/tools.spec.ts`.
