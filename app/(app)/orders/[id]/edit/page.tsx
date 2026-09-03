import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { OrderForm } from "@/features/orders/order-form";
import type { LineNames } from "@/features/orders/order-lines-editor";
import { getSessionContext } from "@/lib/auth/session-context";
import { todayInTimezone } from "@/lib/orders/overdue";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";
import { OrderItemService } from "@/services/orders/order-item-service";
import { OrderService } from "@/services/orders/order-service";

export const metadata = { title: "Editar pedido · Kamay" };

/**
 * Edición de un pedido existente. Los mismos campos que el alta salvo la
 * línea de negocio, que se muestra pero no se cambia: cambiarla movería el
 * pedido a otro juego de estados.
 *
 * Un pedido archivado no se edita — lo garantiza la base y aquí se dice antes
 * de que la persona escriba nada.
 */
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;

  const order = await new OrderService(context.supabase).getById(
    context.organizationId,
    id,
  );
  if (!order) notFound();

  if (order.archivedAt) {
    return (
      <MainContainer
        title={`Pedido #${order.code}`}
        description="Este pedido está archivado."
      >
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Un pedido archivado no se edita</EmptyTitle>
            <EmptyDescription>
              Desarchívalo desde el tablero, con «Ver archivados» activo, y
              vuelve a intentarlo.{" "}
              <Link href={`/orders/${order.id}`} className="underline">
                Ver el pedido
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </MainContainer>
    );
  }

  // Solo las líneas vigentes: las archivadas son historia del pedido, no algo
  // que el formulario deba reenviar.
  const lines = await new OrderItemService(context.supabase).listByOrder(
    context.organizationId,
    order.id,
  );

  const [businessLines, channels, contacts, products] = await Promise.all([
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new SalesChannelService(context.supabase).listActive(context.organizationId),
    new ContactService(context.supabase).list(context.organizationId, {
      // El cliente del pedido puede haberse archivado después: si no viniera,
      // el buscador no podría mostrarlo y la edición lo perdería.
      includeArchived: true,
    }),
    new ItemService(context.supabase).listProductsWithVariants(
      context.organizationId,
    ),
  ]);

  // Las imágenes ya guardadas, con su URL firmada: el bucket es privado.
  const attachmentService = new AttachmentService(context.supabase);
  const files = await attachmentService.listForEntities(
    context.organizationId,
    "order",
    [order.id],
  );
  const signed = await attachmentService.signedUrls(files);

  const names: Record<string, LineNames> = {};
  for (const line of lines) {
    names[line.id] = { item: line.itemName, variant: line.variantName };
  }

  return (
    <OrderForm
      mode="edit"
      code={order.code}
      defaultValues={{
        id: order.id,
        businessLineId: order.businessLineId,
        contactId: order.contactId ?? "",
        salesChannelId: order.salesChannelId,
        deliveryMode: order.deliveryMode,
        dueDate: order.dueDate,
        notes: order.notes ?? "",
        occurredAt: order.occurredAt,
        items: lines.map((line) => ({
          id: line.id,
          itemId: line.itemId,
          variantId: line.variantId,
          description: line.description ?? "",
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      }}
      initialNames={names}
      lines={businessLines}
      channels={channels}
      contacts={contacts}
      products={products}
      attachments={files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        url: signed.get(file.id) ?? null,
      }))}
      today={todayInTimezone(context.membership.organization.timezone)}
    />
  );
}
