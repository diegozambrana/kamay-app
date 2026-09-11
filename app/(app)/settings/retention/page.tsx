import { redirect } from "next/navigation";

import { RetentionForm } from "@/features/settings/retention-form";
import { getOwnerContext } from "@/lib/auth/session-context";
import { RetentionPolicyService } from "@/services/activity/retention-service";

export const metadata = { title: "Retención · Configuración · Kamay" };

/**
 * La guardia va aquí y no en el layout: desde KAM-17 el de `/settings` solo
 * exige sesión, porque las preferencias de notificación son de la persona y no
 * del taller (design D13). La retención sí es del taller.
 */
export default async function RetentionSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const months = await new RetentionPolicyService(context.supabase).get(
    context.organizationId,
  );

  return <RetentionForm months={months} />;
}
