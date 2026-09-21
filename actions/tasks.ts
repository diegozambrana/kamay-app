"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { monthlyRequestLimit } from "@/lib/ai/config";
import { resolveAiAssistant } from "@/lib/ai/resolve";
import { getSessionContext } from "@/lib/auth/session-context";
import {
  FILE_TOO_LARGE_MESSAGE,
  batchLimitMessage,
  fitsBatch,
  fitsFileSize,
} from "@/lib/attachments/limits";
import { toggleChecklistItem } from "@/lib/markdown/checklist";
import {
  DELIVERABLE_DEFINITIONS,
  DELIVERABLE_TYPES,
  canDeclare,
} from "@/lib/tasks/deliverables";
import { retargetStatusForLine } from "@/lib/tasks/line-change";
import { taskSchema } from "@/lib/tasks/schema";
import { AiUsageService } from "@/services/ai/usage-service";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { AiWritingAssistService } from "@/services/configuration/ai-writing-assist-service";
import { emitTaskEvents } from "@/services/notifications/emit-task-events";
import { StatusService } from "@/services/configuration/status-service";
import { TagService } from "@/services/tasks/tag-service";
import { TaskService } from "@/services/tasks/task-service";
import type {
  LinkTarget,
  RelatedTask,
} from "@/services/tasks/task-service";
import { ATTACHMENTS_BUCKET, TASK_LINK_TYPES } from "@/types";

export type TaskActionResult = { error: string } | undefined;

export type CreateTaskResult = { error: string } | { taskId: string };

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

const taskIdSchema = z.object({ taskId: z.guid() });

const moveTaskSchema = taskIdSchema.extend({ statusId: z.guid() });

const updateTaskSchema = taskIdSchema.extend({
  title: z
    .string()
    .trim()
    .min(1, "El título no puede quedar vacío.")
    .max(200)
    .optional(),
  businessLineId: z.guid().optional(),
  assigneeId: z.guid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  remindAt: z.iso.datetime().nullable().optional(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
});

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
}

/**
 * Crea una tarea.
 *
 * El estado inicial no viaja: lo pone la base resolviendo el juego de la línea
 * (design D3), que es lo que permite que el alta rápida mande dos campos. El
 * responsable, si no se indica, es quien la crea (§6.3).
 */
export async function createTask(
  input: z.infer<typeof taskSchema>,
): Promise<CreateTaskResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tagIds = await new TagService(context.supabase).resolveNames(
      context.organizationId,
      parsed.data.tagNames ?? [],
    );

    const taskId = await new TaskService(context.supabase).create(
      context.organizationId,
      parsed.data,
      context.userId,
      tagIds,
    );

    revalidateTasks();
    return { taskId };
  } catch {
    return { error: "No se pudo crear la tarea. Intenta de nuevo." };
  }
}

/**
 * Mueve una tarea a otra columna, en cualquier dirección.
 *
 * Volver atrás no es un caso especial y no lleva ninguna rama: es el mismo
 * cambio de estado. Lo único que se comprueba es que la columna destino
 * pertenezca al juego resuelto de la línea de la tarea — la interfaz solo
 * ofrece columnas válidas, pero la acción no confía en la interfaz.
 *
 * Nada más ocurre aquí: `closed_at` lo lleva el trigger, y **ninguna escritura
 * sobre `orders` cuelga de este movimiento** (convención nº 10).
 */
