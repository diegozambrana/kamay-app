"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOwnerContext } from "@/lib/auth/session-context";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";
import { UnitService } from "@/services/configuration/unit-service";
import { OrganizationService } from "@/services/organization-service";
import { LINE_COLORS } from "@/types";

export type ActionResult = { error: string } | undefined;

const NOT_OWNER = "Solo la persona dueña puede cambiar la configuración.";

const name = z.string().trim().min(1, "El nombre no puede quedar vacío").max(80);
const id = z.uuid();

const lineSchema = z.object({
  name,
  color: z.enum(LINE_COLORS),
  icon: z.string().trim().max(40).nullable().optional(),
});

const namedSchema = z.object({ name });

const unitSchema = z.object({
  code: z.string().trim().min(1, "El código no puede quedar vacío").max(10),
  name,
});

const generalSchema = z.object({
  name,
  currency: z.string().trim().length(3, "La moneda usa tres letras (BOB, USD…)"),
  timezone: z.string().trim().min(1),
  logoPath: z.string().trim().nullable().optional(),
});

/** Un duplicado es lo único que el usuario puede corregir por su cuenta. */
function toMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("duplicate key")) {
    return "Ya existe un registro con ese nombre.";
  }
  return `${fallback} Intenta de nuevo.`;
}

function revalidateConfiguration() {
  // El selector de línea vive en el layout: cambia en todas las pantallas.
  revalidatePath("/", "layout");
}

// ── Líneas de negocio ──────────────────────────────────────────────────────

export async function createBusinessLine(
  input: z.infer<typeof lineSchema>,
): Promise<ActionResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new BusinessLineService(context.supabase).create(
      context.organizationId,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo crear la línea.") };
  }

  revalidateConfiguration();
}

export async function updateBusinessLine(
  input: z.infer<typeof lineSchema> & { id: string },
): Promise<ActionResult> {
  const parsed = lineSchema.extend({ id }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new BusinessLineService(context.supabase).rename(
      context.organizationId,
      parsed.data.id,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo guardar la línea.") };
  }

  revalidateConfiguration();
}

// ── Archivado y desarchivado (las cuatro entidades) ────────────────────────

const entities = ["line", "channel", "category", "unit"] as const;
type Entity = (typeof entities)[number];

const archiveSchema = z.object({ entity: z.enum(entities), id });

function serviceFor(entity: Entity, supabase: SupabaseClient) {
  switch (entity) {
    case "line":
      return new BusinessLineService(supabase);
    case "channel":
      return new SalesChannelService(supabase);
    case "category":
      return new ExpenseCategoryService(supabase);
    case "unit":
      return new UnitService(supabase);
  }
}

export async function archiveConfigurationItem(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el registro." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await serviceFor(parsed.data.entity, context.supabase).archive(
      context.organizationId,
      parsed.data.id,
    );
  } catch (error) {
    // La línea compartida no se archiva: lo impide la base, no la interfaz.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("compartida")) {
      return { error: "La línea General/Compartido no se puede archivar." };
    }
    return { error: "No se pudo archivar. Intenta de nuevo." };
  }

  revalidateConfiguration();
}

export async function unarchiveConfigurationItem(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el registro." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await serviceFor(parsed.data.entity, context.supabase).unarchive(
      context.organizationId,
      parsed.data.id,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo desarchivar.") };
  }

  revalidateConfiguration();
}

// ── Canales, categorías y unidades ─────────────────────────────────────────

export async function createSalesChannel(
  input: z.infer<typeof namedSchema>,
): Promise<ActionResult> {
  const parsed = namedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new SalesChannelService(context.supabase).create(
      context.organizationId,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo crear el canal.") };
  }

  revalidateConfiguration();
}

export async function updateSalesChannel(
  input: z.infer<typeof namedSchema> & { id: string },
): Promise<ActionResult> {
  const parsed = namedSchema.extend({ id }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new SalesChannelService(context.supabase).rename(
      context.organizationId,
      parsed.data.id,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo guardar el canal.") };
  }

  revalidateConfiguration();
}

export async function createExpenseCategory(
  input: z.infer<typeof namedSchema>,
): Promise<ActionResult> {
  const parsed = namedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new ExpenseCategoryService(context.supabase).create(
      context.organizationId,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo crear la categoría.") };
  }

  revalidateConfiguration();
}

export async function updateExpenseCategory(
  input: z.infer<typeof namedSchema> & { id: string },
): Promise<ActionResult> {
  const parsed = namedSchema.extend({ id }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new ExpenseCategoryService(context.supabase).rename(
      context.organizationId,
      parsed.data.id,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo guardar la categoría.") };
  }

  revalidateConfiguration();
}

export async function createUnit(
  input: z.infer<typeof unitSchema>,
): Promise<ActionResult> {
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new UnitService(context.supabase).create(
      context.organizationId,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo crear la unidad.") };
  }

  revalidateConfiguration();
}

export async function updateUnit(
  input: z.infer<typeof unitSchema> & { id: string },
): Promise<ActionResult> {
  const parsed = unitSchema.extend({ id }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new UnitService(context.supabase).rename(
      context.organizationId,
      parsed.data.id,
      parsed.data,
    );
  } catch (error) {
    return { error: toMessage(error, "No se pudo guardar la unidad.") };
  }

  revalidateConfiguration();
}

// ── General ───────────────────────────────────────────────────────────────

export async function updateGeneralSettings(
  input: z.infer<typeof generalSchema>,
): Promise<ActionResult> {
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new OrganizationService(context.supabase).updateGeneral(
      context.organizationId,
      {
        name: parsed.data.name,
        currency: parsed.data.currency.toUpperCase(),
        timezone: parsed.data.timezone,
        logoPath: parsed.data.logoPath ?? null,
      },
    );
  } catch {
    return { error: "No se pudo guardar la organización. Intenta de nuevo." };
  }

  revalidateConfiguration();
}
