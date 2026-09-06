import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { QuickGrid } from "@/features/quick-capture/quick-grid";
import { RecentToday } from "@/features/quick-capture/recent-today";
import { getSessionContext } from "@/lib/auth/session-context";
import { todayInTimezone } from "@/lib/orders/overdue";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { RecentCaptureService } from "@/services/quick-capture/recent-capture-service";

export const metadata = { title: "Registro rápido · Kamay" };

/**
 * V16 · Registro rápido. La puerta de entrada del celular (mapa §2.1).
 *
 * Cascarón delgado: resuelve "hoy" en la zona de la organización y pide al
 * servicio lo ya sincronizado. La mitad pendiente de la lista la aporta el
 * cliente desde la cola, porque vive en este dispositivo (design D3b).
 */
export default async function QuickPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const timezone = context.membership.organization.timezone;
  // La zona de la organización, no la del servidor: un taller que registra a
  // las 23:40 no debe ver su captura caer en el día equivocado.
  const today = todayInTimezone(timezone);

  const [synced, lines] = await Promise.all([
    new RecentCaptureService(context.supabase).listToday(
      context.organizationId,
      today,
    ),
    new BusinessLineService(context.supabase).listActive(context.organizationId),
  ]);

  const lineNames = Object.fromEntries(lines.map((line) => [line.id, line.name]));

  return (
    <MainContainer
      title="Registro rápido"
      description="Anota lo que acaba de pasar, sin buscar la sección."
    >
      <div className="space-y-6">
        <QuickGrid />

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Registrado hoy
          </h2>
          <RecentToday
            synced={synced}
            today={today}
            timezone={timezone}
            lineNames={lineNames}
          />
        </section>
      </div>
    </MainContainer>
  );
}
