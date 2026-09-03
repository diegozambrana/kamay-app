import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { OrderForm } from "@/features/orders/order-form";
import { getSessionContext } from "@/lib/auth/session-context";
import {
  preselectedLineId,
  resolveActiveLine,
} from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";

export const metadata = { title: "Nuevo pedido · Kamay" };

/**
 * V5 · Nuevo pedido. Página delgada: resuelve la línea activa, carga los
 * catálogos que el formulario necesita y delega.
 *
 * El identificador y la hora del hecho se generan aquí y no en la base
 * (convención nº 9): la primera es un valor que el cliente podrá seguir
 * generando cuando llegue el modo sin conexión, y la segunda es la hora del
 * hecho, no la del servidor de datos.
 */
export default async function NewOrderPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );

  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );

  const [channels, contacts, products] = await Promise.all([
    new SalesChannelService(context.supabase).listActive(context.organizationId),
    new ContactService(context.supabase).list(context.organizationId),
    new ItemService(context.supabase).listProductsWithVariants(
      context.organizationId,
    ),
  ]);

  return (
    <OrderForm
      mode="create"
      defaultValues={{
        id: crypto.randomUUID(),
        // Con "Todas" activa no se preselecciona ninguna: el formulario exige
        // elegirla (spec `business-line-context`).
        businessLineId: preselectedLineId(activeLine) ?? "",
        contactId: "",
        salesChannelId: null,
        deliveryMode: null,
        dueDate: null,
        notes: "",
        occurredAt: new Date().toISOString(),
        items: [],
      }}
      lines={lines}
      channels={channels}
      contacts={contacts}
      products={products}
      // "Hoy" en la zona de la organización: los atajos de fecha son los del
      // taller, no los del navegador (design.md D12).
      today={todayInTimezone(context.membership.organization.timezone)}
    />
  );
}
