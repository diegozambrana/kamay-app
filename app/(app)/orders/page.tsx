import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { OrdersScreen } from "@/features/orders/orders-screen";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ContactService } from "@/services/catalog/contact-service";
import { StatusService } from "@/services/configuration/status-service";
import { OrderItemService } from "@/services/orders/order-item-service";
import { OrderService } from "@/services/orders/order-service";
import { ALL_LINES, type Status } from "@/types";

export const metadata = { title: "Pedidos · Kamay" };

const VIEWS = ["board", "list", "calendar"] as const;
type View = (typeof VIEWS)[number];

/**
 * V3 · Tablero de pedidos. Las columnas no están escritas en ninguna parte:
 * salen del juego de estados de la línea activa, resuelto por la base.
 *
 * Los filtros y la vista viven en la dirección (`?view=&q=&archived=`) para
 * que el tablero sea enlazable y para que cambiar de vista los conserve sin
 * ningún estado compartido.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; archived?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View)
    ? (params.view as View)
    : "board";
  const search = params.q ?? "";
  const includeArchived = params.archived === "1";

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );

  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );
  const activeLineId = activeLine === ALL_LINES ? null : activeLine;

  // Con "Todas" activa no hay un juego único de columnas: Sublimación tiene
  // seis estados y Alfarería tres, sin correspondencia. El tablero pide
  // elegir una línea; lista y calendario sí cruzan todas (design.md D1).
  const statuses: Status[] = activeLineId
    ? await new StatusService(context.supabase).resolve(
        context.organizationId,
        activeLineId,
        "order",
      )
    : [];

  const orders = await new OrderService(context.supabase).list(
    context.organizationId,
    { businessLineId: activeLineId, search, includeArchived },
  );

  // El cliente de cada tarjeta, en una sola consulta en vez de una por fila.
  const contacts = await new ContactService(context.supabase).list(
    context.organizationId,
    { includeArchived: true },
  );
  const contactNames = new Map(contacts.map((c) => [c.id, c.name]));

  const lineColors = new Map(lines.map((line) => [line.id, line.color]));

  // El `kind` del estado de cada pedido. Se leen todos los del flujo y no
  // solo el juego resuelto: con "Todas" activa conviven pedidos de líneas
  // distintas, y un pedido antiguo puede estar en un estado ya archivado.
  const allStatuses = await new StatusService(context.supabase).listAllForFlow(
    context.organizationId,
    "order",
  );
  const statusKinds = new Map(allStatuses.map((s) => [s.id, s.kind]));

  // El resumen de las líneas, en lote: una consulta para todas las tarjetas.
  const summaries = await new OrderItemService(context.supabase).summariesFor(
    context.organizationId,
    orders.map((order) => order.id),
  );

  return (
    <OrdersScreen
      orders={orders.map((order) => ({
        ...order,
        contactName: order.contactId
          ? (contactNames.get(order.contactId) ?? null)
          : null,
        lineColor: lineColors.get(order.businessLineId) ?? "zinc",
        statusKind: statusKinds.get(order.statusId) ?? "in_progress",
        itemsSummary: summaries.get(order.id) ?? null,
      }))}
      statuses={statuses}
      allStatuses={allStatuses}
      lines={lines}
      activeLineId={activeLineId}
      view={view}
      search={search}
      includeArchived={includeArchived}
      // "Hoy" en la zona horaria de la organización, no en la del navegador:
      // se resuelve en el servidor y viaja como dato (design.md D5).
      today={todayInTimezone(context.membership.organization.timezone)}
    />
  );
}
