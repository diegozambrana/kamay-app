import { notFound, redirect } from "next/navigation";

import { OrderRequestDetail } from "@/features/order-requests/order-request-detail";
import { getSessionContext } from "@/lib/auth/session-context";
import { OrderRequestService } from "@/services/order-requests/order-request-service";

export const metadata = { title: "Solicitud de pedido · Kamay" };

export default async function OrderRequestDetailPage({
  params,
}: PageProps<"/orders/requests/[id]">) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;

  const service = new OrderRequestService(context.supabase);
  const request = await service.get(context.organizationId, id);
  if (!request) notFound();

  const images = await service.quarantineImages(context.organizationId, id);

  return (
    <OrderRequestDetail
      request={request}
      images={images}
      organizationName={context.organization.name}
      timezone={context.organization.timezone}
    />
  );
}
