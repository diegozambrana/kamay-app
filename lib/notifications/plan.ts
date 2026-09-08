import {
  dueSummaryKey,
  taskAssignedKey,
  taskOverdueKey,
  taskReviewKey,
  taskStalledKey,
} from "./dedupe";
import type {
  OrganizationPlanInput,
  PlannableMember,
  PlannableTask,
  PlannedNotification,
} from "./types";

/**
 * Cuántos días sin moverse en un estado `in_progress` convierten a una tarea
 * en estancada.
 *
 * Siete: menos convertiría en «estancada» cualquier cosa que cruce un fin de
 * semana, que es justo lo que un taller de tres personas hace con normalidad.
 */
export const STALLED_DAYS = 7;

/**
 * **Toda la regla anti-ruido vive aquí, y aquí no hay red ni base ni reloj.**
 *
 * Es la decisión sobre quién recibe qué, a partir de datos ya leídos. El
 * manejador de ruta hace tres cosas y en este orden: leer, llamar a esto,
 * escribir lo que devuelva. Que la decisión sea una función de sus argumentos
 * es lo que permite comprobar «cinco tareas, un aviso» con literales en lugar
 * de sembrar una base y esperar a que pase una hora.
 *
 * Devuelve los avisos del **trabajo programado**: resumen, vencidas y
 * estancadas. Los de asignación y revisión son reacciones a un acto concreto y
 * los deciden `planAssignment()` y `planStatusChange()` (design D5).
 */
export function planScheduled(
  input: OrganizationPlanInput,
): PlannedNotification[] {
  const open = input.tasks.filter(isOpen);
  const planned: PlannedNotification[] = [];

  for (const member of input.members) {
    planned.push(...planSummaryFor(member, open, input));
    planned.push(...planOverdueFor(member, open, input));
    planned.push(...planStalledFor(member, open, input));
  }

  return planned;
}

/**
 * El resumen diario de una persona: **como máximo uno**.
 *
 * La agrupación ocurre aquí, al generar, y no en la bandeja: por eso el
 * criterio «cinco tareas que vencen hoy, un solo aviso» se puede comprobar sin
 * mirar ninguna pantalla, y seguiría cumpliéndose si la bandeja cambiara de
 * forma (design D10).
 */
function planSummaryFor(
  member: PlannableMember,
  open: PlannableTask[],
  input: OrganizationPlanInput,
): PlannedNotification[] {
  if (!member.preferences.due_summary) return [];

  // La hora que esta persona eligió, comparada contra la hora **local de su
  // organización**. El trabajo corre cada hora y en cada pasada atiende a
  // quien coincide (design D4): así una sola entrada de cron sirve a cualquier
  // hora y a cualquier zona.
  if (member.preferences.dailySummaryHour !== input.localHour) return [];

  const mine = open.filter((task) => task.assigneeId === member.userId);
  const overdue = mine.filter((task) => isOverdue(task, input.today));
  const dueToday = mine.filter((task) => task.dueDate === input.today);

  // Sin nada que vencer no se avisa. Un resumen que dice «no tienes nada» cada
  // mañana es la primera cosa que alguien silencia.
  if (overdue.length === 0 && dueToday.length === 0) return [];

  return [
    {
      organizationId: input.organizationId,
      userId: member.userId,
      type: "due_summary",
      title: summaryTitle(overdue.length, dueToday.length),
      body: summaryBody([...overdue, ...dueToday]),
      entityType: null,
      entityId: null,
      dedupeKey: dueSummaryKey(input.today),
    },
  ];
}

/** Lo vencido, un aviso por tarea y vencimiento — no por pasada del cron. */
function planOverdueFor(
  member: PlannableMember,
  open: PlannableTask[],
  input: OrganizationPlanInput,
): PlannedNotification[] {
  if (!member.preferences.task_overdue) return [];

  return open
    .filter(
      (task) =>
        task.assigneeId === member.userId && isOverdue(task, input.today),
    )
    .map((task) => ({
      organizationId: input.organizationId,
      userId: member.userId,
      type: "task_overdue" as const,
      title: `Se venció «${task.title}»`,
      body: `La fecha límite era el ${task.dueDate}.`,
      entityType: "task" as const,
      entityId: task.id,
      // `task.dueDate` no es nulo: `isOverdue` ya lo garantiza.
      dedupeKey: taskOverdueKey(task.id, task.dueDate!),
    }));
}

