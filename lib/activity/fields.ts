/**
 * Cómo se llama cada campo de la bitácora cuando alguien lo lee, y de qué
 * clase es su valor.
 *
 * El requisito es que ningún nombre de columna llegue a la pantalla (V23,
 * «La fila expandida muestra el antes y el después»). La bitácora guarda
 * `{"status_id": {"antes": "<uuid>", "despues": "<uuid>"}}`; quien mira quiere
 * «Estado: En diseño → En cola».
 *
 * Función pura y en `lib/` a propósito: la comparten la pantalla de bitácora,
 * los cinco bloques de historial contextual y la exportación, y se prueba sin
 * base de datos.
 *
 * **Este diccionario envejece si nadie lo vigila**, y ya pasó: entre KAM-17 y
 * KAM-21 la bitácora pasó a auditar siete tablas más sin que nadie tocara la
 * redacción. Por eso `tests/integration/activity-fields-coverage.test.ts` lee
 * las columnas reales de las tablas con trigger `audit` y falla si a alguna le
 * falta rótulo aquí. Una lista escrita a mano solo se comprobaría a sí misma.
 */

/** De qué clase es el valor, para saber cómo se rinde. */
export type FieldKind =
  | "text"
  /** Texto largo: se recorta al mostrarlo, no cabe en una celda. */
  | "long-text"
  | "number"
  | "money"
  /** Fecha sin hora (`date` en la base). */
  | "date"
  /** Instante: se presenta en la zona horaria de la organización. */
  | "datetime"
  | "boolean"
  /** Valor de un conjunto cerrado; su rótulo sale de `ENUM_LABELS`. */
  | "enum"
  /** Identificador de persona: se resuelve a su nombre. */
  | "user"
  /** Apunta a otro registro: se resuelve a su rótulo. Ver `references`. */
  | "reference"
  /** No se rinde nunca. Ver `HIDDEN_REASON`. */
  | "hidden";

export type FieldSpec = {
  label: string;
  kind: FieldKind;
  /** Solo con `kind: "reference"`: la tabla del registro al que apunta. */
  references?: string;
};

/** Lo que se dice de un campo que este diccionario no conoce. */
export const UNKNOWN_FIELD_LABEL = "Otro dato";

/**
 * Por qué un campo no se rinde jamás, aunque cambie.
 *
 * Son dos casos y ninguno es «no nos cabía»:
 * - `token_hash` es una credencial. La bitácora la ve porque el trigger copia
 *   la fila entera; enseñarla en pantalla la publicaría.
 * - `search_name` es la copia normalizada de `name` que existe para buscar sin
 *   acentos. Cambia siempre que cambia el nombre, y mostrarlo sería enseñar el
 *   mismo cambio dos veces, la segunda en minúsculas y sin tildes.
 * - `attributes` y `settings` son `jsonb` sin forma fija: no hay antes y
 *   después legible que dar, y el cambio real se ve en los campos que sí la
 *   tienen.
 */
export const HIDDEN_REASON: Record<string, string> = {
  "invitations.token_hash": "credencial",
  "contacts.search_name": "duplicado de nombre",
  "items.search_name": "duplicado de nombre",
  "tags.search_name": "duplicado de nombre",
  "item_variants.attributes": "estructura libre",
  "organizations.settings": "estructura libre",
  "attachments.bucket": "detalle de almacenamiento",
  "attachments.storage_path": "detalle de almacenamiento",
};

const ARCHIVED: FieldSpec = { label: "Archivado", kind: "datetime" };
const OCCURRED: FieldSpec = { label: "Fecha del movimiento", kind: "datetime" };
const AUTHOR: FieldSpec = { label: "Registrado por", kind: "user" };
const LINE: FieldSpec = {
  label: "Línea de negocio",
  kind: "reference",
  references: "business_lines",
};
const NOTE: FieldSpec = { label: "Nota", kind: "long-text" };
const hidden = (label: string): FieldSpec => ({ label, kind: "hidden" });

/**
 * `tabla.columna` → cómo se lee.
 *
 * Las columnas que el trigger nunca guarda —`id`, `created_at`, `updated_at`,
 * `organization_id`— no están aquí: `log_activity()` excluye las dos fechas y
 * las otras dos no son un cambio que contar.
 */
