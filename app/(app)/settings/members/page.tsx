import { redirect } from "next/navigation";

import { MembersSection } from "@/features/settings/members-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { InvitationService } from "@/services/invitation-service";

export const metadata = { title: "Usuarios · Configuración · Kamay" };

export default async function MembersSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const service = new InvitationService(context.supabase);
  const [members, invitations] = await Promise.all([
    service.listMembers(context.organizationId),
    service.listPending(context.organizationId),
  ]);

  return <MembersSection members={members} invitations={invitations} />;
}