/** Lo que lleva demasiado quieto en un estado de tipo `in_progress`. */
function planStalledFor(
  member: PlannableMember,
  open: PlannableTask[],
  input: OrganizationPlanInput,
): PlannedNotification[] {
  if (!member.preferences.task_stalled) return [];

  return open
    .filter(
      (task) =>
        task.assigneeId === member.userId &&
        task.statusKind === "in_progress" &&
        isStalled(task.statusSince, input.today),
    )
    .map((task) => ({
      organizationId: input.organizationId,
      userId: member.userId,
      type: "task_stalled" as const,
      title: `«${task.title}» lleva tiempo sin moverse`,
      body: `Sigue en curso desde hace más de ${STALLED_DAYS} días.`,
      entityType: "task" as const,
      entityId: task.id,
      dedupeKey: taskStalledKey(task.id, task.statusSince!),
    }));
}

/**
 * El aviso de una asignación, decidido en el momento del acto.
 *
 * **Asignarse a uno mismo no avisa.** Nadie necesita que le cuenten lo que
 * acaba de hacer, y un sistema que lo hace enseña a ignorar sus propios avisos.
 */
export function planAssignment(input: {
  organizationId: string;
  task: Pick<PlannableTask, "id" | "title">;
  assigneeId: string | null;
  actorId: string;
  preferences: PlannableMember["preferences"] | null;
}): PlannedNotification[] {
  const { assigneeId } = input;
  if (!assigneeId || assigneeId === input.actorId) return [];
  if (input.preferences && !input.preferences.task_assigned) return [];

  return [
    {
      organizationId: input.organizationId,
      userId: assigneeId,
      type: "task_assigned",
      title: `Te asignaron «${input.task.title}»`,
      body: null,
      entityType: "task",
      entityId: input.task.id,
      dedupeKey: taskAssignedKey(input.task.id, assigneeId),
    },
  ];
}

/**
 * El aviso de entrada en revisión.
 *
 * **Qué es «revisión» lo dice el tipo del estado, nunca su nombre**
 * (convención nº 5): en el flujo de tareas, `waiting` es esperar a que alguien
 * revise —a diferencia del flujo de pedidos, donde significa esperar al
 * cliente—. Renombrar «En revisión» a cualquier otra cosa no cambia nada de
 * esto, que es justamente lo que el escenario comprueba.
 *
 * Avisa a quien **no** provocó el cambio: al responsable si lo movió otro, y a
 * nadie si el responsable se lo movió a sí mismo.
 */
export function planStatusChange(input: {
  organizationId: string;
  task: Pick<PlannableTask, "id" | "title" | "assigneeId">;
  statusId: string;
  statusKind: PlannableTask["statusKind"];
  actorId: string;
  preferences: PlannableMember["preferences"] | null;
}): PlannedNotification[] {
  if (input.statusKind !== "waiting") return [];

  const recipient = input.task.assigneeId;
  if (!recipient || recipient === input.actorId) return [];
  if (input.preferences && !input.preferences.task_review) return [];

  return [
    {
      organizationId: input.organizationId,
      userId: recipient,
      type: "task_review",
      title: `«${input.task.title}» quedó en revisión`,
      body: null,
      entityType: "task",
      entityId: input.task.id,
      dedupeKey: taskReviewKey(input.task.id, input.statusId),
    },
  ];
}

/**
 * Una tarea cerrada deja de avisar: ya no hay nada que apurar. Es el mismo
 * criterio que `dueSignal()` aplica al semáforo del tablero.
 */
function isOpen(task: PlannableTask): boolean {
  return !task.closed;
}

/**
 * **Sin fecha límite no hay vencimiento.** No es «a tiempo»: es que no hay
 * nada que medir, y por eso una tarea sin fecha no entra en ningún resumen ni
 * genera ningún aviso de vencimiento.
 *
 * La comparación es lexicográfica sobre `YYYY-MM-DD`, como en el resto del
 * proyecto: ese formato ordena como el calendario y no reintroduce el huso
 * horario por detrás.
 */
function isOverdue(task: PlannableTask, today: string): boolean {
  return task.dueDate !== null && task.dueDate < today;
}

function isStalled(statusSince: string | null, today: string): boolean {
  if (!statusSince) return false;

  const since = Date.parse(statusSince);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(since) || Number.isNaN(now)) return false;

  return (now - since) / 86_400_000 > STALLED_DAYS;
}

function summaryTitle(overdue: number, dueToday: number): string {
  if (overdue > 0 && dueToday > 0) {
    return `Tienes ${overdue} ${plural(overdue, "tarea vencida", "tareas vencidas")} y ${dueToday} para hoy`;
  }
  if (overdue > 0) {
    return `Tienes ${overdue} ${plural(overdue, "tarea vencida", "tareas vencidas")}`;
  }
  return `Tienes ${dueToday} ${plural(dueToday, "tarea", "tareas")} para hoy`;
}

/** Los títulos van en el cuerpo del resumen: es lo que lo hace útil sin abrirlo. */
function summaryBody(tasks: PlannableTask[]): string {
  return tasks.map((task) => task.title).join(" · ");
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
