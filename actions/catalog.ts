"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getSessionContext,
  type SessionContext,
} from "@/lib/auth/session-context";
import { catalogErrorMessage } from "@/lib/catalog/errors";
import { applyKindFields, variantSalePriceFor } from "@/lib/catalog/fields";
import { MAX_FILE_SIZE } from "@/lib/catalog/photos";
import {
  itemFieldsSchema,
  itemFormSchema,
  itemVariantFormSchema,
} from "@/lib/catalog/schema";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ItemService } from "@/services/catalog/item-service";
import { ItemVariantService } from "@/services/catalog/item-variant-service";
import { ItemCategoryService } from "@/services/configuration/item-category-service";
import { ITEM_PHOTOS_BUCKET, type ItemKind } from "@/types";

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const NOT_OWNER = "Solo la persona dueña puede archivar o desarchivar.";
const ITEM_NOT_FOUND = "No se encontró el ítem. Recarga la página.";

const id = z.guid();

/**
 * ¿Se puede asignar esta categoría a un ítem de este tipo?
 *
 * Tiene que existir en la organización, ser del tipo del ítem y estar vigente.
 * Una archivada solo se acepta si es la que el ítem ya tenía: editar un ítem
 * sin tocar su categoría no la pierde, pero una archivada no se asigna de
 * nuevo. La organización y el tipo los vuelve a comprobar la clave compuesta
 * de la base; lo de «ya la tenía» depende del valor anterior y solo puede
 * decidirlo aquí.
 *
 * Devuelve el mensaje de error, o `null` si se puede.
 */
async function categoryProblem(
  context: SessionContext,
  kind: ItemKind,
  categoryId: string | null,
  currentCategoryId: string | null = null,
): Promise<string | null> {
  if (categoryId === null) return null;

  const category = await new ItemCategoryService(context.supabase).findById(
    context.organizationId,
    categoryId,
  );
  if (!category || category.kind !== kind) {
    return "Esa categoría no es de este tipo de ítem. Elige otra.";
  }
  if (category.archivedAt !== null && categoryId !== currentCategoryId) {
    return "Esa categoría está archivada. Elige otra o restáurala en Configuración.";
  }
  return null;
}

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
    const problem = await categoryProblem(
      context,
      parsed.data.kind,
      parsed.data.categoryId,
    );
    if (problem) return { error: problem };

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

/**
 * El tipo no cambia al editar: manda el del ítem guardado, no el que traiga la
 * petición. Con ese tipo se vuelven a vaciar los campos que no le
 * corresponden, así que un precio de venta que un insumo arrastrara de antes
 * se va en esta edición (y la bitácora lo registra).
 */
export async function updateItem(
  input: z.input<typeof itemFormSchema> & { id: string },
): Promise<ActionResult> {
  const parsedId = id.safeParse(input.id);
  // Sin normalizar: se normaliza una sola vez, con el tipo guardado.
  const parsed = itemFieldsSchema.safeParse(input);
  if (!parsedId.success) return { error: "No se pudo identificar el ítem." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const items = new ItemService(context.supabase);
    const stored = await items.findById(context.organizationId, parsedId.data);
    if (!stored) return { error: ITEM_NOT_FOUND };

    const problem = await categoryProblem(
      context,
      stored.kind,
      parsed.data.categoryId,
      stored.categoryId,
    );
    if (problem) return { error: problem };

    // El `kind` de la carga no llega a la base: `update` no escribe el tipo.
    await items.update(
      context.organizationId,
      parsedId.data,
      applyKindFields(stored.kind, parsed.data),
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
  if (context.role !== "owner") return { error: NOT_OWNER };

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

/**
 * El precio de una variante sigue la regla de su ítem: solo un producto lo
 * lleva. El tipo se lee del ítem padre guardado, no de la petición.
 */
async function normalizeVariant(
  context: SessionContext,
  variant: z.infer<typeof variantSchema>,
): Promise<z.infer<typeof variantSchema> | null> {
  const item = await new ItemService(context.supabase).findById(
    context.organizationId,
    variant.itemId,
  );
  if (!item) return null;
  return {
    ...variant,
    salePrice: variantSalePriceFor(item.kind, variant.salePrice),
  };
}

export async function createItemVariant(
  input: z.input<typeof variantSchema>,
): Promise<ActionResult> {
  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const variant = await normalizeVariant(context, parsed.data);
    if (!variant) return { error: ITEM_NOT_FOUND };

    await new ItemVariantService(context.supabase).create(
      context.organizationId,
      variant.itemId,
      variant.id,
      variant,
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
    const variant = await normalizeVariant(context, parsed.data);
    if (!variant) return { error: ITEM_NOT_FOUND };

    await new ItemVariantService(context.supabase).update(
      context.organizationId,
      variant.id,
      variant,
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
  if (context.role !== "owner") return { error: NOT_OWNER };

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
  if (context.role !== "owner") return { error: NOT_OWNER };

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