export async function moveTaskToStatus(
  input: z.infer<typeof moveTaskSchema>,
): Promise<TaskActionResult> {
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la tarea." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "La tarea ya no está disponible." };

    const statuses = await new StatusService(context.supabase).resolve(
      context.organizationId,
      task.businessLineId,
      "task",
    );

    if (!statuses.some((status) => status.id === parsed.data.statusId)) {
      return { error: "Esa columna no pertenece al flujo de esta línea." };
    }

    await tasks.moveToStatus(
      context.organizationId,
      parsed.data.taskId,
      parsed.data.statusId,
    );

    // Después de que la escritura haya tenido éxito, nunca antes: un aviso de
    // algo que no llegó a pasar es peor que ningún aviso.
    const moved = statuses.find((s) => s.id === parsed.data.statusId)!;
    await emitTaskEvents({
      organizationId: context.organizationId,
      actorId: context.userId,
      task: { id: task.id, title: task.title, assigneeId: task.assigneeId },
      status: { id: moved.id, kind: moved.kind },
    });
  } catch {
    return { error: "No se pudo mover la tarea. Intenta de nuevo." };
  }

  revalidateTasks();
}

/**
 * Guarda de una vez los datos que **describen** la tarea: título, línea,
 * responsable, fecha límite, recordatorio y etiquetas.
 *
 * Es el guardado de `/tasks/[id]/edit` (KAM-29). Un campo `undefined` no se
 * escribe: el formulario manda **solo los campos que se tocaron** (design D2),
 * y esa es la razón de que dos pantallas abiertas a la vez no se pisen —lo que
 * este formulario no menciona, no puede sobrescribirlo— y de que la bitácora
 * registre exactamente los campos cambiados y ninguno más.
 *
 * El estado no entra aquí: se cambia desde el detalle con `updateTaskField`.
 * La única forma en que esta acción lo toca es al reubicarlo cuando cambia la
 * línea (design D4).
 */
export async function updateTaskFields(
  input: z.infer<typeof updateTaskSchema>,
): Promise<TaskActionResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "No se pudieron guardar los cambios.",
    };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const { taskId, title, businessLineId, assigneeId, dueDate, remindAt, tagNames } =
    parsed.data;

  try {
    const tasks = new TaskService(context.supabase);

    // Se lee siempre antes de escribir: las reglas se comprueban contra la
    // tarea guardada, no contra la copia que la pantalla creía tener.
    const before = await tasks.getById(context.organizationId, taskId);
    if (!before) return { error: "Esa tarea ya no está a tu alcance." };
    if (before.archivedAt) {
      return { error: "Esta tarea está archivada. Desarchívala para editarla." };
    }

    /**
     * Quitar la fecha límite se lleva por delante el recordatorio guardado:
     * dejarlo colgando rompería `reminder_needs_due_date` en la siguiente
     * escritura. Pero solo si la edición **no menciona** el recordatorio: un
     * recordatorio recién escrito no se tira en silencio, se rechaza abajo.
     */
    const remindPatch =
      remindAt !== undefined ? remindAt : dueDate === null ? null : undefined;

    /**
     * El recordatorio se valida contra **el resultado**: la fecha límite que
     * quedará y el recordatorio que quedará, vengan del formulario o de la
     * tarea. Un formulario que solo toca el recordatorio no trae la fecha, y
     * uno que borra la fecha y fija un recordatorio a la vez se contradice.
     */
    const resultingDue = dueDate !== undefined ? dueDate : before.dueAt;
    const resultingRemind = remindPatch !== undefined ? remindPatch : before.remindAt;

    if (resultingRemind !== null && !resultingDue) {
      return {
        error:
          "Primero ponle una fecha límite a la tarea; el recordatorio cuelga de ella.",
      };
    }

    /**
     * Cambiar la línea reubica el estado (spec `tasks`, design D4).
     *
     * `assign_initial_task_status` es un trigger `before insert`: sin esto la
     * tarea se quedaría con el estado del juego de la línea vieja y
     * desaparecería del tablero de su línea nueva.
     */
    let retargetedStatusId: string | undefined;

    if (businessLineId !== undefined && businessLineId !== before.businessLineId) {
      const statusService = new StatusService(context.supabase);

      // El estado actual puede estar archivado y no aparecer en ningún juego
      // resuelto: se busca entre todos los del flujo para conocer su tipo.
      const all = await statusService.listAllForFlow(context.organizationId, "task");
      const current = all.find((status) => status.id === before.statusId);
      if (!current) {
        return { error: "No se pudo identificar el estado actual de la tarea." };
      }

      const destination = await statusService.resolve(
        context.organizationId,
        businessLineId,
        "task",
      );

      const retarget = retargetStatusForLine(current, destination);
      if (retarget.kind === "impossible") {
        return {
          error: `La línea de destino no tiene ningún estado equivalente a «${current.name}». Configúrale uno antes de mover la tarea.`,
        };
      }
      if (retarget.kind === "moved") retargetedStatusId = retarget.status.id;
    }

    await tasks.updateFields(context.organizationId, taskId, {
      title,
      businessLineId,
      assigneeId,
      dueDate,
      remindAt: remindPatch,
      ...(retargetedStatusId ? { statusId: retargetedStatusId } : {}),
    });

    // Reasignar a quien ya la tenía no es un hecho nuevo y no debe avisar.
    if (assigneeId !== undefined && before.assigneeId !== assigneeId) {
      await emitTaskEvents({
        organizationId: context.organizationId,
        actorId: context.userId,
        task: {
          id: before.id,
          title: title ?? before.title,
          assigneeId: assigneeId ?? null,
        },
        assignedTo: assigneeId ?? null,
      });
    }

    if (tagNames) {
      const tagIds = await new TagService(context.supabase).resolveNames(
        context.organizationId,
        tagNames,
      );
      await tasks.setTags(context.organizationId, taskId, tagIds);
    }
  } catch {
    return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }

  revalidateTasks();
  revalidatePath(`/tasks/${taskId}`);
}

