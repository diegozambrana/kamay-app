"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { directSaleSchema } from "@/lib/fair/sale-schema";
import { orderErrorMessage } from "@/lib/orders/errors";
import { FairSaleService } from "@/services/fair/fair-sale-service";

export type RegisterDirectSaleResult = { error: string } | { saleId: string };
export type RegisterDirectSalesResult = { error: string } | { saleIds: string[] };

/**
 * Un carrito con productos de varias líneas: dos ventas o más, y un tope que
 * ningún carrito de feria alcanza —una por línea de la organización—.
 */
const directSalesSchema = z
  .array(directSaleSchema)
  .min(2, "Un lote necesita al menos dos ventas.")
  .max(20, "Demasiadas ventas en un mismo registro.");

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

/**
 * Registrar las ventas de un carrito con productos de varias líneas
 * (`fair-all-lines`): una por línea, todas o ninguna.
 *
 * Como `registerDirectSale`, es lo que la cola reenvía: idempotente por los
 * `id` del cliente, y la organización de cada venta tiene que ser la de la
 * sesión. Una sola ajena rechaza el lote entero antes de escribir nada.
 */
export async function registerDirectSales(
  input: unknown,
): Promise<RegisterDirectSalesResult> {
  const parsed = directSalesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  if (parsed.data.some((sale) => sale.organizationId !== context.organizationId)) {
    return { error: "Esa venta pertenece a otra organización." };
  }

  try {
    const saleIds = await new FairSaleService(context.supabase).createMany(parsed.data);

    revalidatePath("/orders");
    revalidatePath("/dashboard");

    return { saleIds };
  } catch (error) {
    return {
      error: orderErrorMessage(error, "No se pudieron registrar las ventas."),
    };
  }
}
