import { redirect } from "next/navigation";

import { BusinessLinesSection } from "@/features/settings/business-lines-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { BusinessLineService } from "@/services/configuration/business-line-service";

export const metadata = { title: "Líneas · Configuración · Kamay" };

export default async function LinesSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  // listAll: la pantalla de configuración es el único sitio donde lo
  // archivado sigue visible, para poder restaurarlo.
  const lines = await new BusinessLineService(context.supabase).listAll(
    context.organizationId,
  );

  return <BusinessLinesSection lines={lines} />;
}