/** Archivar es del dueño; lo hace cumplir el trigger de la base. */
export async function archiveTask(
  input: z.infer<typeof taskIdSchema>,
): Promise<TaskActionResult> {
  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la tarea." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new TaskService(context.supabase).archive(
      context.organizationId,
      parsed.data.taskId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("dueña")) {
      return { error: "Solo la persona dueña puede archivar." };
    }
    return { error: "No se pudo archivar la tarea. Intenta de nuevo." };
  }

  revalidateTasks();
}

// ── KAM-16 · Detalle de tarea ──────────────────────────────────────────────
// El estado se cambia **desde el detalle**, de a uno, sin pasar por la
// edición: es lo que se hace mientras se trabaja, y arrastrar una tarjeta en
// el tablero ya lo cambia sin abrir nada (KAM-29).
//
// KAM-16 guardaba así los siete campos de la cabecera. KAM-29 mudó los otros
// seis a `updateTaskFields`, que los escribe de una vez desde el formulario;
// aquí solo queda el estado.

const updateTaskFieldSchema = z.object({
  taskId: z.guid(),
  field: z.literal("statusId"),
  value: z.guid(),
});

export type UpdateTaskFieldInput = z.infer<typeof updateTaskFieldSchema>;

/**
 * Cambia el estado de la tarea desde el detalle.
 *
 * Una tarea archivada se rechaza **aquí**, con su mensaje: la base lo impide
 * igualmente —el trigger `enforce_archive`—, pero un error de restricción no
 * le dice a nadie qué hacer a continuación.
 */
export async function updateTaskField(
  input: UpdateTaskFieldInput,
): Promise<TaskActionResult> {
  const parsed = updateTaskFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "No se pudo guardar el cambio." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const { taskId, field, value } = parsed.data;

  try {
    const tasks = new TaskService(context.supabase);

    const task = await tasks.getById(context.organizationId, taskId);
    if (!task) return { error: "Esa tarea ya no está a tu alcance." };
    if (task.archivedAt) {
      return { error: "Esta tarea está archivada. Desarchívala para editarla." };
    }

    await tasks.updateFields(context.organizationId, taskId, { [field]: value });
  } catch {
    return { error: "No se pudo guardar el cambio. Intenta de nuevo." };
  }

  revalidateTasks();
  revalidatePath(`/tasks/${taskId}`);
}

