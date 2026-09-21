/**
 * Qué sale en la exportación completa y cómo se llama cada archivo (KAM-23,
 * spec `data-export`).
 *
 * **Toda tabla de datos, en el orden en que alguien la leería**: primero la
 * configuración, después el directorio y el catálogo, el dinero, el trabajo y,
 * al final, la bitácora. Las vistas derivadas no se exportan: se recalculan
 * con lo que sí sale (convención nº 4).
 *
 * Las columnas se listan porque una tabla sin filas tiene que salir igual,
 * con sus encabezados, y sin filas no hay de dónde leerlos. Una prueba de
 * integración (`tests/integration/export-manifest.test.ts`) compara esta
 * lista con el catálogo de la base: una tabla o una columna nueva que no se
 * añada aquí rompe la integración continua el mismo día.
 *
 * `ownerOnly` marca las tablas cuya política de lectura es solo de la persona
 * dueña: al ayudante no le sale el archivo, igual que no le sale la pantalla.
 */
export type ExportTable = {
  table: string;
  /** Nombre del archivo dentro del ZIP, sin extensión. */
  file: string;
  columns: readonly string[];
  ownerOnly: boolean;
};

/**
 * Columnas que no salen nunca, con su motivo. `invitations.token_hash` es el
 * resumen de la llave de una invitación: no la abre por sí solo, pero es
 * material de la llave y no le aporta nada a un respaldo.
 */
export const EXCLUDED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  invitations: ["token_hash"],
  // Mismo motivo, mismo patrón (KAM-28): el resumen del token de la
  // solicitud no abre nada por sí solo, pero es material de la llave.
  order_requests: ["token_hash"],
  // Mismo motivo (KAM-32): el enlace de seguimiento del pedido.
  order_shares: ["token_hash"],
};

/**
 * Tablas que no son de ninguna organización y por eso no salen en la
 * exportación de una, con su motivo. `platform_admins` (KAM-26) dice qué
 * cuentas administran la plataforma entera: no es un dato del taller, y
 * sacarla en el respaldo de uno sería contarle a su dueña quién más tiene
 * acceso a todo.
 */
export const EXCLUDED_TABLES: Readonly<Record<string, string>> = {
  platform_admins: "Registro de administradores de la plataforma, por encima de las organizaciones.",
};

