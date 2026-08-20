"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOwnerContext } from "@/lib/auth/session-context";
import {
  statusFormSchema,
  statusScopeSchema,
} from "@/lib/statuses/schema";
import { StatusService } from "@/services/configuration/status-service";

export type ActionResult = { error: string } | undefined;

const NOT_OWNER = "Solo la persona dueña puede cambiar la configuración.";

const id = z.guid();

/**
 * Los mensajes de la base (trigger de integridad, archive_status) ya vienen
 * en español y con código estable: aquí solo se decide cuál mostrar tal cual
 * y cuál se cubre con un texto de formulario.
 */
function toMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("duplicate key")) {
    return "Ya existe un estado con ese nombre en este juego (revisa también los archivados).";
  }
  if (message.includes("Todo juego de estados necesita")) {
    return "Todo juego necesita al menos un estado inicial y uno final.";
  }
  if (message.includes("El estado está en uso")) {
    return "El estado está en uso: indica a qué estado mover sus registros.";
  }
  if (message.includes("queue_only_when_waiting")) {
    return "Solo un estado En espera puede ser columna en cola.";
  }
  return `${fallback} Intenta de nuevo.`;
}

function revalidateStatuses() {
  revalidatePath("/settings/statuses");
}

export async function createStatus(
  input: z.infer<typeof statusScopeSchema> & z.infer<typeof statusFormSchema>,
): Promise<ActionResult> {
  const scope = statusScopeSchema.safeParse(input);
  const values = statusFormSchema.safeParse(input);
  if (!scope.success) return { error: "No se pudo identificar el juego." };
  if (!values.success) return { error: values.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).create(
      context.organizationId,
      scope.data.businessLineId,
      scope.data.flow,
      values.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo crear el estado.") };
  }

  revalidateStatuses();
}

export async function updateStatus(
  input: z.infer<typeof statusFormSchema> & { id: string },
): Promise<ActionResult> {
  const parsed = statusFormSchema.safeParse(input);
  const parsedId = id.safeParse(input.id);
  if (!parsedId.success) return { error: "No se pudo identificar el estado." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).update(
      context.organizationId,
      parsedId.data,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo guardar el estado.") };
  }

  revalidateStatuses();
}

const reorderSchema = z.object({ orderedIds: z.array(id).min(1) });

export async function reorderStatuses(
  input: z.infer<typeof reorderSchema>,
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo leer el nuevo orden." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).reorder(
      context.organizationId,
      parsed.data.orderedIds,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo guardar el orden.") };
  }

  revalidateStatuses();
}

const archiveSchema = z.object({ id, moveToId: id.nullable() });

export async function archiveStatus(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el estado." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).archive(
      parsed.data.id,
      parsed.data.moveToId,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo archivar el estado.") };
  }

  revalidateStatuses();
}

export async function restoreDefaultStatuses(
  input: z.infer<typeof statusScopeSchema>,
): Promise<ActionResult> {
  const parsed = statusScopeSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el juego." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).restoreDefaults(
      context.organizationId,
      parsed.data.businessLineId,
      parsed.data.flow,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo restaurar el juego.") };
  }

  revalidateStatuses();
}

const useOrgSchema = z.object({
  businessLineId: id,
  flow: statusScopeSchema.shape.flow,
});

export async function createOwnStatusSet(
  input: z.infer<typeof useOrgSchema>,
): Promise<ActionResult> {
  const parsed = useOrgSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la línea." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).createOwnSet(
      context.organizationId,
      parsed.data.businessLineId,
      parsed.data.flow,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo crear el juego propio.") };
  }

  revalidateStatuses();
}

export async function applyOrganizationStatuses(
  input: z.infer<typeof useOrgSchema>,
): Promise<ActionResult> {
  const parsed = useOrgSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la línea." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new StatusService(context.supabase).useOrganizationSet(
      context.organizationId,
      parsed.data.businessLineId,
      parsed.data.flow,
    );
  } catch (error) {
    return {
      error: toMessage(error, "No se pudo volver al juego de la organización."),
    };
  }

  revalidateStatuses();
}
