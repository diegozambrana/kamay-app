import { notFound, redirect } from "next/navigation";

import { OrderDetail } from "@/features/orders/order-detail";
import { getSessionContext } from "@/lib/auth/session-context";
import { todayInTimezone } from "@/lib/orders/overdue";
import { getRequestActiveToolSlugs } from "@/lib/tools/request-tools";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";
import { StatusService } from "@/services/configuration/status-service";
import { OrderItemService } from "@/services/orders/order-item-service";
import { OrderService } from "@/services/orders/order-service";
import { PaymentService } from "@/services/payments/payment-service";
import { loadRecordHistory } from "@/services/activity/record-history";
import { TaskService } from "@/services/tasks/task-service";
import { OrganizationToolService } from "@/services/tools/organization-tool-service";
import { activeToolsFor } from "@/tools/resolve";

export const metadata = { title: "Pedido · Kamay" };

/**
 * V4 · Detalle de pedido. Las líneas, el total y el saldo derivados, los
 * cobros, las imágenes de referencia y el historial. La rentabilidad llega
 * en KAM-20.
 */
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;
  const { from } = await searchParams;

  const orders = new OrderService(context.supabase);
  const order = await orders.getById(context.organizationId, id);
  if (!order) notFound();

  const lines = await new OrderItemService(context.supabase).listByOrder(
    context.organizationId,
    order.id,
  );

  // El juego de la línea de ESTE pedido: es lo que puede ofrecerse como
  // destino al cambiar de estado desde el detalle.
  const statuses = await new StatusService(context.supabase).resolve(
    context.organizationId,
    order.businessLineId,
    "order",
  );
  // El estado actual puede estar archivado y no aparecer en el juego vigente:
  // se busca aparte para poder nombrarlo igualmente.
  const allStatuses = await new StatusService(context.supabase).listAllForFlow(
    context.organizationId,
    "order",
  );

  const contact = order.contactId
    ? await new ContactService(context.supabase).findById(
        context.organizationId,
        order.contactId,
      )
    : null;

  const businessLines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );
  const channels = await new SalesChannelService(context.supabase).listActive(
    context.organizationId,
  );

  // Imágenes de referencia: el bucket es privado, así que cada lectura se firma.
  const attachments = new AttachmentService(context.supabase);
  const files = await attachments.listForEntities(context.organizationId, "order", [
    order.id,
  ]);
  const signed = await attachments.signedThumbnailUrls(files);

  // Los movimientos del pedido, anulados incluidos: el bloque los muestra
  // tachados. Lo que cuenta en `paid` lo decide la vista, no esta lista.
  const payments = await new PaymentService(context.supabase).listForOrder(
    context.organizationId,
    order.id,
  );

  // Un solo historial (convención nº 7): sale de `activity_log` por la misma
  // lectura que la bitácora general, para que los eventos y su orden
  // coincidan con `/activity` filtrada por este pedido. Para el ayudante llega
  // vacío por RLS, y el bloque no se muestra.
  const history = await loadRecordHistory(context.supabase, {
    organizationId: context.organizationId,
    tableName: "orders",
    recordId: order.id,
    timezone: context.organization.timezone,
    currency: context.organization.currency,
  });

  // El otro lado del vínculo: qué tareas apuntan a este pedido. RLS decide
  // cuáles ve quien mira; aquí no se filtra por rol ni por línea (D4).
  const relatedTasks = await new TaskService(context.supabase).relatedTasks(
    context.organizationId,
    "order",
    order.id,
  );

  // Las herramientas que pueden actuar sobre este pedido (KAM-27): en el
  // registro, activas para esta organización, con el enganche del detalle y al
  // alcance del rol. Sin ninguna, el detalle no cambia. Los slugs ya los pidió
  // el cascarón en esta misma petición: aquí no cuestan otra consulta.
  const orderTools = activeToolsFor(
    await getRequestActiveToolSlugs(context.organizationId),
    context.role,
    { hook: "order-detail" },
  );
  const toolService = new OrganizationToolService(context.supabase);
  const toolActions = await Promise.all(
    orderTools.map(async (tool) => ({
      slug: tool.slug,
      config: await toolService.getActiveConfig(context.organizationId, tool.slug),
    })),
  );

  return (
    <OrderDetail
      order={order}
      lines={lines}
      statuses={statuses}
      statusName={
        allStatuses.find((s) => s.id === order.statusId)?.name ?? "Sin estado"
      }
      statusKind={
        allStatuses.find((s) => s.id === order.statusId)?.kind ?? "in_progress"
      }
      contact={contact}
      businessLine={
        businessLines.find((line) => line.id === order.businessLineId) ?? null
      }
      channelName={
        channels.find((channel) => channel.id === order.salesChannelId)?.name ?? null
      }
      images={files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        url: signed.get(file.id) ?? null,
      }))}
      payments={payments}
      relatedTasks={relatedTasks}
      // Anular es del dueño (`enforce_archive_rules`): al ayudante ni se le
      // ofrece, y si lo intentara la base lo rechazaría igual.
      canVoidPayments={context.role === "owner"}
      history={history}
      today={todayInTimezone(context.organization.timezone)}
      timezone={context.organization.timezone}
      from={from ?? null}
      toolActions={toolActions}
      currency={context.organization.currency}
    />
  );
}