const updateTaskBodySchema = taskIdSchema.extend({
  body: z.string().max(50_000),
  /**
   * Si el cuerpo que se guarda proviene de una propuesta de IA aceptada en
   * esta sesión de edición (KAM-30). Por omisión, no: un guardado que no lo
   * declara es una edición manual, y apaga la marca de un guardado asistido
   * anterior.
   */
  assisted: z.boolean().optional(),
});

/**
 * Guarda el cuerpo tal como se escribió, sin transformarlo.
 *
 * No se sanea aquí: sanear al guardar destruiría lo que la persona escribió y
 * haría irreversible un falso positivo. El saneado ocurre al rendir, en cada
 * lectura, y por eso protege también lo guardado antes de que existiera
 * (design D1).
 */
export async function updateTaskBody(
  input: z.infer<typeof updateTaskBodySchema>,
): Promise<TaskActionResult> {
  const parsed = updateTaskBodySchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo guardar la descripción." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "Esa tarea ya no está a tu alcance." };
    if (task.archivedAt) {
      return { error: "Esta tarea está archivada. Desarchívala para editarla." };
    }

    await tasks.updateFields(context.organizationId, parsed.data.taskId, {
      bodyMarkdown: parsed.data.body === "" ? null : parsed.data.body,
      bodyAssistedByAi: parsed.data.assisted ?? false,
    });
  } catch {
    return { error: "No se pudo guardar la descripción. Intenta de nuevo." };
  }

  revalidateTasks();
  revalidatePath(`/tasks/${parsed.data.taskId}`);
}

const proposeBodyImprovementSchema = taskIdSchema.extend({
  body: z.string().trim().min(1, "No hay nada que mejorar."),
});

export type ProposeBodyImprovementResult = { error: string } | { proposal: string };

/**
 * Pide al modelo una versión mejorada del cuerpo de la tarea (KAM-30).
 *
 * Nunca escribe nada: solo devuelve la propuesta para que el editor la
 * muestre junto al texto actual. Cada rechazo se comprueba en el servidor,
 * sin confiar en que la interfaz ya lo hizo (spec `ai-writing-assist`).
 */
export async function proposeTaskBodyImprovement(
  input: z.infer<typeof proposeBodyImprovementSchema>,
): Promise<ProposeBodyImprovementResult> {
  const parsed = proposeBodyImprovementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "No se pudo generar la propuesta." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  // Variable de entorno ausente: la función queda apagada para todas las
  // organizaciones, sin importar su interruptor propio.
  const assistant = resolveAiAssistant();
  if (!assistant) return { error: "La asistencia de redacción no está disponible." };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "Esa tarea ya no está a tu alcance." };
    if (task.archivedAt) {
      return { error: "Esta tarea está archivada. Desarchívala para editarla." };
    }

    const settings = await new AiWritingAssistService(context.supabase).get(
      context.organizationId,
    );
    if (!settings.enabled) {
      return { error: "Tu organización no activó la asistencia de redacción." };
    }

    const usage = new AiUsageService(context.supabase);
    const used = await usage.countCurrentPeriod(context.organizationId);
    if (used >= monthlyRequestLimit()) {
      return { error: "Se alcanzó el límite de uso de la asistencia de redacción este mes." };
    }

    // Se cuenta antes de llamar al proveedor (design.md → "Cuándo se
    // cuenta"): a prueba de reintentos y de condiciones de carrera.
    await usage.recordRequest(context.organizationId, context.userId);

    const { proposal } = await assistant.proposeBodyImprovement(parsed.data.body);
    return { proposal };
  } catch {
    return { error: "El proveedor de IA no respondió. Intenta de nuevo." };
  }
}

const toggleChecklistSchema = taskIdSchema.extend({
  index: z.number().int().min(0),
  checked: z.boolean(),
});

/**
 * Marca o desmarca una casilla del cuerpo.
 *
 * La reescritura se hace **sobre el cuerpo recién leído del servidor**, no
 * sobre la copia que el navegador tenía cargada (design D3). Es la diferencia
 * entre marcar el paso 3 y borrar sin querer el párrafo que la otra persona
 * añadió hace diez segundos.
 */
