import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { OrderRequestInbox } from "@/features/order-requests/order-request-inbox";
import { getSessionContext } from "@/lib/auth/session-context";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { OrderRequestService } from "@/services/order-requests/order-request-service";

export const metadata = { title: "Solicitudes de pedido · Kamay" };

/**
 * KAM-28 · La bandeja de solicitudes de pedido. Abierta a cualquier rol con
 * membresía — `is_member` en toda la RLS de `order_requests`, ningún
 * `getOwnerContext()` aquí.
 */
export default async function OrderRequestsPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const [requests, lines, contacts] = await Promise.all([
    new OrderRequestService(context.supabase).list(context.organizationId),
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new ContactService(context.supabase).list(context.organizationId),
  ]);

  return (
    <MainContainer
      title="Solicitudes de pedido"
      breadcrumbs={[{ label: "Pedidos", href: "/orders" }, { label: "Solicitudes" }]}
    >
      <OrderRequestInbox
        requests={requests}
        lines={lines}
        contacts={contacts}
        organizationName={context.organization.name}
        timezone={context.organization.timezone}
      />
    </MainContainer>
  );
}
