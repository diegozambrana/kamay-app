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
import { OrderRequestService } from "@/services/order-requests/order-request-service";

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
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; request?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  // La vista de pedidos de la que se llegó: «Guardar» y la miga vuelven a ella.
  const { from, request: requestId } = await searchParams;

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

  // KAM-28 · Se llegó desde «Aceptar» en la bandeja de solicitudes: prellena
  // línea, cliente (si la solicitud ya tenía uno) y nota. Una solicitud que
  // no aplica —de otra organización, ya aceptada, archivada— se ignora en
  // silencio y el alta se comporta como si no hubiera `?request=`.
  const acceptedRequest = requestId
    ? await new OrderRequestService(context.supabase).get(
        context.organizationId,
        requestId,
      )
    : null;
  const applicableRequest =
    acceptedRequest &&
    acceptedRequest.submittedAt &&
    !acceptedRequest.orderId &&
    !acceptedRequest.archivedAt
      ? acceptedRequest
      : null;

  const declaredName = applicableRequest?.declaredName ?? applicableRequest?.prefilledName;
  const declaredPhone = applicableRequest?.declaredPhone ?? applicableRequest?.prefilledPhone;
  const noteFromRequest = applicableRequest
    ? [
        !applicableRequest.contactId && declaredName
          ? `Cliente de la solicitud: ${declaredName}${declaredPhone ? ` — ${declaredPhone}` : ""}`
          : null,
        applicableRequest.declaredNote,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <OrderForm
      mode="create"
      defaultValues={{
        id: crypto.randomUUID(),
        // Con "Todas" activa no se preselecciona ninguna: el formulario exige
        // elegirla (spec `business-line-context`).
        businessLineId: applicableRequest?.businessLineId ?? preselectedLineId(activeLine) ?? "",
        contactId: applicableRequest?.contactId ?? "",
        salesChannelId: null,
        deliveryMode: null,
        dueDate: null,
        notes: noteFromRequest,
        occurredAt: new Date().toISOString(),
        items: [],
      }}
      lines={lines}
      channels={channels}
      contacts={contacts}
      products={products}
      // "Hoy" en la zona de la organización: los atajos de fecha son los del
      // taller, no los del navegador (design.md D12).
      today={todayInTimezone(context.organization.timezone)}
      from={from ?? null}
      requestId={applicableRequest?.id ?? null}
    />
  );
}
