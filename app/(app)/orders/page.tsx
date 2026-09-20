import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { OrdersScreen } from "@/features/orders/orders-screen";
import { isMobileUserAgent } from "@/lib/auth/routes";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ContactService } from "@/services/catalog/contact-service";
import { StatusService } from "@/services/configuration/status-service";
import { OrderItemService } from "@/services/orders/order-item-service";
import { OrderService } from "@/services/orders/order-service";
import { PaymentService } from "@/services/payments/payment-service";
import { resolveLimit } from "@/lib/pagination";
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
  searchParams: Promise<{ view?: string; q?: string; archived?: string; closed?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  // La vista por omisión depende del dispositivo: un kanban horizontal no
  // funciona en 390 px, así que el celular abre en lista y el escritorio en
  // tablero. Se decide aquí, en el servidor, para que la pantalla no aparezca
  // como tablero y se convierta en lista tras hidratar (design D4). Una vista
  // declarada en la dirección manda sobre el dispositivo: un enlace expresa
  // una intención.
  const fallback: View = isMobileUserAgent((await headers()).get("user-agent"))
    ? "list"
    : "board";
  const view: View = VIEWS.includes(params.view as View)
    ? (params.view as View)
    : fallback;
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
  // seis estados y Alfarería tres, sin correspondencia. El tablero agrupa
  // entonces por tipo de estado; lista y calendario cruzan todas (design.md
  // D1; design D5 de `navigation-breadcrumbs-and-all-lines-board`).
  const statuses: Status[] = activeLineId
    ? await new StatusService(context.supabase).resolve(
        context.organizationId,
        activeLineId,
        "order",
      )
    : [];

  // Con "Todas" el tablero agrupa por tipo de estado, y mover un pedido a una
  // columna lo lleva al primer estado de ese tipo en el juego de SU línea:
  // hace falta el juego de cada una. Son pocas líneas; se resuelven en
  // paralelo.
  const statusesByLine: Record<string, Status[]> = activeLineId
    ? {}
    : Object.fromEntries(
        await Promise.all(
          lines.map(
            async (line) =>
              [
                line.id,
                await new StatusService(context.supabase).resolve(
                  context.organizationId,
                  line.id,
                  "order",
                ),
              ] as const,
          ),
        ),
      );

  // El `kind` del estado de cada pedido. Se leen todos los del flujo y no
  // solo el juego resuelto: con "Todas" activa conviven pedidos de líneas
  // distintas, y un pedido antiguo puede estar en un estado ya archivado.
  const allStatuses = await new StatusService(context.supabase).listAllForFlow(
    context.organizationId,
    "order",
  );
  const statusKinds = new Map(allStatuses.map((s) => [s.id, s.kind]));

  // Todo lo abierto y, de lo entregado y lo cancelado, solo lo reciente: es
  // lo que crece sin fin (KAM-23, `performance-budget`). «Mostrar más» amplía
  // la ventana con `?closed=`.
  const closedLimit = resolveLimit(params.closed);
  const { orders, hasMoreClosed } = await new OrderService(context.supabase).listWindow(
    context.organizationId,
    {
      businessLineId: activeLineId,
      search,
      includeArchived,
      closedStatusIds: allStatuses
        .filter((status) => status.kind === "final" || status.kind === "cancelled")
        .map((status) => status.id),
      closedLimit,
    },
  );

  // El cliente de cada tarjeta, en lote y solo de lo que se muestra.
  const contactNames = await new ContactService(context.supabase).namesFor(
    context.organizationId,
    orders.flatMap((order) => (order.contactId ? [order.contactId] : [])),
  );

  const lineColors = new Map(lines.map((line) => [line.id, line.color]));


  // El resumen de las líneas, en lote: una consulta para todas las tarjetas.
  const summaries = await new OrderItemService(context.supabase).summariesFor(
    context.organizationId,
    orders.map((order) => order.id),
  );

  // Por cobrar por línea: un agregado derivado en la vista, nunca una suma
  // guardada. La cabecera muestra el de la línea activa.
  const receivables = await new PaymentService(context.supabase).receivables(
    context.organizationId,
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
      statusesByLine={statusesByLine}
      lines={lines}
      activeLineId={activeLineId}
      receivables={receivables}
      view={view}
      search={search}
      includeArchived={includeArchived}
      // "Hoy" en la zona horaria de la organización, no en la del navegador:
      // se resuelve en el servidor y viaja como dato (design.md D5).
      today={todayInTimezone(context.organization.timezone)}
      closedLimit={closedLimit}
      hasMoreClosed={hasMoreClosed}
    />
  );
}
