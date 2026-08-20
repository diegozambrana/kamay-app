import { redirect } from "next/navigation";

import { UnitsSection } from "@/features/settings/units-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { UnitService } from "@/services/configuration/unit-service";

export const metadata = { title: "Unidades · Configuración · Kamay" };

export default async function UnitsSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const units = await new UnitService(context.supabase).listAll(
    context.organizationId,
  );

  return <UnitsSection units={units} />;
}