export async function toggleTaskChecklistItem(
  input: z.infer<typeof toggleChecklistSchema>,
): Promise<TaskActionResult> {
  const parsed = toggleChecklistSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo marcar la casilla." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "Esa tarea ya no está a tu alcance." };
    if (task.archivedAt) {
      return { error: "Esta tarea está archivada. Desarchívala para editarla." };
    }

    const body = task.bodyMarkdown ?? "";
    const next = toggleChecklistItem(body, parsed.data.index, parsed.data.checked);

    // Si el cuerpo cambió entre el clic y la escritura, el índice puede no
    // existir: `toggleChecklistItem` devuelve el cuerpo intacto y aquí no se
    // escribe nada, en vez de adivinar a qué casilla se refería.
    if (next === body) return;

    await tasks.updateFields(context.organizationId, parsed.data.taskId, {
      bodyMarkdown: next,
    });
  } catch {
    return { error: "No se pudo marcar la casilla. Intenta de nuevo." };
  }

  revalidateTasks();
  revalidatePath(`/tasks/${parsed.data.taskId}`);
}

// ── KAM-16 · Adjuntos de la tarea ──────────────────────────────────────────
// Sobre `AttachmentService`, que ya resuelve ruta canónica, subida con
// retirada del objeto si la fila falla, archivado y firma en lote. Aquí solo
// se añade lo propio de la tarea: el tipo de entidad y el límite.

const attachmentIdSchema = taskIdSchema.extend({ attachmentId: z.guid() });

/**
 * Adjunta un archivo a la tarea.
 *
 * El límite se cuenta **en el servidor** antes de subir (design D5): una
 * comprobación que solo viva en la pantalla no impide nada, porque basta con
 * llamar a esta acción. La pantalla lo comprueba igualmente, pero para avisar
 * antes de comprimir, no como defensa.
 */
export async function attachToTask(formData: FormData): Promise<TaskActionResult> {
  const target = taskIdSchema.safeParse({ taskId: formData.get("taskId") });
  if (!target.success) return { error: "No se pudo identificar la tarea." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No llegó ningún archivo." };
  }
  if (!fitsFileSize(file.size)) return { error: FILE_TOO_LARGE_MESSAGE };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, target.data.taskId);
    if (!task) return { error: "Esa tarea ya no está a tu alcance." };
    if (task.archivedAt) {
      return { error: "Esta tarea está archivada. Desarchívala para editarla." };
    }

    const attachments = new AttachmentService(context.supabase);
    const activos = await attachments.countActive(
      context.organizationId,
      "task",
      task.id,
    );
    if (!fitsBatch(activos, 1)) return { error: batchLimitMessage(activos, 1) };

    await attachments.upload(context.organizationId, context.userId, {
      // Identificador del servidor: aquí no hay modo sin conexión que servir,
      // el archivo ya está viajando.
      id: crypto.randomUUID(),
      entityType: "task",
      entityId: task.id,
      bucket: ATTACHMENTS_BUCKET,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      body: await file.arrayBuffer(),
    });
  } catch {
    return { error: "No se pudo subir el adjunto. Intenta de nuevo." };
  }

  revalidatePath(`/tasks/${target.data.taskId}`);
}

/** Retirar archiva, nunca borra: la historia de una tarea no se reescribe. */
export async function detachFromTask(
  input: z.infer<typeof attachmentIdSchema>,
): Promise<TaskActionResult> {
  const parsed = attachmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el adjunto." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new AttachmentService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.attachmentId,
      true,
    );
  } catch {
    return { error: "No se pudo quitar el adjunto. Intenta de nuevo." };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
}

// ── V20 · Mis pendientes ────────────────────────────────────────────────────

const completeTaskSchema = taskIdSchema.extend({
  /** El estado en que estaba, para poder deshacer sin adivinarlo. */
  previousStatusId: z.guid().optional(),
});

