"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { catalogErrorMessage } from "@/lib/catalog/errors";
import { MAX_FILE_SIZE } from "@/lib/catalog/photos";
import {
  itemFormSchema,
  itemVariantFormSchema,
} from "@/lib/catalog/schema";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ItemService } from "@/services/catalog/item-service";
import { ItemVariantService } from "@/services/catalog/item-variant-service";
import { ITEM_PHOTOS_BUCKET } from "@/types";

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const NOT_OWNER = "Solo la persona dueña puede archivar o desarchivar.";

const id = z.guid();

function revalidateCatalog(itemId?: string) {
  revalidatePath("/catalog");
  if (itemId) revalidatePath(`/catalog/${itemId}`);
}

/**
 * El identificador lo genera el cliente (convención nº 9, requisito del modo
 * sin conexión de KAM-11): la acción lo recibe, no lo inventa.
 */
export async function createItem(
  input: z.input<typeof itemFormSchema> & { id: string },
): Promise<ActionResult> {
  const parsedId = id.safeParse(input.id);
  const parsed = itemFormSchema.safeParse(input);
  if (!parsedId.success) return { error: "No se pudo identificar el ítem." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Crear y editar son de todo miembro (matriz de acceso §16).
  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ItemService(context.supabase).create(
      context.organizationId,
      parsedId.data,
      parsed.data,
    );
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo crear el ítem.") };
  }

  revalidateCatalog();
}

export async function updateItem(
  input: z.input<typeof itemFormSchema> & { id: string },
): Promise<ActionResult> {
  const parsedId = id.safeParse(input.id);
  const parsed = itemFormSchema.safeParse(input);
  if (!parsedId.success) return { error: "No se pudo identificar el ítem." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ItemService(context.supabase).update(
      context.organizationId,
      parsedId.data,
      parsed.data,
    );
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo guardar el ítem.") };
  }

  revalidateCatalog(parsedId.data);
}

const archiveSchema = z.object({ id, archived: z.boolean() });

/**
 * Archivar y desarchivar son del dueño. Esta comprobación es interfaz: quien
 * decide de verdad es el trigger `enforce_archive_rules` de la base.
 */
export async function setItemArchived(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el ítem." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };
  if (context.membership.role !== "owner") return { error: NOT_OWNER };

  try {
    await new ItemService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.id,
      parsed.data.archived,
    );
  } catch (error) {
    return {
      error: catalogErrorMessage(
        error,
        parsed.data.archived
          ? "No se pudo archivar el ítem."
          : "No se pudo desarchivar el ítem.",
      ),
    };
  }

  revalidateCatalog(parsed.data.id);
}

const variantSchema = itemVariantFormSchema.extend({
  id,
  itemId: id,
});

export async function createItemVariant(
  input: z.input<typeof variantSchema>,
): Promise<ActionResult> {
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ItemVariantService(context.supabase).create(
      context.organizationId,
      parsed.data.itemId,
      parsed.data.id,
      parsed.data,
    );
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo crear la variante.") };
  }

  revalidateCatalog(parsed.data.itemId);
}

export async function updateItemVariant(
  input: z.input<typeof variantSchema>,
): Promise<ActionResult> {
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ItemVariantService(context.supabase).update(
      context.organizationId,
      parsed.data.id,
      parsed.data,
    );
  } catch (error) {
    return {
      error: catalogErrorMessage(error, "No se pudo guardar la variante."),
    };
  }

  revalidateCatalog(parsed.data.itemId);
}

const archiveVariantSchema = z.object({
  id,
  itemId: id,
  archived: z.boolean(),
});

export async function setItemVariantArchived(
  input: z.infer<typeof archiveVariantSchema>,
): Promise<ActionResult> {
  const parsed = archiveVariantSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la variante." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };
  if (context.membership.role !== "owner") return { error: NOT_OWNER };

  try {
    await new ItemVariantService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.id,
      parsed.data.archived,
    );
  } catch (error) {
    return {
      error: catalogErrorMessage(error, "No se pudo archivar la variante."),
    };
  }

  revalidateCatalog(parsed.data.itemId);
}

/**
 * Foto del ítem. Viaja como `FormData` porque un `File` no sobrevive a la
 * serialización de una Server Action normal.
 *
 * Es una acción aparte del alta del ítem a propósito: si la subida falla, el
 * ítem ya está creado y la persona vuelve a intentar la foto, en vez de
 * perder todo lo que escribió.
 */
export async function uploadItemPhoto(formData: FormData): Promise<ActionResult> {
  const itemId = id.safeParse(formData.get("itemId"));
  if (!itemId.success) return { error: "No se pudo identificar el ítem." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No llegó ningún archivo." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "La foto no puede pesar más de 5 MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "El archivo tiene que ser una imagen." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new AttachmentService(context.supabase).upload(
      context.organizationId,
      context.userId,
      {
        // Identificador generado en el servidor: aquí no hay modo sin conexión
        // que servir, el archivo ya está viajando.
        id: crypto.randomUUID(),
        entityType: "item",
        entityId: itemId.data,
        bucket: ITEM_PHOTOS_BUCKET,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        body: await file.arrayBuffer(),
      },
    );
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo subir la foto.") };
  }

  revalidateCatalog(itemId.data);
}

const archiveAttachmentSchema = z.object({
  id,
  itemId: id,
  archived: z.boolean(),
});

export async function setItemPhotoArchived(
  input: z.infer<typeof archiveAttachmentSchema>,
): Promise<ActionResult> {
  const parsed = archiveAttachmentSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la foto." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };
  if (context.membership.role !== "owner") return { error: NOT_OWNER };

  try {
    await new AttachmentService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.id,
      parsed.data.archived,
    );
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo quitar la foto.") };
  }

  revalidateCatalog(parsed.data.itemId);
}
