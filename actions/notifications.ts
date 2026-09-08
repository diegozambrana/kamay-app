"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import type { NotificationPreferences } from "@/lib/notifications/types";
import { NotificationService } from "@/services/notifications/notification-service";
import { PreferenceService } from "@/services/notifications/preference-service";

export type NotificationActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

const notificationIdSchema = z.object({ notificationId: z.guid() });

const preferencesSchema = z.object({
  due_summary: z.boolean(),
  task_assigned: z.boolean(),
  task_review: z.boolean(),
  task_overdue: z.boolean(),
  task_stalled: z.boolean(),
  stock_below_min: z.boolean(),
  dailySummaryHour: z.number().int().min(0).max(23),
  emailEnabled: z.boolean(),
});

/**
 * Estas acciones **no** usan el cliente privilegiado.
 *
 * Marcar leída y guardar preferencias son operaciones de una persona sobre sus
 * propias filas, y la RLS es exactamente lo que debe decidirlas: si la fila es
 * de otro, la escritura no afecta a ninguna y no hay nada que contar. El
 * service role solo aparece en la generación (design D5).
 */

export async function markNotificationRead(
  input: z.infer<typeof notificationIdSchema>,
): Promise<NotificationActionResult> {
  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Aviso no válido." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new NotificationService(context.supabase).markRead(
      context.organizationId,
      parsed.data.notificationId,
    );
  } catch (error) {
    return { error: (error as Error).message };
  }

  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new NotificationService(context.supabase).markAllRead(
      context.organizationId,
    );
  } catch (error) {
    return { error: (error as Error).message };
  }

  revalidatePath("/", "layout");
}

/**
 * Guarda las preferencias de quien las edita.
 *
 * No recibe ningún identificador de usuario: escribe siempre sobre las de la
 * sesión. Aceptar un `userId` abriría la puerta a editar las de otro y
 * dejaría que la RLS fuera la única defensa; así ni siquiera se puede pedir.
 */
export async function saveNotificationPreferences(
  input: NotificationPreferences,
): Promise<NotificationActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { error: "Preferencias no válidas." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new PreferenceService(context.supabase).save(
      context.organizationId,
      context.userId,
      parsed.data,
    );
  } catch (error) {
    return { error: (error as Error).message };
  }

  revalidatePath("/settings/notifications");
}
