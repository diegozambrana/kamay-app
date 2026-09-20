## Why

Cada taller necesita alguna herramienta que el núcleo de Kamay no trae —el de impresión 3D cotiza hoy en una hoja de cálculo aparte, con las tarifas escritas dentro de las fórmulas— y meter cada una en el núcleo lo haría crecer sin límite y sin frontera. KAM-27 abre un lugar acotado para ellas: una organización activa herramientas desde un catálogo, ninguna puede tocar la base por su cuenta, y cada una llega documentada y probada contra un mismo contrato, de modo que la segunda cueste una fracción de la primera.

## What Changes

- **Prerrequisito (convención nº 11).** Se escribe en `kamay-especificacion-producto-v6.md` §6.1 el concepto **Herramienta**, distinto de los «módulos activables» de V15 y de los «módulos por línea» de la Fase 6 (esos apagan partes del núcleo; una herramienta añade algo que el núcleo no trae). Nada más se construye antes de eso.
- **Tabla `organization_tools`** (`organization_id`, `slug`, `config jsonb`, `archived_at`): activación por organización, RLS con el patrón de siempre, sin política `DELETE`, trigger `log_activity()`, declarada en `lib/export/tables.ts`.
- **Registro en código** (`tools/`): un manifiesto por herramienta con `slug`, nombre, descripción, rol mínimo, puntos de enganche, capacidades declaradas y **tres esquemas Zod: parámetros, entradas y salidas**. El manifiesto declara además sus **tablas relacionadas**: las que lee y aquellas sobre las que escribe *a través de qué Server Action*.
- **Contrato de herramienta, verificado por pruebas que corren sobre todo el registro:** cada herramienta trae su `README.md` con secciones obligatorias (qué hace, parámetros, entradas, salidas, tablas relacionadas, enganches, cómo se prueba), sus pruebas unitarias propias y sus casos de referencia; los valores por defecto cumplen el esquema de parámetros; la salida de la fórmula cumple el esquema de salidas; las tablas declaradas existen en el manifiesto de exportación. Una herramienta nueva hereda estas pruebas sin escribir una línea.
- **Catálogo** como sección nueva de `/settings` (grupo *Organización*, solo dueño): lista, detalle con capacidades en lenguaje llano, activar, desactivar y editar parámetros.
- **Dos puntos de enganche, lista cerrada:** página propia en `/extensions/<slug>` con una sección «Herramientas» en el menú lateral y en el panel «Más», y acción en el detalle del pedido (V4).
- `navEntriesFor` pasa a admitir entradas resueltas por organización, además del filtrado por rol.
- **Acción nueva del núcleo `addOrderLine`** en `actions/orders.ts`: hoy solo existe `updateOrder`, que reemplaza la lista completa de líneas y archivaría la que otra persona acabe de añadir. La acción estrecha es código del núcleo, no de la herramienta.
- **Primera herramienta: calculadora de costo de impresión 3D (`print-cost-3d`)**, portada de la hoja de cálculo real del taller:
  - Entradas por placa: gramos de filamento, tiempo de impresión (días, horas y minutos, que se suman en minutos), unidades por placa, colores (AMS), cantidades de insumos extra y de armados.
  - Parámetros del tenant: precio del filamento por kilo, costo por hora de máquina, recargo por color adicional, costo por armado, lista de insumos extra (nombre y costo), fondo de fallos (%), **curva de margen unitario**, proporción del precio por mayor, descuento por docena y redondeo.
  - **Margen variable según el costo de producción:** puntos de anclaje (por defecto 10 Bs → 250 %, 50 Bs → 175 %, 70 Bs → 157 %, piso 150 %) con interpolación lineal entre ellos. Una curva que haga bajar el precio al subir el costo se rechaza al guardarla.
  - Salidas: desglose del costo por unidad, margen aplicado, precio unitario sugerido, precio por mayor, precio por docena y precio de la placa completa.
- **Frontera de aislamiento verificada por prueba:** ningún archivo de `tools/` importa un cliente de Supabase, `lib/supabase/admin`, ni ejecuta SQL.

### Fuera de alcance

- Manifiestos declarativos interpretados en tiempo de ejecución, motores de fórmulas configurables y carga de código de terceros. **Una herramienta es código de este repositorio y entra por PR.**
- Tablas propias de una herramienta. Todo lo que produce aterriza en un concepto que Kamay ya tiene.
- Herramientas que salen a internet, credenciales por organización y estado en sistemas externos (candidatos: *Herramientas con servicios de terceros* y *Puerta de conexión con otras plataformas*).
- Curaduría: el catálogo es **igual para todas** las organizaciones; el administrador de la plataforma no habilita ni deshabilita herramientas por tenant.
- Activación por línea de negocio y parámetros por línea.
- Cobro, planes o cuotas por herramienta.
- Cualquier punto de enganche distinto de los dos declarados: nada en panel, catálogo, tareas ni egresos.
- De la calculadora: guardar cotizaciones o un historial de cálculos, documento imprimible para el cliente, descuentos por volumen en varios niveles, desglose de depreciación y energía (quedan dentro del costo por hora de máquina), mano de obra de preparación, y leer el precio del filamento desde el catálogo o el inventario.
- Un generador de formularios genérico para cualquier esquema Zod: solo cubre los tipos de campo que el diseño enumera.

## Capabilities

### New Capabilities

- `tenant-tools`: el concepto de herramienta por organización — tabla de activación, registro en código, contrato del manifiesto (esquemas, tablas relacionadas, README, pruebas), catálogo en configuración, formulario de parámetros, los dos puntos de enganche, la sección «Herramientas» de la navegación y la frontera de aislamiento.
- `print-cost-3d`: la calculadora de costo de impresión 3D — entradas, parámetros, fórmula de costo, curva de margen variable, precios derivados, redondeo y sus casos límite.

### Modified Capabilities

- `orders`: requisito nuevo — una línea se puede añadir a un pedido con una operación estrecha (`addOrderLine`) que no toca las demás; y el detalle del pedido ofrece las acciones de las herramientas activas que declaran ese enganche.
- `settings-interaction`: el menú de secciones de `/settings` suma «Herramientas» al grupo *Organización*.

## Impact

- **Esquema:** migración nueva `organization_tools` + prueba pgTAP; `graphify update .` después.
- **Código nuevo:** `tools/` (registro, tipos, pruebas de contrato y de frontera, `print-cost-3d/`), `services/tools/`, `actions/tools.ts`, `features/tools/`, `app/(app)/settings/tools/`, `app/(app)/extensions/[slug]/`.
- **Código tocado:** `components/layout/nav-entries.ts` y sus tres consumidores (menú lateral, barra inferior, panel «Más»), `features/settings/settings-nav.tsx`, `features/orders/order-detail.tsx`, `actions/orders.ts`, `services/orders/order-item-service.ts`, `lib/export/tables.ts`, `vitest.config.ts` (cobertura de `tools/`).
- **Documentos:** `specs/PRD/kamay-especificacion-producto-v6.md` (§6.1, V4, V15), `specs/PRD/kamay-esquema-base-de-datos-supabase.md`, `specs/PRD/kamay-backlog-sprint-01.md` (el alcance de la calculadora crece respecto del texto original: se actualiza la tarea).
- **Dependencias:** ninguna nueva.
- **Tamaño:** por encima del tope de tres días del backlog. Las tareas se ordenan para que la calculadora en su página propia sea entregable antes del enganche en el pedido, que es el corte natural si hiciera falta partirlo.
