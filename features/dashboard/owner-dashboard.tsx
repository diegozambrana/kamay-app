import type { CashFlow, LineCashFlow } from "@/lib/dashboard/indicators";

import { IndicatorCards } from "./indicator-cards";
import { LineComparison } from "./line-comparison";
import { PendingTasksCard, type PendingCounts } from "./pending-tasks-card";
import { LOW_STOCK_PLACEHOLDER, PlaceholderCard } from "./placeholder-card";
import { RecentActivity, type ActivityItem } from "./recent-activity";
import { UpcomingDeliveries, type DeliveryItem } from "./upcoming-deliveries";

export type OwnerDashboardProps = {
  flow: CashFlow;
  receivable: number;
  comparison: readonly LineCashFlow[];
  deliveries: readonly DeliveryItem[];
  activity: readonly ActivityItem[];
  pending: PendingCounts;
  activeLineId: string | null;
  monthLabel: string;
  today: string;
  timezone: string;
};

/**
 * V2 para la persona dueña: cómo va el negocio en cinco segundos.
 *
 * El orden de lectura es deliberado: primero las cifras del mes, después el
 * reparto entre líneas que las explica, después lo que hay que entregar, y al
 * final lo que pasó. De arriba abajo se contesta "cuánto", "de dónde", "qué
 * toca" y "qué cambió".
 *
 * Es un componente hermano de `AssistantDashboard`, no el mismo con
 * condicionales: el criterio 4 del backlog pide que la variante del ayudante
 * no tenga huecos, y una sola composición con `{isOwner && …}` produce
 * exactamente el diseño del dueño con agujeros (design D5).
 */
export function OwnerDashboard({
  flow,
  receivable,
  comparison,
  deliveries,
  activity,
  pending,
  activeLineId,
  monthLabel,
  today,
  timezone,
}: OwnerDashboardProps) {
  return (
    <div data-testid="owner-dashboard" className="flex flex-col gap-4">
      <IndicatorCards
        flow={flow}
        receivable={receivable}
        monthLabel={monthLabel}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineComparison
          rows={comparison}
          activeLineId={activeLineId}
          monthLabel={monthLabel}
        />
        <UpcomingDeliveries deliveries={deliveries} today={today} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity items={activity} timezone={timezone} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PendingTasksCard counts={pending} />
          <PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />
        </div>
      </div>
    </div>
  );
}
