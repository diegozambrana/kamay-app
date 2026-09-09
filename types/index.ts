import type { NotificationType } from "@/lib/notifications/types";

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

/** Una etiqueta de la organización. Se crean al vuelo desde la tarea. */
export type Tag = {
  id: string;
  organizationId: string;
  name: string;
};

/**
 * Los tipos de registro que una tarea puede referenciar.
 *
 * El dominio completo del canon (§12) vive aquí desde el principio, pero
 * KAM-15 solo escribe `order`: el resto lo abre KAM-21 con su interfaz de
 * vínculos.
 */
export const TASK_LINK_TYPES = [
  "order",
  "contact",
  "item",
  "expense",
  "asset",
] as const;

export type TaskLinkType = (typeof TASK_LINK_TYPES)[number];

export type TaskLink = {
  id: string;
  taskId: string;
  entityType: TaskLinkType;
  entityId: string;
};

/**
 * Una tarea tal como la lee el tablero.
 *
 * No lleva `bodyMarkdown`, `remindAt` ni `closedWithoutDeliverables`: las
 * columnas existen en la base desde KAM-15, pero las escriben y las leen
 * KAM-16, KAM-17 y KAM-21. Añadirlas aquí antes de que alguien las use sería
 * invitar a leerlas vacías.
 */