const postponeSchema = taskIdSchema.extend({
  /** "Mañana" ya calculado en la zona de la organización por quien llama. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Marcar hecha desde *Mis pendientes*.
 *
 * **No escribe `closed_at` a mano.** Resuelve el estado de tipo `final` del
 * juego que corresponde a la línea de la tarea y la mueve allí, que es lo que
 * ya hace el arrastre del tablero: así el cierre lo deriva el mismo mecanismo
 * y no hay dos verdades sobre qué significa «hecha» (design D9). El
 * `closed_at` lo pone el trigger, como siempre.
 *
 * El estado se identifica por su `kind`, nunca por su nombre (convención
 * nº 5): renombrar «Hecho» no cambia nada.
 */
export async function completeTask(
  input: z.infer<typeof completeTaskSchema>,
): Promise<TaskActionResult> {
  const parsed = completeTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la tarea." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "La tarea ya no está disponible." };

    const statuses = await new StatusService(context.supabase).resolve(
      context.organizationId,
      task.businessLineId,
      "task",
    );

    const final = statuses.find((status) => status.kind === "final");
    if (!final) {
      // La base exige un `final` por juego, así que esto no debería ocurrir;
      // si ocurre, decirlo es mejor que cerrar la tarea de otra manera.
      return { error: "Esta línea no tiene un estado final configurado." };
    }

    await tasks.moveToStatus(context.organizationId, parsed.data.taskId, final.id);
  } catch {
    return { error: "No se pudo marcar la tarea. Intenta de nuevo." };
  }

  revalidateTasks();
}

/**
 * Deshacer el marcado: devolver la tarea al estado en que estaba.
 *
 * Es `moveToStatus` con el estado anterior, no un «reabrir» propio: el cierre
 * se deriva de la posición, así que devolverla a su columna la reabre sola.
 */
export async function uncompleteTask(
  input: z.infer<typeof moveTaskSchema>,
): Promise<TaskActionResult> {
  return moveTaskToStatus(input);
}

/**
 * Posponer a mañana con un solo gesto.
 *
 * Escribe `due_at` y **ningún campo nuevo**: posponer es cambiar la fecha
 * límite, no anotar un aplazamiento aparte.
 *
 * «Mañana» llega ya calculado en la zona horaria de la organización —lo
 * resuelve la pantalla con `todayInTimezone`—, no en la del navegador: una
 * tarea pospuesta a las 23:50 no debe saltar dos días.
 */
export async function postponeTask(
  input: z.infer<typeof postponeSchema>,
): Promise<TaskActionResult> {
  const parsed = postponeSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo posponer la tarea." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new TaskService(context.supabase).updateFields(
      context.organizationId,
      parsed.data.taskId,
      { dueDate: parsed.data.dueDate },
    );
  } catch {
    return { error: "No se pudo posponer la tarea. Intenta de nuevo." };
  }

  revalidateTasks();
}

// ── KAM-21 · Vínculos ────────────────────────────────────────────────────

const linkSchema = taskIdSchema.extend({
  entityType: z.enum(TASK_LINK_TYPES),
  entityId: z.guid(),
});

/**
 * Vincula la tarea con otro registro.
 *
 * El activo solo lo vincula la persona dueña (D9). Comprobarlo aquí no
 * sustituye a RLS —`asset_details` ya devolvería cero filas al ayudante—;
 * evita disparar una escritura que la base va a rechazar y da un mensaje
 * entendible en vez de un error de Postgres.
 */
export async function linkTask(
  input: z.infer<typeof linkSchema>,
): Promise<TaskActionResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el vínculo." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const isOwner = context.role === "owner";
  if (parsed.data.entityType === "asset" && !isOwner) {
    return { error: "Solo la persona dueña vincula activos." };
  }

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "La tarea ya no está disponible." };
    if (task.archivedAt !== null) {
      return { error: "Una tarea archivada no se edita." };
    }

    await tasks.link(
      context.organizationId,
      parsed.data.taskId,
      parsed.data.entityType,
      parsed.data.entityId,
    );
  } catch {
    return { error: "No se pudo vincular. Intenta de nuevo." };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
  revalidateTasks();
}

