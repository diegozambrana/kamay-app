"use server";

import { revalidatePath } from "next/cache";

import { getOwnerContext, getSessionContext } from "@/lib/auth/session-context";
import { paymentErrorMessage } from "@/lib/payments/errors";
import {
  collectionSchema,
  paymentSchema,
  voidPaymentSchema,
} from "@/lib/payments/payment-schema";
import { PaymentService } from "@/services/payments/payment-service";

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const NOT_OWNER = "Solo la persona dueña registra pagos de egresos.";
const NOT_OWNER_VOID = "Solo la persona dueña puede anular un movimiento.";

/**
 * Registrar un cobro de un pedido (V4).
 *
 * La organización la pone el contexto de sesión, nunca el formulario. La
 * dirección la pone el servicio desde el destino. El ayudante puede: cobrar
 * es suyo también (matriz §16).
 */
export async function registerCollection(input: unknown): Promise<ActionResult> {
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new PaymentService(context.supabase).registerCollection(
      context.organizationId,
      parsed.data,
    );
    revalidateOrder(parsed.data.orderId);
    return undefined;
  } catch (error) {
    return { error: paymentErrorMessage(error, "No se pudo registrar el cobro.") };
  }
}

/**
 * Registrar un pago de un egreso (V7).
 *
 * La guardia de dueño es la misma que la política de `payments` aplica
 * después con `direction = 'out'`: aquí solo se evita disparar una consulta
 * que la base va a rechazar y se devuelve un mensaje entendible. La garantía
 * real es RLS, no esta comprobación.
 */
export async function registerPayment(input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new PaymentService(context.supabase).registerPayment(
      context.organizationId,
      parsed.data,
    );
    revalidateExpenses();
    return undefined;
  } catch (error) {
    return { error: paymentErrorMessage(error, "No se pudo registrar el pago.") };
  }
}

/**
 * Anular un movimiento: se archiva, jamás se borra ni se edita (convención
 * nº 3). Ambos hechos —el registro y la anulación— quedan en la bitácora.
 *
 * Mismo criterio que arriba: la guardia de dueño duplica lo que
 * `enforce_archive_rules` decide en la base.
 */
export async function voidPayment(input: unknown): Promise<ActionResult> {
  const parsed = voidPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER_VOID };

  try {
    await new PaymentService(context.supabase).voidPayment(
      context.organizationId,
      parsed.data.id,
    );
    // No se sabe a qué documento apuntaba sin leerlo: se refrescan ambos
    // listados, que es más barato que una consulta extra.
    revalidatePath("/orders", "layout");
    revalidateExpenses();
    return undefined;
  } catch (error) {
    return { error: paymentErrorMessage(error, "No se pudo anular el movimiento.") };
  }
}

function revalidateOrder(orderId: string) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}

function revalidateExpenses() {
  revalidatePath("/expenses", "layout");
}