export type Task = {
  id: string;
  organizationId: string;
  businessLineId: string;
  statusId: string;
  title: string;
  assigneeId: string | null;
  /** El cuerpo tal como se escribió. Se sanea al rendirlo, nunca al guardarlo. */
  bodyMarkdown: string | null;
  /** Fecha límite en ISO, o `null`. */
  dueAt: string | null;
  /** Recordatorio en ISO. La base exige que haya fecha límite para fijarlo. */
  remindAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  archivedAt: string | null;
  tags: Tag[];
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
  /** Quién lo subió. La columna se escribía desde KAM-06b; aquí empieza a leerse. */
  uploadedBy: string | null;
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
  /**
   * Quitar una línea al editar el pedido la archiva; nunca se borra
   * (convención nº 3). Las archivadas no suman al total ni se muestran.
   */
  archivedAt: string | null;
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

/**
 * Egreso: compra (trae ítems) o gasto (no trae nada). Un solo concepto del
 * modelo 6.1 y una sola bandeja (V7); comparten tabla como pedido y venta
 * directa.
 */
export const EXPENSE_KINDS = ["purchase", "expense"] as const;

export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type Expense = {
  id: string;
  organizationId: string;
  businessLineId: string;
  kind: ExpenseKind;
  /** Proveedor. Obligatorio en la compra, ausente en el gasto. */
  contactId: string | null;
  /** Categoría. Obligatoria en el gasto, ausente en la compra. */
  expenseCategoryId: string | null;
  /** Gasto asignado a un pedido concreto (V9, "asignar a un pedido"). */
  orderId: string | null;
  /**
   * Solo los gastos llevan monto propio: la compra suma sus líneas y el total
   * llega de la vista `expense_totals` (convención nº 4).
   */
  amount: number | null;
  occurredAt: string;
  note: string | null;
  /** Activo al que pertenece este egreso, si pertenece a alguno (KAM-19). */
  assetId: string | null;
  /**
   * Qué hace este dinero por ese activo: `acquisition` es el egreso con el que
   * se compró —su importe ya está representado por el costo declarado y no
   * vuelve a sumar—, `maintenance` es lo gastado después en mantenerlo, que sí
   * sube el costo total. Se declara junto a `assetId` o no se declara.
   */
  assetExpenseRole: AssetExpenseRole | null;
  archivedAt: string | null;
};

export type ExpenseItem = {
  id: string;
  organizationId: string;
  expenseId: string;
  itemId: string;
  variantId: string | null;
  quantity: number;
  /**
   * El precio que se pagó. Vive aquí y no en el catálogo: es lo que hace
   * posible el último costo conocido sin reescribir la historia (esquema §2).
   */
  unitPrice: number;
};

/**
 * El total nunca se almacena (convención nº 4): llega de la vista
 * `expense_totals`, y con él lo pagado.
 */
export type ExpenseTotals = {
  expenseId: string;
  total: number;
  paid: number;
};

export const PAYMENT_DIRECTIONS = ["in", "out"] as const;

/** `in` es un cobro contra un pedido; `out`, un pago contra un egreso. */
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export const PAYMENT_METHODS = ["cash", "transfer", "other"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Estado de pago derivado de `total` y `paid`. No es una columna ni un campo
 * editable: se calcula al leer, en `lib/payments/balance.ts`.
 */
export type PaymentStatus = "pending" | "partial" | "paid" | "overpaid";

/**
 * Un movimiento real de dinero. Apunta a un pedido o a un egreso, nunca a los
 * dos, y su dirección la impone la base (esquema § Cobros y pagos).
 *
 * Es un hecho inmutable: se anula archivándolo, jamás se edita ni se borra.
 */
export type Payment = {
  id: string;
  organizationId: string;
  direction: PaymentDirection;
  orderId: string | null;
  expenseId: string | null;
  amount: number;
  method: PaymentMethod | null;
  occurredAt: string;
  note: string | null;
  createdBy: string | null;
  archivedAt: string | null;
};

/** Lo pendiente de una línea de negocio, tal como llega de la vista. */
export type OutstandingByLine = {
  organizationId: string;
  businessLineId: string;
  outstanding: number;
};

/** El bucket de los comprobantes de compra y gasto (esquema §13). */
export const RECEIPTS_BUCKET = "receipts";

/**
 * Un aviso ya escrito, tal como lo lee la bandeja.
 *
 * No es lo mismo que `PlannedNotification` de `lib/notifications/types.ts`:
 * aquel es la decisión antes de escribirla —sin `id`, sin `createdAt`, sin
 * `readAt`—, y este es la fila. Mantenerlos separados es lo que permite que la
 * decisión sea una función pura.
 */
export type Notification = {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Un grupo de la bandeja: los avisos de un mismo tipo (V21). */
export type NotificationGroup = {
  type: NotificationType;
  notifications: Notification[];
};

// ── Inventario (KAM-18) ───────────────────────────────────────────────────

export const MOVEMENT_KINDS = ["in", "out", "adjustment"] as const;

export type MovementKind = (typeof MOVEMENT_KINDS)[number];

/**
 * De dónde viene un movimiento.
 *
 * `order_item` está declarado en el esquema y **sin uso**: el índice único
 * `(source_type, source_id)` admitiría un solo movimiento por línea de pedido,
 * y consumir tres insumos distintos para la misma línea es el caso normal de
 * un taller. Todo consumo humano nace `manual`, venga del ítem, del pedido o
 * de la tarea; la referencia vive en la nota (design D5).
 */
export const MOVEMENT_SOURCES = [
  "expense_item",
  "order_item",
  "manual",
  "count",
] as const;

export type MovementSource = (typeof MOVEMENT_SOURCES)[number];

/**
 * Un movimiento de inventario: el único documento del que sale el saldo.
 *
 * No se edita, no se archiva y no se borra. Una corrección es siempre un
 * movimiento nuevo, así que aquí no hay `updatedAt` ni `archivedAt` — y su
 * ausencia no es un olvido.
 */
export type InventoryMovement = {
  id: string;
  organizationId: string;
  itemId: string;
  variantId: string | null;
  kind: MovementKind;
  /** Con signo: positiva entra, negativa sale. Nunca cero. */
  quantity: number;
  sourceType: MovementSource | null;
  sourceId: string | null;
  /** La hora del hecho, fijada por el dispositivo (convención nº 9). */
  occurredAt: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

/**
 * El saldo de un insumo, tal como lo expone `item_balances`.
 *
 * Es siempre derivado: ninguna columna lo almacena, y `belowMin` lo calcula la
 * propia vista para que el panel, el catálogo y V11 no puedan discrepar.
 */
export type ItemBalance = {
  itemId: string;
  organizationId: string;
  balance: number;
  minStock: number | null;
  belowMin: boolean;
};

// ── Activos (KAM-19) ────────────────────────────────────────────────────────

export const ASSET_EXPENSE_ROLES = ["acquisition", "maintenance"] as const;

export type AssetExpenseRole = (typeof ASSET_EXPENSE_ROLES)[number];

/**
 * Los datos propios de un activo: un ítem de tipo `asset` con lo que costó y
 * cuándo se compró. No lleva archivado propio — archivar la máquina es
 * archivar su ítem — ni ninguna cifra derivada.
 */
export type AssetDetails = {
  itemId: string;
  organizationId: string;
  /** Dato declarado, no copiado del egreso: una compra puede traer varias cosas. */
  acquisitionCost: number;
  acquiredOn: string;
  supplierId: string | null;
  notes: string | null;
};

/**
 * Un activo con sus ingredientes de recuperación, tal como los expone
 * `asset_recovery`. El porcentaje no viene de aquí: lo calcula
 * `lib/assets/recovery.ts`, que es donde vive la fórmula (design D5).
 */
export type AssetRecovery = {
  itemId: string;
  organizationId: string;
  /** `null` = compartido entre líneas: su recuperación no es atribuible. */
  businessLineId: string | null;
  name: string;
  acquiredOn: string;
  acquisitionCost: number;
  /** Suma de los egresos de mantenimiento vigentes del activo. */
  maintenanceCost: number;
  /** Costo declarado más mantenimiento. Es el denominador de la barra. */
  totalCost: number;
  /** Margen de caja de su línea desde `acquiredOn`. Puede ser negativo. */
  lineMarginSince: number;
};
