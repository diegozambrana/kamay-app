/**
 * Los seis tipos de aviso, iguales al `check` de `notifications`.
 *
 * El catálogo es cerrado a propósito y en dos sitios a la vez: un tipo nuevo
 * cuesta una migración revisada, no una cadena suelta en algún `insert`.
 */
export const NOTIFICATION_TYPES = [
  "due_summary",
  "task_assigned",
  "task_review",
  "task_overdue",
  "task_stalled",
  "stock_below_min",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Los tres tipos que además viajan por correo (delta spec `notifications`,
 * requisito "Correo transaccional para lo vencido y lo asignado").
 *
 * Está aquí y no en `lib/email/` porque la decisión es de producto —qué
 * merece salir de la aplicación— y no del transporte.
 */
export const EMAIL_TYPES = [
  "due_summary",
  "task_overdue",
  "task_assigned",
] as const satisfies readonly NotificationType[];

export function travelsByEmail(type: NotificationType): boolean {
  return (EMAIL_TYPES as readonly NotificationType[]).includes(type);
}

/** Preferencias de una persona, ya resueltas contra los valores por omisión. */
export type NotificationPreferences = {
  [K in NotificationType]: boolean;
} & {
  /** Hora local de la organización, 0–23. */
  dailySummaryHour: number;
  emailEnabled: boolean;
};

/**
 * Una notificación **decidida pero todavía no escrita**.
 *
 * Es lo que devuelve `plan()` y lo único que el manejador de ruta necesita
 * para insertar: la decisión completa, sin haber tocado la base ni la red.
 */
export type PlannedNotification = {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: "task" | "item" | null;
  entityId: string | null;
  dedupeKey: string;
};

/** Los tipos de estado que declara `statuses.kind` (convención nº 5). */
export type StatusKind =
  | "initial"
  | "in_progress"
  | "waiting"
  | "final"
  | "cancelled";

/**
 * Una tarea reducida a lo que la decisión necesita.
 *
 * No es la fila de `tasks`: es su proyección. Que `plan()` reciba esto y no un
 * registro de Supabase es lo que lo mantiene comprobable con literales.
 */
export type PlannableTask = {
  id: string;
  organizationId: string;
  title: string;
  /** Fecha límite en `YYYY-MM-DD`, o `null`. */
  dueDate: string | null;
  assigneeId: string | null;
  statusKind: StatusKind;
  /** Desde cuándo la tarea está en su estado actual, en ISO. */
  statusSince: string | null;
  closed: boolean;
};

/** Una persona de la organización con sus preferencias ya resueltas. */
export type PlannableMember = {
  userId: string;
  preferences: NotificationPreferences;
};

/** Todo lo que hace falta para decidir los avisos de una organización. */
export type OrganizationPlanInput = {
  organizationId: string;
  /** "Hoy" en la zona de la organización, `YYYY-MM-DD`. */
  today: string;
  /** La hora local de la organización en esta pasada, 0–23. */
  localHour: number;
  tasks: PlannableTask[];
  members: PlannableMember[];
};
