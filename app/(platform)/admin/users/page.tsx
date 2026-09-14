import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { UserList } from "@/features/platform/users/user-list";
import { getPlatformAdminContext } from "@/lib/auth/session-context";
import { resolveLimit } from "@/lib/pagination";
import { PlatformService } from "@/services/platform/platform-service";
import { UserAdminService } from "@/services/platform/user-admin-service";

export const metadata = { title: "Usuarios · Kamay" };

/** V25 · Usuarios (KAM-26): las cuentas de la plataforma, por ventanas. */
export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const context = await getPlatformAdminContext();
  if (!context) redirect("/dashboard");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const withoutOrganization = params.sin === "1";
  const limit = resolveLimit(typeof params.limit === "string" ? params.limit : null);

  const [page, { organizations }] = await Promise.all([
    new UserAdminService(context.supabase).listPage({ query, withoutOrganization }, limit),
    // Las organizaciones que ofrece «Agregar usuario», con tope.
    new PlatformService(context.supabase).listActiveOrganizations(),
  ]);

  return (
    <MainContainer title="Usuarios" description="Todas las cuentas de la plataforma">
      <UserList
        users={page.rows}
        hasMore={page.hasMore}
        limit={limit}
        query={query}
        withoutOrganization={withoutOrganization}
        organizations={organizations}
      />
    </MainContainer>
  );
}