export const FIELDS: Record<string, Record<string, FieldSpec>> = {
  organizations: {
    name: { label: "Nombre del negocio", kind: "text" },
    logo_path: { label: "Logotipo", kind: "text" },
    currency: { label: "Moneda", kind: "text" },
    timezone: { label: "Zona horaria", kind: "text" },
    settings: hidden("Preferencias"),
    archived_at: ARCHIVED,
  },

  memberships: {
    user_id: { label: "Persona", kind: "user" },
    role: { label: "Rol", kind: "enum" },
    display_name: { label: "Nombre visible", kind: "text" },
    archived_at: ARCHIVED,
  },

  membership_lines: {
    membership_id: {
      label: "Persona del equipo",
      kind: "reference",
      references: "memberships",
    },
    business_line_id: LINE,
    archived_at: ARCHIVED,
  },

  invitations: {
    email: { label: "Correo invitado", kind: "text" },
    role: { label: "Rol ofrecido", kind: "enum" },
    token_hash: hidden("Credencial de invitación"),
    expires_at: { label: "Vence", kind: "datetime" },
    accepted_at: { label: "Aceptada", kind: "datetime" },
    invited_by: { label: "Invitada por", kind: "user" },
    archived_at: ARCHIVED,
  },

  business_lines: {
    name: { label: "Nombre de la línea", kind: "text" },
    color: { label: "Color", kind: "text" },
    icon: { label: "Icono", kind: "text" },
    is_shared: { label: "Compartida", kind: "boolean" },
    position: { label: "Orden", kind: "number" },
    archived_at: ARCHIVED,
  },

  sales_channels: {
    name: { label: "Nombre del canal", kind: "text" },
    position: { label: "Orden", kind: "number" },
    archived_at: ARCHIVED,
  },

  expense_categories: {
    name: { label: "Nombre de la categoría", kind: "text" },
    archived_at: ARCHIVED,
  },

  units: {
    code: { label: "Símbolo", kind: "text" },
    name: { label: "Nombre de la unidad", kind: "text" },
    archived_at: ARCHIVED,
  },

  statuses: {
    business_line_id: LINE,
    flow: { label: "Flujo", kind: "enum" },
    name: { label: "Nombre del estado", kind: "text" },
    kind: { label: "Tipo de estado", kind: "enum" },
    color: { label: "Color", kind: "text" },
    position: { label: "Orden", kind: "number" },
    is_queue: { label: "Columna en cola", kind: "boolean" },
    archived_at: ARCHIVED,
  },

  contacts: {
    name: { label: "Nombre", kind: "text" },
    phone: { label: "Teléfono", kind: "text" },
    email: { label: "Correo", kind: "text" },
    address: { label: "Dirección", kind: "text" },
    is_supplier: { label: "Es proveedor", kind: "boolean" },
    is_customer: { label: "Es cliente", kind: "boolean" },
    notes: NOTE,
    search_name: hidden("Nombre normalizado"),
    created_by: AUTHOR,
    archived_at: ARCHIVED,
  },

  items: {
    business_line_id: LINE,
    kind: { label: "Tipo de ítem", kind: "enum" },
    name: { label: "Nombre", kind: "text" },
    description: { label: "Descripción", kind: "long-text" },
    unit_id: { label: "Unidad", kind: "reference", references: "units" },
    category: { label: "Categoría", kind: "text" },
    sale_price: { label: "Precio de venta", kind: "money" },
    min_stock: { label: "Mínimo de stock", kind: "number" },
    search_name: hidden("Nombre normalizado"),
    created_by: AUTHOR,
    archived_at: ARCHIVED,
  },

  item_variants: {
    item_id: { label: "Ítem", kind: "reference", references: "items" },
    name: { label: "Nombre de la variante", kind: "text" },
    attributes: hidden("Atributos"),
    sale_price: { label: "Precio de venta", kind: "money" },
    archived_at: ARCHIVED,
  },

  asset_details: {
    item_id: { label: "Activo", kind: "reference", references: "items" },
    acquisition_cost: { label: "Costo de adquisición", kind: "money" },
    acquired_on: { label: "Fecha de adquisición", kind: "date" },
    supplier_id: {
      label: "Proveedor",
      kind: "reference",
      references: "contacts",
    },
    notes: NOTE,
  },

  orders: {
    business_line_id: LINE,
    kind: { label: "Tipo", kind: "enum" },
    code: { label: "Número", kind: "number" },
    contact_id: { label: "Cliente", kind: "reference", references: "contacts" },
    status_id: { label: "Estado", kind: "reference", references: "statuses" },
    sales_channel_id: {
      label: "Canal de venta",
      kind: "reference",
      references: "sales_channels",
    },
    delivery_mode: { label: "Modo de entrega", kind: "enum" },
    due_date: { label: "Fecha comprometida", kind: "date" },
    occurred_at: OCCURRED,
    queued_at: { label: "Entró en cola", kind: "datetime" },
    notes: NOTE,
    created_by: AUTHOR,
    archived_at: ARCHIVED,
  },

  order_items: {
    order_id: { label: "Pedido", kind: "reference", references: "orders" },
    item_id: { label: "Ítem", kind: "reference", references: "items" },
    variant_id: {
      label: "Variante",
      kind: "reference",
      references: "item_variants",
    },
    description: { label: "Descripción", kind: "text" },
    quantity: { label: "Cantidad", kind: "number" },
    unit_price: { label: "Precio unitario", kind: "money" },
    archived_at: ARCHIVED,
  },

  expenses: {
    business_line_id: LINE,
    kind: { label: "Tipo de egreso", kind: "enum" },
    contact_id: {
      label: "Proveedor",
      kind: "reference",
      references: "contacts",
    },
    expense_category_id: {
      label: "Categoría",
      kind: "reference",
      references: "expense_categories",
    },
    order_id: {
      label: "Pedido asociado",
      kind: "reference",
      references: "orders",
    },
    amount: { label: "Monto", kind: "money" },
    occurred_at: OCCURRED,
    note: NOTE,
    created_by: AUTHOR,
    archived_at: ARCHIVED,
    asset_id: { label: "Activo", kind: "reference", references: "items" },
    asset_expense_role: { label: "Concepto del activo", kind: "enum" },
  },

  expense_items: {
    expense_id: { label: "Egreso", kind: "reference", references: "expenses" },
    item_id: { label: "Ítem", kind: "reference", references: "items" },
    variant_id: {
      label: "Variante",
      kind: "reference",
      references: "item_variants",
    },
    quantity: { label: "Cantidad", kind: "number" },
    unit_price: { label: "Precio unitario", kind: "money" },
  },

  payments: {
    direction: { label: "Sentido", kind: "enum" },
    order_id: { label: "Pedido", kind: "reference", references: "orders" },
    expense_id: { label: "Egreso", kind: "reference", references: "expenses" },
    amount: { label: "Monto", kind: "money" },
    method: { label: "Forma de pago", kind: "enum" },
    occurred_at: OCCURRED,
    note: NOTE,
    created_by: AUTHOR,
    archived_at: ARCHIVED,
  },

  inventory_movements: {
    item_id: { label: "Ítem", kind: "reference", references: "items" },
    variant_id: {
      label: "Variante",
      kind: "reference",
      references: "item_variants",
    },
    kind: { label: "Tipo de movimiento", kind: "enum" },
    quantity: { label: "Cantidad", kind: "number" },
    source_type: { label: "Origen del movimiento", kind: "enum" },
    source_id: { label: "Registro de origen", kind: "text" },
    occurred_at: OCCURRED,
    note: NOTE,
    created_by: AUTHOR,
  },

  tasks: {
    business_line_id: LINE,
    status_id: { label: "Estado", kind: "reference", references: "statuses" },
    title: { label: "Título", kind: "text" },
    body_markdown: { label: "Descripción", kind: "long-text" },
    assignee_id: { label: "Responsable", kind: "user" },
    due_at: { label: "Fecha límite", kind: "datetime" },
    remind_at: { label: "Recordatorio", kind: "datetime" },
    closed_at: { label: "Cerrada", kind: "datetime" },
    closed_without_deliverables: {
      label: "Cerrada sin entregables",
      kind: "boolean",
    },
    created_by: AUTHOR,
    archived_at: ARCHIVED,
  },

  tags: {
    name: { label: "Etiqueta", kind: "text" },
    search_name: hidden("Etiqueta normalizada"),
  },

  task_links: {
    task_id: { label: "Tarea", kind: "reference", references: "tasks" },
    entity_type: { label: "Tipo de vínculo", kind: "enum" },
    entity_id: { label: "Registro vinculado", kind: "text" },
    archived_at: ARCHIVED,
  },

  task_deliverables: {
    task_id: { label: "Tarea", kind: "reference", references: "tasks" },
    deliverable_type: { label: "Entregable", kind: "enum" },
    fulfilled_type: { label: "Tipo de lo creado", kind: "enum" },
    fulfilled_id: { label: "Registro creado", kind: "text" },
    fulfilled_at: { label: "Cumplido", kind: "datetime" },
    archived_at: ARCHIVED,
  },

  attachments: {
    entity_type: { label: "Tipo de registro", kind: "enum" },
    entity_id: { label: "Registro", kind: "text" },
    bucket: hidden("Depósito"),
    storage_path: hidden("Ruta del archivo"),
    file_name: { label: "Nombre del archivo", kind: "text" },
    mime_type: { label: "Tipo de archivo", kind: "text" },
    size_bytes: { label: "Tamaño", kind: "number" },
    uploaded_by: { label: "Subido por", kind: "user" },
    archived_at: ARCHIVED,
  },
};

