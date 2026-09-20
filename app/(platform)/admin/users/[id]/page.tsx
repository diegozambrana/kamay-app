import { notFound, redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { UserDetail } from "@/features/platform/users/user-detail";
import { getPlatformAdminContext } from "@/lib/auth/session-context";
import { displayNameOf } from "@/lib/platform/users";
import { PlatformService } from "@/services/platform/platform-service";
import { UserAdminService } from "@/services/platform/user-admin-service";

export const metadata = { title: "Cuenta · Kamay" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Detalle de una cuenta desde la plataforma (KAM-26). */
export default async function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const context = await getPlatformAdminContext();
  if (!context) redirect("/dashboard");

  const [user, { organizations, hasMore }] = await Promise.all([
    new UserAdminService(context.supabase).get(id),
    new PlatformService(context.supabase).listActiveOrganizations(),
  ]);
  if (!user) notFound();

  return (
    <MainContainer
      breadcrumbs={[
        { label: "Usuarios", href: "/admin/users" },
        { label: displayNameOf(user) ?? user.email },
      ]}
      title={displayNameOf(user) ?? user.email}
      description="Organizaciones y roles de la cuenta"
    >
      <UserDetail user={user} organizations={organizations} moreOrganizations={hasMore} />
    </MainContainer>
  );
}
