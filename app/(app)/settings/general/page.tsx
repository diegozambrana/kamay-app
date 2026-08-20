import { redirect } from "next/navigation";

import { GeneralForm } from "@/features/settings/general-form";
import { getOwnerContext } from "@/lib/auth/session-context";
import { OrganizationService } from "@/services/organization-service";

export const metadata = { title: "General · Configuración · Kamay" };

export default async function GeneralSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const organization = await new OrganizationService(context.supabase).getById(
    context.organizationId,
  );

  return (
    <section>
      <h2 className="text-lg font-medium">General</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Datos de la organización.
      </p>
      <GeneralForm organization={organization} />
    </section>
  );
}
