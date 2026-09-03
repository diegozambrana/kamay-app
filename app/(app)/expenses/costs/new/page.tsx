import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { CostForm } from "@/features/expenses/cost-form";
import { getOwnerContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { OrderService } from "@/services/orders/order-service";
import { ALL_LINES } from "@/types";

export const metadata = { title: "Nuevo gasto · Kamay" };

/**
 * V9 · Nuevo gasto. Página delgada: resuelve la línea a preseleccionar, carga
 * categorías y pedidos vigentes, y delega.
 *
 * Con "Todas" activa se preselecciona la línea compartida (General): un gasto
 * que no es de una línea es, por definición, de General (§6.1; design D5).
 */
export default async function NewCostPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/auth/login");

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );
  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );
  const shared = lines.find((line) => line.isShared);
  const defaultLineId =
    activeLine === ALL_LINES ? (shared?.id ?? "") : activeLine;

  const [categories, orders, contacts] = await Promise.all([
    new ExpenseCategoryService(context.supabase).listActive(context.organizationId),
    new OrderService(context.supabase).list(context.organizationId),
    new ContactService(context.supabase).list(context.organizationId, {
      includeArchived: true,
    }),
  ]);
  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.name]));

  return (
    <CostForm
      defaultLineId={defaultLineId}
      lines={lines}
      categories={categories}
      orders={orders.map((order) => ({
        id: order.id,
        code: order.code,
        label: `#${order.code}${
          order.contactId && contactNames.get(order.contactId)
            ? ` · ${contactNames.get(order.contactId)}`
            : ""
        }`,
      }))}
      today={todayInTimezone(context.membership.organization.timezone)}
    />
  );
}
