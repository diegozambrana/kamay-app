"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOwnerContext } from "@/lib/auth/session-context";
import { OrganizationToolService } from "@/services/tools/organization-tool-service";
import { toolBySlug } from "@/tools/resolve";

/**
 * KAM-27 · Activar, desactivar y configurar herramientas (spec `tenant-tools`
 * → *El catálogo vive en la configuración y es de la dueña* y *Los parámetros
 * se editan en un formulario derivado del esquema*).
 *
 * Estas acciones son del **núcleo**: las herramientas no definen las suyas
 * (`tools/boundary.test.ts`). La bitácora la escribe el trigger de la tabla.
 */

export type ToolActionResult =
  | { error: string; issues?: { path: (string | number)[]; message: string }[] }
  | undefined;

const NOT_OWNER = "Solo la persona dueña puede administrar las herramientas.";
const UNKNOWN_TOOL = "Esa herramienta ya no está disponible.";

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

function revalidateTools() {
  // La sección «Herramientas» del menú vive en el layout: cambia en todas
  // las pantallas al activar o desactivar.
  revalidatePath("/", "layout");
}

/** El slug tiene que ser de una herramienta del registro, no solo bien formado. */
function resolveTool(slug: unknown) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? toolBySlug(parsed.data) : null;
}

export async function activateTool(slug: string): Promise<ToolActionResult> {
  const tool = resolveTool(slug);
  if (!tool) return { error: UNKNOWN_TOOL };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new OrganizationToolService(context.supabase).activate(
      context.organizationId,
      tool.slug,
      tool.defaults as Record<string, unknown>,
    );
  } catch {
    return { error: "No se pudo activar la herramienta. Intenta de nuevo." };
  }

  revalidateTools();
}

export async function deactivateTool(slug: string): Promise<ToolActionResult> {
  const tool = resolveTool(slug);
  if (!tool) return { error: UNKNOWN_TOOL };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new OrganizationToolService(context.supabase).deactivate(
      context.organizationId,
      tool.slug,
    );
  } catch {
    return { error: "No se pudo desactivar la herramienta. Intenta de nuevo." };
  }

  revalidateTools();
}

/**
 * Guarda parámetros. **El servidor no confía en el formulario**: valida otra
 * vez con el esquema del manifiesto, y lo que se guarda es la salida del
 * esquema —ya recortada y completada—, no lo que llegó.
 */
export async function updateToolConfig(slug: string, config: unknown): Promise<ToolActionResult> {
  const tool = resolveTool(slug);
  if (!tool) return { error: UNKNOWN_TOOL };

  const parsed = tool.configSchema.safeParse(config);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0].message,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.filter(
          (segment): segment is string | number =>
            typeof segment === "string" || typeof segment === "number",
        ),
        message: issue.message,
      })),
    };
  }

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new OrganizationToolService(context.supabase).updateConfig(
      context.organizationId,
      tool.slug,
      parsed.data as Record<string, unknown>,
    );
  } catch {
    return { error: "No se pudieron guardar los parámetros. Intenta de nuevo." };
  }

  revalidateTools();
}
