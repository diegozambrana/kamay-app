"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session-context";
import { consumptionSchema, countSchema } from "@/lib/inventory/schema";
import { MovementService } from "@/services/inventory/movement-service";

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

/**
 * Un movimiento cambia el saldo, y el saldo se ve en tres sitios: el detalle
 * del insumo, el panel y el catálogo. Los tres se revalidan, porque un saldo
 * viejo en la tarjeta de bajo mínimo es exactamente la clase de mentira que
 * este módulo existe para evitar.
 */
function revalidateStock(itemId: string) {
  revalidatePath(`/catalog/${itemId}`);
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
}

/**
 * Traduce el error de la base a algo que una persona pueda leer.
 *
 * `23505` sobre `inventory_movements` solo puede venir de reenviar un
 * movimiento que ya se guardó: la cola lo reintentó y el servidor tenía razón.
 * Eso no es un fallo que mostrar —el registro existe, que es lo que la persona
 * quería—, así que se da por bueno (misma regla que el resto de KAM-11).
 */
function isDuplicate(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function message(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const raw = (error as { message?: string }).message;
    if (raw) return raw;
  }
  return fallback;
}

/**
 * Registrar un consumo (V11, V16 y el diálogo desde pedido o tarea).
 *
 * Es de **ambos roles**: la matriz de acceso §16 da *Leer, crear* sobre
 * `inventory_movements` al ayudante, que es quien está delante del estante.
 * Por eso aquí no hay guardia de dueño, a diferencia de los egresos.
 */
export async function registerConsumption(input: unknown): Promise<ActionResult> {
  const parsed = consumptionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new MovementService(context.supabase).registerConsumption(
      context.organizationId,
      parsed.data,
    );
  } catch (error) {
    if (isDuplicate(error)) {
      revalidateStock(parsed.data.itemId);
      return undefined;
    }
    return { error: message(error, "No se pudo registrar el consumo.") };
  }

  revalidateStock(parsed.data.itemId);
  return undefined;
}

/**
 * Registrar un ajuste por conteo físico.
 *
 * La diferencia llega ya calculada por el diálogo (design D6). Aquí no se
 * recalcula contra el saldo actual: hacerlo borraría en silencio lo que
 * ocurriera entre el conteo y su sincronización.
 */
export async function registerCountAdjustment(input: unknown): Promise<ActionResult> {
  const parsed = countSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new MovementService(context.supabase).registerCountAdjustment(
      context.organizationId,
      parsed.data,
    );
  } catch (error) {
    if (isDuplicate(error)) {
      revalidateStock(parsed.data.itemId);
      return undefined;
    }
    return { error: message(error, "No se pudo registrar el ajuste.") };
  }

  revalidateStock(parsed.data.itemId);
  return undefined;
}
