import { notFound, redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { OrganizationDetail } from "@/features/platform/organizations/organization-detail";
import { getPlatformAdminContext } from "@/lib/auth/session-context";
import { OrganizationAdminService } from "@/services/platform/organization-admin-service";
import { UserAdminService } from "@/services/platform/user-admin-service";

export const metadata = { title: "Organización · Kamay" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Detalle de una organización desde la plataforma (KAM-26). */
export default async function OrganizationDetailPage({
  params,
}: PageProps<"/admin/organizations/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const context = await getPlatformAdminContext();
  if (!context) redirect("/dashboard");

  // El equipo de esta organización —acotado por ella—, no todas las cuentas.
  const [organization, members] = await Promise.all([
    new OrganizationAdminService(context.supabase).get(id),
    new UserAdminService(context.supabase).list({ organizationId: id }),
  ]);
  if (!organization) notFound();

  return (
    <MainContainer
      breadcrumbs={[
        { label: "Organizaciones", href: "/admin/organizations" },
        { label: organization.name },
      ]}
      title={organization.name}
      description="Datos y equipo de la organización"
    >
      <OrganizationDetail organization={organization} members={members} />
    </MainContainer>
  );
}
