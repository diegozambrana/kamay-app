"use server";

import { revalidatePath } from "next/cache";

import { assetDetailsSchema, assetExpenseLinkSchema } from "@/lib/assets/schema";
import { getOwnerContext } from "@/lib/auth/session-context";
import { AssetService } from "@/services/assets/asset-service";
import { ExpenseService } from "@/services/expenses/expense-service";

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const NOT_OWNER = "Solo la persona dueña puede administrar los activos.";

/**
 * Un activo se ve en tres sitios: su pantalla, el detalle de su ítem y —desde
 * el vínculo con sus egresos— la bandeja de egresos. Los tres se revalidan,
 * porque un costo viejo en la barra es exactamente la mentira que esta
 * pantalla existe para evitar.
 */
function revalidateAsset(itemId: string) {
  revalidatePath("/assets");
  revalidatePath(`/catalog/${itemId}`);
  revalidatePath("/catalog");
}

function message(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const raw = (error as { message?: string }).message;
    if (raw) return raw;
  }
  return fallback;
}

/**
 * Declarar o corregir los datos de un activo (V11 y V12).
 *
 * Guardia de dueño explícita y no solo RLS: la matriz §16 deja `asset_details`
 * sin acceso para el ayudante, y devolver un mensaje claro es mejor que dejar
 * que la base rechace la fila con un error de política.
 */
export async function saveAssetDetails(input: unknown): Promise<ActionResult> {
  const parsed = assetDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NO_SESSION };

  const { acquisitionExpenseId, ...details } = parsed.data;

  try {
    await new AssetService(context.supabase).save(context.organizationId, details);

    // El vínculo va después y por separado: si falla, el activo ya está
    // declarado y solo se reintenta el vínculo, en vez de perder las dos
    // cosas. El aviso dice exactamente qué quedó a medias.
    if (acquisitionExpenseId) {
      await new ExpenseService(context.supabase).setAsset(
        context.organizationId,
        acquisitionExpenseId,
        { assetId: details.itemId, role: "acquisition" },
      );
      revalidatePath(`/expenses/${acquisitionExpenseId}`);
      revalidatePath("/expenses");
    }
  } catch (error) {
    return { error: message(error, "No se pudieron guardar los datos del activo.") };
  }

  revalidateAsset(parsed.data.itemId);
  return undefined;
}

/**
 * Vincular un egreso a un activo como mantenimiento, o deshacer el vínculo.
 *
 * Cambia el costo total del activo y, con él, su barra: se revalida la
 * pantalla de activos y también la de egresos, donde el vínculo se muestra.
 */
export async function linkExpenseToAsset(input: unknown): Promise<ActionResult> {
  const parsed = assetExpenseLinkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  const { expenseId, assetId, role } = parsed.data;

  // Los dos juntos o ninguno, igual que en la base: un activo sin papel no
  // dice qué hace ese dinero.
  if ((assetId === null) !== (role === null || role === undefined)) {
    return { error: "Elige el activo y qué hace ese egreso por él." };
  }

  try {
    await new ExpenseService(context.supabase).setAsset(
      context.organizationId,
      expenseId,
      assetId && role ? { assetId, role } : null,
    );
  } catch (error) {
    return { error: message(error, "No se pudo vincular el egreso al activo.") };
  }

  if (assetId) revalidateAsset(assetId);
  revalidatePath("/assets");
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
  return undefined;
}
