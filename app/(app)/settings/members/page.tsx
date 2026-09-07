import { redirect } from "next/navigation";

import { MembersSection } from "@/features/settings/members-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { InvitationService } from "@/services/invitation-service";
import { MembershipService } from "@/services/membership-service";

export const metadata = { title: "Usuarios · Configuración · Kamay" };

export default async function MembersSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const service = new InvitationService(context.supabase);
  const [members, invitations, lines, assigned] = await Promise.all([
    service.listMembers(context.organizationId),
    service.listPending(context.organizationId),
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new MembershipService(context.supabase).listLinesByMembership(
      context.organizationId,
    ),
  ]);

  return (
    <MembersSection
      members={members}
      invitations={invitations}
      lines={lines}
      // El `Map` no cruza la frontera servidor→cliente: se serializa como
      // objeto plano, que es lo que la sección necesita para pintar.
      assignedLines={Object.fromEntries(assigned)}
    />
  );
}