/** Quita un vínculo. Archiva la relación; el registro apuntado no se toca. */
export async function unlinkTask(
  input: z.infer<typeof linkSchema>,
): Promise<TaskActionResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el vínculo." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "La tarea ya no está disponible." };
    if (task.archivedAt !== null) {
      return { error: "Una tarea archivada no se edita." };
    }

    await tasks.unlink(
      context.organizationId,
      parsed.data.taskId,
      parsed.data.entityType,
      parsed.data.entityId,
    );
  } catch {
    return { error: "No se pudo quitar el vínculo. Intenta de nuevo." };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
  revalidateTasks();
}

/** Lo que el buscador único devuelve al teclear. */
export async function searchLinkTargets(
  term: string,
): Promise<LinkTarget[]> {
  const context = await getSessionContext();
  if (!context) return [];

  try {
    return await new TaskService(context.supabase).searchLinkTargets(
      context.organizationId,
      term,
      context.role === "owner",
    );
  } catch {
    return [];
  }
}

/**
 * Las tareas que apuntan a un registro.
 *
 * Existe como acción, y no solo como carga de servidor, porque los paneles de
 * contacto (V13) y de activo (V12) eligen en cliente: el bloque tiene que
 * seguir a la selección sin recargar la página, que es lo que su requisito
 * pide. Las pantallas que no cambian de registro —pedido e ítem— lo cargan en
 * servidor y no llaman aquí.
 */
export async function relatedTasksFor(
  entityType: (typeof TASK_LINK_TYPES)[number],
  entityId: string,
): Promise<RelatedTask[]> {
  const context = await getSessionContext();
  if (!context) return [];

  try {
    return await new TaskService(context.supabase).relatedTasks(
      context.organizationId,
      entityType,
      entityId,
    );
  } catch {
    return [];
  }
}

// ── KAM-21 · Entregables ─────────────────────────────────────────────────

const deliverableSchema = taskIdSchema.extend({
  type: z.enum(DELIVERABLE_TYPES),
});

/** Declara qué debe existir al terminar la tarea. */
export async function declareDeliverable(
  input: z.infer<typeof deliverableSchema>,
): Promise<TaskActionResult> {
  const parsed = deliverableSchema.safeParse(input);
  if (!parsed.success) return { error: "Ese entregable no existe." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  // El activo es el único reservado, y el dominio es quien lo sabe: la acción
  // no repite la regla, la consulta.
  if (!canDeclare(parsed.data.type, context.role === "owner")) {
    return { error: "Solo la persona dueña declara un activo." };
  }

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "La tarea ya no está disponible." };
    if (task.archivedAt !== null) {
      return { error: "Una tarea archivada no se edita." };
    }

    await tasks.declareDeliverable(
      context.organizationId,
      parsed.data.taskId,
      parsed.data.type,
    );
  } catch {
    return { error: "Ese entregable ya está declarado en esta tarea." };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
}

