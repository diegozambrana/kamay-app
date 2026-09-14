import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { OrganizationList } from "@/features/platform/organizations/organization-list";
import { getPlatformAdminContext } from "@/lib/auth/session-context";
import { resolveLimit } from "@/lib/pagination";
import { OrganizationAdminService } from "@/services/platform/organization-admin-service";

export const metadata = { title: "Organizaciones · Kamay" };

/**
 * V24 · Organizaciones (KAM-26). El layout de `(platform)` ya exige super
 * admin; esto lo vuelve a comprobar porque la página consulta.
 */
export default async function OrganizationsPage({
  searchParams,
}: PageProps<"/admin/organizations">) {
  const context = await getPlatformAdminContext();
  if (!context) redirect("/dashboard");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const limit = resolveLimit(typeof params.limit === "string" ? params.limit : null);

  const page = await new OrganizationAdminService(context.supabase).listPage(query, limit);

  return (
    <MainContainer
      title="Organizaciones"
      description="Todas las organizaciones de la plataforma"
    >
      <OrganizationList
        organizations={page.rows}
        hasMore={page.hasMore}
        limit={limit}
        query={query}
        activeOrganizationId={context.access?.organizationId ?? null}
      />
    </MainContainer>
  );
}