export const EXPORT_TABLES: readonly ExportTable[] = [
  {
    table: "organizations",
    file: "organizacion",
    ownerOnly: false,
    columns: [
      "id",
      "name",
      "logo_path",
      "currency",
      "timezone",
      "settings",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "memberships",
    file: "membresias",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "user_id",
      "role",
      "display_name",
      "created_at",
      "archived_at",
    ],
  },
  {
    table: "membership_lines",
    file: "membresias-lineas",
    ownerOnly: false,
    columns: [
      "id",
      "membership_id",
      "business_line_id",
      "organization_id",
      "created_at",
      "archived_at",
    ],
  },
  {
    table: "invitations",
    file: "invitaciones",
    ownerOnly: true,
    columns: [
      "id",
      "organization_id",
      "email",
      "role",
      "expires_at",
      "accepted_at",
      "invited_by",
      "created_at",
      "archived_at",
    ],
  },
  {
    table: "business_lines",
    file: "lineas-de-negocio",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "name",
      "color",
      "icon",
      "is_shared",
      "position",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "sales_channels",
    file: "canales-de-venta",
    ownerOnly: false,
    columns: ["id", "organization_id", "name", "position", "archived_at"],
  },
  {
    table: "expense_categories",
    file: "categorias-de-gasto",
    ownerOnly: false,
    columns: ["id", "organization_id", "name", "archived_at"],
  },
  {
    table: "item_categories",
    file: "categorias-item",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "kind",
      "name",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "units",
    file: "unidades",
    ownerOnly: false,
    columns: ["id", "organization_id", "code", "name", "archived_at"],
  },
  {
    // KAM-27 · Qué herramientas activó la organización y con qué parámetros.
    // Solo de la dueña, como la tabla: los parámetros llevan tarifas y márgenes.
    table: "organization_tools",
    file: "herramientas",
    ownerOnly: true,
    columns: [
      "id",
      "organization_id",
      "slug",
      "config",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "statuses",
    file: "estados",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      "flow",
      "name",
      "kind",
      "color",
      "position",
      "is_queue",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "contacts",
    file: "contactos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "name",
      "phone",
      "email",
      "address",
      "is_supplier",
      "is_customer",
      "notes",
      "search_name",
      "created_by",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "items",
    file: "items",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      "kind",
      "name",
      "description",
      "unit_id",
      "sale_price",
      "min_stock",
      "search_name",
      "created_by",
      "created_at",
      "updated_at",
      "archived_at",
      // Añadida por `item-categories`: va donde la pone la base, al final.
      "category_id",
    ],
  },
  {
    table: "item_variants",
    file: "variantes",
    ownerOnly: false,
    columns: [
      "id",
      "item_id",
      "name",
      "attributes",
      "sale_price",
      "created_at",
      "updated_at",
      "archived_at",
      "organization_id",
    ],
  },
  {
    table: "asset_details",
    file: "activos",
    ownerOnly: true,
    columns: [
      "item_id",
      "organization_id",
      "id",
      "acquisition_cost",
      "acquired_on",
      "supplier_id",
      "notes",
    ],
  },
  {
    table: "attachments",
    file: "adjuntos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "entity_type",
      "entity_id",
      "bucket",
      "storage_path",
      "file_name",
      "mime_type",
      "size_bytes",
      "uploaded_by",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "orders",
    file: "pedidos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      "kind",
      "code",
      "contact_id",
      "status_id",
      "sales_channel_id",
      "delivery_mode",
      "due_date",
      "occurred_at",
      "queued_at",
      "notes",
      "created_by",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "order_items",
    file: "lineas-de-pedido",
    ownerOnly: false,
    columns: [
      "id",
      "order_id",
      "item_id",
      "variant_id",
      "description",
      "quantity",
      "unit_price",
      "created_at",
      "organization_id",
      "archived_at",
    ],
  },
  {
    table: "order_requests",
    file: "solicitudes-de-pedido",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      // token_hash excluida, ver EXCLUDED_COLUMNS.
      "contact_id",
      "prefilled_name",
      "prefilled_phone",
      "declared_name",
      "declared_phone",
      "declared_note",
      "expires_at",
      "submitted_at",
      "order_id",
      "archived_at",
      "created_by",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "order_shares",
    file: "enlaces-de-seguimiento",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "order_id",
      // token_hash excluida, ver EXCLUDED_COLUMNS.
      "expires_at",
      "archived_at",
      "created_by",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "order_comments",
    file: "comentarios-de-pedidos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "order_id",
      "author_name",
      "body",
      "occurred_at",
      "archived_at",
    ],
  },
  {
    table: "payments",
    file: "cobros-y-pagos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "direction",
      "order_id",
      "expense_id",
      "amount",
      "method",
      "occurred_at",
      "note",
      "created_by",
      "created_at",
      "archived_at",
    ],
  },
  {
    table: "expenses",
    file: "egresos",
    ownerOnly: true,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      "kind",
      "contact_id",
      "expense_category_id",
      "order_id",
      "amount",
      "occurred_at",
      "note",
      "created_by",
      "created_at",
      "updated_at",
      "archived_at",
      "asset_id",
      "asset_expense_role",
    ],
  },
  {
    table: "expense_items",
    file: "lineas-de-compra",
    ownerOnly: true,
    columns: [
      "id",
      "expense_id",
      "item_id",
      "variant_id",
      "quantity",
      "unit_price",
      "created_at",
      "organization_id",
    ],
  },
  {
    table: "inventory_movements",
    file: "movimientos-de-inventario",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "item_id",
      "variant_id",
      "kind",
      "quantity",
      "source_type",
      "source_id",
      "occurred_at",
      "note",
      "created_by",
      "created_at",
    ],
  },
  {
    table: "tasks",
    file: "tareas",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      "status_id",
      "title",
      "body_markdown",
      "assignee_id",
      "due_at",
      "remind_at",
      "closed_at",
      "closed_without_deliverables",
      "created_by",
      "created_at",
      "updated_at",
      "archived_at",
      // Añadida por `alter table` en KAM-30: aterriza al final del orden del
      // catálogo, y por eso va al final aquí (no junto a las demás columnas
      // del cuerpo) — ver kamay-new-table-checklist.
      "body_assisted_by_ai",
    ],
  },
  {
    table: "tags",
    file: "etiquetas",
    ownerOnly: false,
    columns: ["id", "organization_id", "name", "search_name", "created_at"],
  },
  {
    table: "task_tags",
    file: "tareas-etiquetas",
    ownerOnly: false,
    columns: ["task_id", "tag_id", "organization_id", "created_at"],
  },
  {
    table: "task_links",
    file: "vinculos-de-tareas",
    ownerOnly: false,
    columns: [
      "id",
      "task_id",
      "organization_id",
      "entity_type",
      "entity_id",
      "created_at",
      "archived_at",
    ],
  },
  {
    table: "task_deliverables",
    file: "entregables",
    ownerOnly: false,
    columns: [
      "id",
      "task_id",
      "organization_id",
      "deliverable_type",
      "fulfilled_type",
      "fulfilled_id",
      "fulfilled_at",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  },
  {
    table: "notifications",
    file: "avisos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "user_id",
      "type",
      "title",
      "body",
      "entity_type",
      "entity_id",
      "dedupe_key",
      "read_at",
      "created_at",
    ],
  },
  {
    table: "notification_preferences",
    file: "preferencias-de-avisos",
    ownerOnly: false,
    columns: [
      "id",
      "organization_id",
      "user_id",
      "due_summary",
      "task_assigned",
      "task_review",
      "task_overdue",
      "task_stalled",
      "stock_below_min",
      "daily_summary_hour",
      "email_enabled",
      "created_at",
      "updated_at",
      // Añadidas al final por `alter table`, cada una en el cambio que la
      // trajo (KAM-28, KAM-32): esa es su posición real en el catálogo, no
      // junto a los demás interruptores de tipo.
      "order_request_received",
      "order_comment_received",
    ],
  },
  {
    table: "activity_log",
    file: "bitacora",
    ownerOnly: true,
    columns: [
      "id",
      "organization_id",
      "business_line_id",
      "actor_id",
      "actor_label",
      "table_name",
      "record_id",
      "action",
      "changes",
      "origin",
      "occurred_at",
    ],
  },
  {
    // No lleva el trigger `audit` (no es una tabla cuyo historial le importe
    // a quien usa el taller), pero sí tiene `organization_id`: es dato de la
    // organización y la exportación completa no la deja fuera en silencio.
    table: "ai_writing_assist_requests",
    file: "solicitudes-de-asistencia-de-redaccion",
    ownerOnly: false,
    columns: ["id", "organization_id", "requested_by", "requested_at"],
  },
];
