import { redirect } from "next/navigation";

import { StatusesSection } from "@/features/settings/statuses/statuses-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { statusFlowSchema } from "@/lib/statuses/schema";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { StatusService } from "@/services/configuration/status-service";

export const metadata = { title: "Estados · Configuración · Kamay" };

/**
 * V22 · Configuración de estados. El alcance vive en la dirección
 * (`?flow=order&line=<id|org>`): la página entrega el juego exacto de ese
 * alcance, incluido lo archivado, y la resolución sigue siendo asunto de la
 * base (`resolve_statuses`).
 */
export default async function StatusesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string; line?: string }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const params = await searchParams;
  const flow = statusFlowSchema.safeParse(params.flow).data ?? "order";

  const lines = (
    await new BusinessLineService(context.supabase).listActive(
      context.organizationId,
    )
  ).filter((line) => !line.isShared);

  const requestedLine = params.line && params.line !== "org" ? params.line : null;
  const businessLineId =
    lines.find((line) => line.id === requestedLine)?.id ?? null;

  const statuses = await new StatusService(context.supabase).listForScope(
    context.organizationId,
    businessLineId,
    flow,
  );

  return (
    <StatusesSection
      lines={lines}
      flow={flow}
      businessLineId={businessLineId}
      statuses={statuses}
    />
  );
}
