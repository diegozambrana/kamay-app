"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { taskSchema } from "@/lib/tasks/schema";
import { StatusService } from "@/services/configuration/status-service";
import { TagService } from "@/services/tasks/tag-service";
import { TaskService } from "@/services/tasks/task-service";

export type TaskActionResult = { error: string } | undefined;

export type CreateTaskResult = { error: string } | { taskId: string };

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

const taskIdSchema = z.object({ taskId: z.guid() });

const moveTaskSchema = taskIdSchema.extend({ statusId: z.guid() });

const updateTaskSchema = taskIdSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
  assigneeId: z.guid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
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
  } catch {
    return { error: "No se pudo mover la tarea. Intenta de nuevo." };
  }

  revalidateTasks();
}

/** Responsable, fecha límite, título y etiquetas: el alcance de KAM-15. */
export async function updateTaskFields(
  input: z.infer<typeof updateTaskSchema>,
): Promise<TaskActionResult> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudieron guardar los cambios." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const tasks = new TaskService(context.supabase);
    await tasks.updateFields(context.organizationId, parsed.data.taskId, {
      title: parsed.data.title,
      assigneeId: parsed.data.assigneeId,
      dueDate: parsed.data.dueDate,
    });

    if (parsed.data.tagNames) {
      const tagIds = await new TagService(context.supabase).resolveNames(
        context.organizationId,
        parsed.data.tagNames,
      );
      await tasks.setTags(context.organizationId, parsed.data.taskId, tagIds);
    }
  } catch {
    return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }

  revalidateTasks();
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
