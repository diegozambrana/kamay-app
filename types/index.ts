export type Role = "owner" | "assistant";

export type Organization = {
  id: string;
  name: string;
  logoPath: string | null;
  currency: string;
  timezone: string;
};

export type Membership = {
  id: string;
  organizationId: string;
  role: Role;
  displayName: string | null;
};

export type MembershipWithOrganization = Membership & {
  organization: Organization;
};

export type CurrentUser = {
  id: string;
  email: string;
};

/** Color de línea: token, no clase de Tailwind (ver `lib/business-lines/colors.ts`). */
export const LINE_COLORS = [
  "zinc",
  "blue",
  "violet",
  "orange",
  "green",
  "rose",
  "amber",
  "cyan",
] as const;

export type LineColor = (typeof LINE_COLORS)[number];

export type BusinessLine = {
  id: string;
  organizationId: string;
  name: string;
  color: LineColor;
  icon: string | null;
  isShared: boolean;
  position: number;
  archivedAt: string | null;
};

export const STATUS_FLOWS = ["order", "task"] as const;

export type StatusFlow = (typeof STATUS_FLOWS)[number];

/**
 * El contrato estable de un estado. Los nombres son configurables por
 * organización y por línea: ninguna condición del código usa `name`.
 */
export const STATUS_KINDS = [
  "initial",
  "in_progress",
  "waiting",
  "final",
  "cancelled",
] as const;

export type StatusKind = (typeof STATUS_KINDS)[number];

export type Status = {
  id: string;
  organizationId: string;
  /** `null` = juego de la organización; valor = juego propio de esa línea. */
  businessLineId: string | null;
  flow: StatusFlow;
  name: string;
  kind: StatusKind;
  color: LineColor;
  position: number;
  isQueue: boolean;
  archivedAt: string | null;
};

export type SalesChannel = {
  id: string;
  organizationId: string;
  name: string;
  position: number;
  archivedAt: string | null;
};

export type ExpenseCategory = {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: string | null;
};

export type Unit = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  archivedAt: string | null;
};

export type Invitation = {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  expiresAt: string;
  acceptedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

/**
 * Membresía tal como la lista la sección Usuarios y roles. No lleva el correo:
 * `auth.users` no es legible por el rol `authenticated`, así que la persona se
 * identifica por su `displayName`.
 */
export type MemberRow = Membership & {
  userId: string;
  archivedAt: string | null;
};

/** "Todas" no es una línea: es la ausencia deliberada de filtro. */
export const ALL_LINES = "all" as const;

export type ActiveLine = typeof ALL_LINES | string;

/** Tipo de ítem del catálogo. Insumos, productos y activos comparten tabla. */
export const ITEM_KINDS = ["supply", "product", "asset"] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export type Item = {
  id: string;
  organizationId: string;
  /** `null` = compartido entre todas las líneas. */
  businessLineId: string | null;
  kind: ItemKind;
  name: string;
  description: string | null;
  unitId: string | null;
  category: string | null;
  /** Precio de venta referencial. Nunca un costo: el costo vive en el egreso. */
  salePrice: number | null;
  /** Solo aplica a insumos; el saldo con el que se compara llega en KAM-18. */
  minStock: number | null;
  archivedAt: string | null;
};

export type ItemVariant = {
  id: string;
  organizationId: string;
  itemId: string;
  name: string;
  attributes: Record<string, unknown>;
  salePrice: number | null;
  archivedAt: string | null;
};

export type Contact = {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isSupplier: boolean;
  isCustomer: boolean;
  notes: string | null;
  archivedAt: string | null;
};

/** Filtro de rol del directorio (V13). "Todos" es la ausencia de filtro. */
export const CONTACT_ROLE_FILTERS = ["all", "supplier", "customer"] as const;

export type ContactRoleFilter = (typeof CONTACT_ROLE_FILTERS)[number];

/** Un evento de la bitácora tal como lo muestra el historial de V11. */
export type ActivityEntry = {
  id: number;
  action: "created" | "updated" | "status_changed" | "archived" | "unarchived";
  actorId: string | null;
  actorLabel: string | null;
  changes: Record<string, unknown> | null;
  occurredAt: string;
};

/** Registros a los que se puede adjuntar un archivo (esquema §13). */
export const ATTACHMENT_ENTITY_TYPES = [
  "task",
  "order",
  "expense",
  "item",
  "contact",
] as const;

export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export type Attachment = {
  id: string;
  organizationId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  bucket: string;
  /** Empieza siempre con el `organization_id`: lo verifica la política de Storage. */
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  archivedAt: string | null;
};

/** El bucket de las fotos del catálogo (esquema §13). */
export const ITEM_PHOTOS_BUCKET = "item-photos";

/** El bucket de los adjuntos de pedidos y tareas (esquema §13). */
export const ATTACHMENTS_BUCKET = "attachments";

/**
 * Pedido y venta directa comparten tabla (esquema §9): en el flujo de trabajo
 * son distintos, en almacenamiento comparten cliente, líneas, precios y
 * cobros. La interfaz mantiene los dos flujos separados.
 */
export const ORDER_KINDS = ["order", "direct_sale"] as const;

export type OrderKind = (typeof ORDER_KINDS)[number];

export const DELIVERY_MODES = ["pickup", "delivery"] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export type Order = {
  id: string;
  organizationId: string;
  businessLineId: string;
  kind: OrderKind;
  /** Número visible (#142), único dentro de la organización. Lo asigna la base. */
  code: number;
  /** Opcional solo en la venta directa: un pedido siempre tiene cliente. */
  contactId: string | null;
  statusId: string;
  salesChannelId: string | null;
  deliveryMode: DeliveryMode | null;
  dueDate: string | null;
  occurredAt: string;
  /** Momento de entrada a la columna de cola; `null` fuera de ella. */
  queuedAt: string | null;
  notes: string | null;
  archivedAt: string | null;
};

export type OrderItem = {
  id: string;
  organizationId: string;
  orderId: string;
  itemId: string | null;
  variantId: string | null;
  /** Personalización libre: "Foto de la familia, fondo azul". */
  description: string | null;
  quantity: number;
  /**
   * El precio vive aquí, no en el catálogo: un cambio de precio no reescribe
   * la historia (esquema §2).
   */
  unitPrice: number;
};

/**
 * El total nunca se almacena (convención nº 4): llega de la vista
 * `order_totals`, que lo suma desde las líneas. `paid` se añadirá con los
 * cobros (KAM-10).
 */
export type OrderTotals = {
  orderId: string;
  total: number;
};

/** Un pedido con lo que el tablero y el detalle necesitan mostrar. */
export type OrderWithContext = Order & {
  contactName: string | null;
  statusKind: StatusKind;
  lineColor: LineColor;
  total: number;
};