/** Retira un entregable declarado y aún no cumplido. */
export async function withdrawDeliverable(
  input: z.infer<typeof deliverableSchema>,
): Promise<TaskActionResult> {
  const parsed = deliverableSchema.safeParse(input);
  if (!parsed.success) return { error: "Ese entregable no existe." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new TaskService(context.supabase).withdrawDeliverable(
      context.organizationId,
      parsed.data.taskId,
      parsed.data.type,
    );
  } catch {
    return { error: "No se pudo retirar el entregable. Intenta de nuevo." };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
}

// ── KAM-21 · Cierre con entregables (V19) ────────────────────────────────

const closingEntrySchema = z.object({
  type: z.enum(DELIVERABLE_TYPES),
  /** Generado fuera de la base: hace falta para nombrar la carpeta de Storage. */
  newId: z.guid(),
  payload: z.record(z.string(), z.unknown()),
  /** Los adjuntos de la tarea que la persona dejó marcados. */
  attachmentIds: z.array(z.guid()).default([]),
});

const closeTaskSchema = taskIdSchema.extend({
  statusId: z.guid(),
  deliverables: z.array(closingEntrySchema).default([]),
});

/**
 * Crea los entregables marcados y cierra la tarea, o no hace nada.
 *
 * El orden importa y no es arbitrario (D3, D6):
 *
 *   1. Se copian en Storage los adjuntos marcados, a la carpeta del registro
 *      que se va a crear. Por eso los identificadores se generan aquí y no en
 *      la base: la ruta los necesita antes de que la fila exista.
 *   2. La RPC crea todo en una transacción, con las filas de `attachments` ya
 *      apuntando a objetos que existen.
 *   3. Si la RPC falla, se retiran los objetos copiados.
 *
 * Lo que la transacción garantiza es lo que el requisito pide: ningún registro
 * a medias. Un objeto huérfano tras un fallo es recuperable y no miente a
 * nadie; media tarea cerrada, sí.
 */
export async function closeTaskWithDeliverables(
  input: z.infer<typeof closeTaskSchema>,
): Promise<TaskActionResult> {
  const parsed = closeTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo preparar el cierre." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const isOwner = context.role === "owner";
  if (
    parsed.data.deliverables.some((entry) => !canDeclare(entry.type, isOwner))
  ) {
    return { error: "Solo la persona dueña crea un activo." };
  }

  const attachments = new AttachmentService(context.supabase);
  const copied: { bucket: string; storagePath: string }[] = [];

  try {
    const tasks = new TaskService(context.supabase);
    const task = await tasks.getById(context.organizationId, parsed.data.taskId);
    if (!task) return { error: "La tarea ya no está disponible." };
    if (task.archivedAt !== null) {
      return { error: "Una tarea archivada no se cierra." };
    }

    const available =
      parsed.data.deliverables.some((entry) => entry.attachmentIds.length > 0)
        ? await attachments.listForEntity(
            context.organizationId,
            "task",
            parsed.data.taskId,
          )
        : [];

    const entries = [];

    for (const entry of parsed.data.deliverables) {
      const destination = DELIVERABLE_DEFINITIONS[entry.type].linkType;
      // Un activo **es** un ítem: `attachments.entity_type` no conoce
      // `asset`, y la carpeta del objeto tiene que coincidir con la fila.
      const entityType = destination === "asset" ? "item" : destination;

      const rows = [];
      for (const attachmentId of entry.attachmentIds) {
        const source = available.find((a) => a.id === attachmentId);
        if (!source) continue;

        const copy = await attachments.copyToEntity(
          context.organizationId,
          source,
          entityType,
          entry.newId,
        );
        copied.push({ bucket: copy.bucket, storagePath: copy.storagePath });
        rows.push({
          bucket: copy.bucket,
          storage_path: copy.storagePath,
          file_name: copy.fileName,
          mime_type: copy.mimeType,
          size_bytes: copy.sizeBytes,
        });
      }

      entries.push({
        deliverable_type: entry.type,
        new_id: entry.newId,
        payload: entry.payload,
        attachments: rows,
      });
    }

    const { error } = await context.supabase.rpc(
      "close_task_with_deliverables",
      {
        p_task_id: parsed.data.taskId,
        p_deliverables: entries,
        p_status_id: parsed.data.statusId,
      },
    );

    if (error) throw new Error(error.message);
  } catch {
    // Los objetos copiados se quedarían sin fila: se retiran. Es el mismo
    // trato que `AttachmentService.upload()` ya establece.
    for (const object of copied) {
      await attachments.removeObjects(object.bucket, [object.storagePath]);
    }
    return {
      error: "No se pudo cerrar la tarea. No se creó nada; intenta de nuevo.",
    };
  }

  revalidatePath(`/tasks/${parsed.data.taskId}`);
  revalidateTasks();
}
