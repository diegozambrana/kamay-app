import { redirect } from "next/navigation";

import { AllocationRuleForm } from "@/features/settings/allocation-rule-form";
import { GeneralForm } from "@/features/settings/general-form";
import { getOwnerContext } from "@/lib/auth/session-context";
import { AllocationRuleService } from "@/services/configuration/allocation-rule-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { OrganizationService } from "@/services/organization-service";

export const metadata = { title: "General · Configuración · Kamay" };

export default async function GeneralSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const [organization, lines, allocation] = await Promise.all([
    new OrganizationService(context.supabase).getById(context.organizationId),
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new AllocationRuleService(context.supabase).get(context.organizationId),
  ]);

  // La línea compartida es la que se reparte: no puede recibir su propia
  // parte, así que no aparece entre los destinos del reparto.
  const targets = lines.filter((line) => !line.isShared);

  return (
    <section>
      <h2 className="text-lg font-medium">General</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Datos de la organización.
      </p>
      <GeneralForm organization={organization} />

      <h3 className="mt-8 text-base font-medium">
        Reparto de gastos compartidos
      </h3>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Los egresos de la línea General no son de nadie y son de todos. Esta
        regla decide cómo se reparten entre las demás líneas en los reportes, y
        se muestra siempre junto al resultado.
      </p>
      <AllocationRuleForm lines={targets} settings={allocation} />
    </section>
  );
}
