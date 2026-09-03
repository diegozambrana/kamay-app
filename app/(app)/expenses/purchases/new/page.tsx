import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { PurchaseForm } from "@/features/expenses/purchase-form";
import type { LastCostHint } from "@/features/expenses/purchase-lines-table";
import { getOwnerContext } from "@/lib/auth/session-context";
import {
  preselectedLineId,
  resolveActiveLine,
} from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ItemLastCostService } from "@/services/expenses/item-last-cost-service";

export const metadata = { title: "Nueva compra · Kamay" };

/**
 * V8 · Nueva compra. Página delgada: resuelve la línea activa, carga
 * proveedores, insumos y el último costo de cada uno, y delega.
 *
 * Los últimos costos se leen una sola vez para la organización (design D3):
 * la tabla de insumos muestra la pista de cualquiera que se agregue sin
 * volver a consultar.
 */
export default async function NewPurchasePage() {
  const context = await getOwnerContext();
  if (!context) redirect("/auth/login");

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );
  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );

  const [suppliers, supplies, lastCosts, allContacts] = await Promise.all([
    new ContactService(context.supabase).list(context.organizationId, {
      role: "supplier",
    }),
    new ItemService(context.supabase).listSuppliesWithVariants(context.organizationId),
    new ItemLastCostService(context.supabase).mapFor(context.organizationId),
    // Con archivados: el proveedor de la última compra puede estar archivado
    // y su nombre sigue siendo la pista correcta.
    new ContactService(context.supabase).list(context.organizationId, {
      includeArchived: true,
    }),
  ]);

  const contactNames = new Map(allContacts.map((contact) => [contact.id, contact.name]));
  const hints: Record<string, LastCostHint> = {};
  for (const [itemId, cost] of lastCosts) {
    hints[itemId] = {
      lastCost: cost.lastCost,
      lastPurchaseAt: cost.lastPurchaseAt,
      supplierName: cost.lastSupplierId
        ? (contactNames.get(cost.lastSupplierId) ?? null)
        : null,
    };
  }

  return (
    <PurchaseForm
      // Con "Todas" activa no se preselecciona ninguna: una compra es de una
      // línea concreta y el formulario exige elegirla.
      defaultLineId={preselectedLineId(activeLine) ?? ""}
      lines={lines}
      suppliers={suppliers}
      supplies={supplies}
      hints={hints}
      today={todayInTimezone(context.membership.organization.timezone)}
      timezone={context.membership.organization.timezone}
    />
  );
}
