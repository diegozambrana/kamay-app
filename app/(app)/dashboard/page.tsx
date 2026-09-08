import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { lineCookieName } from "@/constants/auth";
import { AssistantDashboard } from "@/features/dashboard/assistant-dashboard";
import { OwnerDashboard } from "@/features/dashboard/owner-dashboard";
import type { ActivityItem } from "@/features/dashboard/recent-activity";
import type { DeliveryItem } from "@/features/dashboard/upcoming-deliveries";
import { outstandingFor } from "@/features/payments/outstanding-summary";
import { recordHref } from "@/lib/activity/describe";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { comparisonRows } from "@/lib/dashboard/indicators";
import { pendingCounts } from "@/lib/tasks/groups";
import {
  monthLabel,
  monthStartInTimezone,
  upcomingWindow,
} from "@/lib/dashboard/period";
import { ActivityService } from "@/services/activity/activity-service";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { DashboardService } from "@/services/dashboard/dashboard-service";
import { InvitationService } from "@/services/invitation-service";
import { OrderService } from "@/services/orders/order-service";
import { PaymentService } from "@/services/payments/payment-service";
import { TaskService } from "@/services/tasks/task-service";
import { ALL_LINES } from "@/types";

export const metadata = { title: "Panel · Kamay" };

/**
 * V2 · Panel principal.
 *
 * La página es delgada y decide una sola cosa: **qué composición toca**. El
 * rol se resuelve aquí, en el servidor, antes del primer render, y cada
 * composición recibe solo sus datos. Al ayudante no se le piden los de dinero
 * ni los de bitácora —no es que no se pinten: no se consultan (design D5)—.
 *
 * Ninguna cifra del panel se almacena: la caja del mes sale de
 * `cash_flow_by_line_month` y el saldo por cobrar de `receivables_by_line`,
 * ambas vistas derivadas (convención nº 4).
 */
export default async function DashboardPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { supabase, organizationId, membership } = context;
  const timezone = membership.organization.timezone;
  const isOwner = membership.role === "owner";

  const lines = await new BusinessLineService(supabase).listActive(
    organizationId,
  );
  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(organizationId))?.value,
    lines,
  );
  const activeLineId = activeLine === ALL_LINES ? null : activeLine;

  // El periodo y el horizonte, en la zona del taller y resueltos en el
  // servidor: la pantalla no puede aparecer con un mes y cambiarlo al
  // hidratar.
  const monthStart = monthStartInTimezone(timezone);
  const period = monthLabel(monthStart);
  const { today, horizon } = upcomingWindow(timezone);

  // ── Lo que ven los dos roles ────────────────────────────────────────────
  const dashboard = new DashboardService(supabase);
  const deliveries = await dashboard.upcomingDeliveries(
    organizationId,
    activeLineId,
    horizon,
  );

  const contacts = await new ContactService(supabase).list(organizationId, {
    includeArchived: true,
  });
  const contactNames = new Map(contacts.map((c) => [c.id, c.name]));
  const lineById = new Map(lines.map((line) => [line.id, line]));

  // Los conteos de pendientes salen de la **misma** función que agrupa V20, y
  // deliberadamente sin filtrar por línea: la tarjeta cuenta lo mismo que esa
  // pantalla, que es una de las dos que ignoran el selector. El recorte por rol
  // lo aplicó ya la RLS al leer.
  const pending = pendingCounts(
    (await new TaskService(supabase).listPending(organizationId)).map((task) => ({
      id: task.id,
      dueDate: task.dueAt ? task.dueAt.slice(0, 10) : null,
      closedAt: task.closedAt,
    })),
    today,
  );

  const deliveryItems: DeliveryItem[] = deliveries.map((delivery) => ({
    ...delivery,
    contactName: delivery.contactId
      ? (contactNames.get(delivery.contactId) ?? null)
      : null,
    lineColor: lineById.get(delivery.businessLineId)?.color ?? "zinc",
    lineName: lineById.get(delivery.businessLineId)?.name ?? "",
  }));

  if (!isOwner) {
    return (
      <MainContainer title="Panel" description={`Entregas y pendientes · ${period}`}>
        <AssistantDashboard
          deliveries={deliveryItems}
          today={today}
          pending={pending}
        />
      </MainContainer>
    );
  }

  // ── Lo que solo ve la persona dueña ─────────────────────────────────────
  const { total, byLine } = await dashboard.cashFlowForMonth(
    organizationId,
    monthStart,
    activeLineId,
  );

  // Por cobrar es un saldo vivo, no un flujo del mes: se lee de la vista que
  // KAM-10 ya dejó hecha y se suma con su misma regla.
  const receivables = await new PaymentService(supabase).receivables(
    organizationId,
  );

  const activity = await new ActivityService(supabase).recent(organizationId, {
    limit: 5,
    businessLineId: activeLineId,
  });

  // Quién hizo cada cosa: el nombre de la persona, no su identificador.
  const members = await new InvitationService(supabase).listMembers(
    organizationId,
  );
  const memberNames = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );

  // El rótulo humano del registro. Hoy solo los pedidos tienen uno —el
  // "#142"—; el resto se cuenta sin él antes que con un identificador.
  const orderIds = activity
    .filter((entry) => entry.tableName === "orders")
    .map((entry) => entry.recordId);
  const orderCodes = await new OrderService(supabase).codesFor(
    organizationId,
    orderIds,
  );

  const activityItems: ActivityItem[] = activity.map((entry) => ({
    id: entry.id,
    action: entry.action,
    tableName: entry.tableName,
    actorName: entry.actorId
      ? (memberNames.get(entry.actorId) ?? null)
      : null,
    actorLabel: entry.actorLabel,
    recordLabel: orderCodes.has(entry.recordId)
      ? `#${orderCodes.get(entry.recordId)}`
      : null,
    occurredAt: entry.occurredAt,
    href: recordHref(entry.tableName, entry.recordId),
  }));

  return (
    <MainContainer title="Panel" description={`Cómo va el negocio · ${period}`}>
      <OwnerDashboard
        flow={total}
        receivable={outstandingFor(receivables, activeLine)}
        comparison={comparisonRows(lines, byLine)}
        deliveries={deliveryItems}
        activity={activityItems}
        pending={pending}
        activeLineId={activeLineId}
        monthLabel={period}
        today={today}
        timezone={timezone}
      />
    </MainContainer>
  );
}