/**
 * Los valores de conjunto cerrado, en el idioma del producto.
 *
 * Un `direction: "in"` no se lee; «Cobro» sí. La clave es `tabla.columna`
 * porque el mismo nombre de columna significa cosas distintas según dónde
 * viva: `kind` es el tipo de ítem en `items` y el sentido del movimiento en
 * `inventory_movements`.
 */
export const ENUM_LABELS: Record<string, Record<string, string>> = {
  "memberships.role": { owner: "Dueño", assistant: "Ayudante" },
  "invitations.role": { owner: "Dueño", assistant: "Ayudante" },
  "statuses.flow": { order: "Pedidos", task: "Tareas" },
  "statuses.kind": {
    initial: "Inicial",
    in_progress: "En proceso",
    waiting: "En espera",
    final: "Final",
    cancelled: "Cancelado",
  },
  "items.kind": { supply: "Insumo", product: "Producto", asset: "Activo" },
  "orders.kind": { order: "Pedido", direct_sale: "Venta directa" },
  "orders.delivery_mode": { pickup: "Recojo", delivery: "Entrega" },
  "expenses.kind": { purchase: "Compra", expense: "Gasto" },
  "expenses.asset_expense_role": {
    acquisition: "Adquisición",
    maintenance: "Mantenimiento",
  },
  "payments.direction": { in: "Cobro", out: "Pago" },
  "payments.method": {
    cash: "Efectivo",
    transfer: "Transferencia",
    other: "Otro",
  },
  "inventory_movements.kind": {
    in: "Entrada",
    out: "Salida",
    adjustment: "Ajuste",
  },
  "inventory_movements.source_type": {
    expense_item: "Compra",
    order_item: "Venta",
    manual: "Manual",
    count: "Recuento",
  },
  "attachments.entity_type": {
    task: "Tarea",
    order: "Pedido",
    expense: "Egreso",
    item: "Ítem",
    contact: "Contacto",
  },
  "task_links.entity_type": {
    order: "Pedido",
    contact: "Contacto",
    item: "Ítem",
    expense: "Egreso",
    asset: "Activo",
  },
  "task_deliverables.deliverable_type": {
    product: "Producto nuevo",
    supply: "Insumo nuevo",
    supplier: "Proveedor nuevo",
    purchase: "Compra",
    expenses: "Egresos",
    asset: "Activo nuevo",
  },
  "task_deliverables.fulfilled_type": {
    product: "Producto",
    supply: "Insumo",
    supplier: "Proveedor",
    purchase: "Compra",
    expenses: "Egreso",
    asset: "Activo",
  },
};

/**
 * Cómo se lee un campo. `null` cuando el diccionario no lo conoce: quien
 * llama decide qué hacer con eso —la pantalla dice «Otro dato», la prueba de
 * cobertura falla—, y así una columna nueva no se cuela con un rótulo
 * inventado a partir de su nombre.
 */
export function fieldSpec(
  tableName: string,
  column: string,
): FieldSpec | null {
  return FIELDS[tableName]?.[column] ?? null;
}

/** El rótulo de un valor de conjunto cerrado, o el valor si no se conoce. */
export function enumLabel(
  tableName: string,
  column: string,
  value: string,
): string {
  return ENUM_LABELS[`${tableName}.${column}`]?.[value] ?? value;
}
