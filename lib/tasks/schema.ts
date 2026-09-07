import { z } from "zod";

import { TASK_LINK_TYPES } from "@/types";

/**
 * Lo mínimo para guardar una tarea: título y línea. Todo lo demás es opcional
 * (§6.3 — «con título y línea ya se guarda»).
 *
 * El título se recorta antes de validar: tres espacios no son un título, y es
 * la misma regla que la restricción `task_needs_title` aplica en la base. Que
 * esté en los dos sitios no es duplicación ociosa — el formulario tiene que
 * poder decir qué falta antes de viajar.
 */
export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe un título para la tarea")
    .max(200, "El título es demasiado largo"),
  // `guid` y no `uuid`: los identificadores de la semilla y los que genera el
  // cliente sin conexión no llevan la versión RFC en su sitio, y `z.uuid()`
  // los rechaza. Es la misma elección que hace el esquema de pedidos.
  businessLineId: z.guid("Elige una línea de negocio"),
  assigneeId: z.guid().nullable().optional(),
  /** Fecha límite en `YYYY-MM-DD`, o vacía. */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable()
    .optional(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
  link: z
    .object({
      entityType: z.enum(TASK_LINK_TYPES),
      entityId: z.guid(),
    })
    .nullable()
    .optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

/** El alta rápida del tablero: solo lo que caben tres interacciones. */
export const quickTaskSchema = taskSchema.pick({
  title: true,
  businessLineId: true,
});
