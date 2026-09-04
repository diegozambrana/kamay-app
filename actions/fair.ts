"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session-context";
import { directSaleSchema } from "@/lib/fair/sale-schema";
import { orderErrorMessage } from "@/lib/orders/errors";
import { FairSaleService } from "@/services/fair/fair-sale-service";

export type RegisterDirectSaleResult = { error: string } | { saleId: string };

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

/**
 * Registrar una venta de feria con su cobro (KAM-12).
 *
 * Es la operación que la cola sin conexión reenvía, así que tiene que ser
 * idempotente de punta a punta: el `id` viene del cliente y
 * `create_direct_sale` no crea una segunda venta con el mismo. Reintentar es
 * seguro por construcción, no por cuidado de quien llame.
 *
 * **No revalida `/fair`** a propósito: la cuadrícula no depende de la venta
 * recién hecha, y esperar una revalidación rompería la vuelta inmediata que
 * exige el criterio 3. Lo que sí cambia son los ingresos, y esas rutas se
 * refrescan cuando alguien las abra.
 */
export async function registerDirectSale(
  input: unknown,
): Promise<RegisterDirectSaleResult> {
  const parsed = directSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  // El servidor no confía en el formulario: la organización es la de la
  // sesión, no la que llegó en el sobre. Un sobre encolado antes de cambiar
  // de organización no puede escribir en la nueva.
  if (parsed.data.organizationId !== context.organizationId) {
    return { error: "Esa venta pertenece a otra organización." };
  }

  try {
    const saleId = await new FairSaleService(context.supabase).create(parsed.data);

    // Los ingresos cambian; la cuadrícula de la feria, no.
    revalidatePath("/orders");
    revalidatePath("/dashboard");

    return { saleId };
  } catch (error) {
    return {
      error: orderErrorMessage(error, "No se pudo registrar la venta."),
    };
  }
}
