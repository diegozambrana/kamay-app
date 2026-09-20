import { redirect } from "next/navigation";

import { catalogEntries } from "@/features/tools/catalog-view";
import { ToolsCatalog } from "@/features/tools/tools-catalog";
import { getOwnerContext } from "@/lib/auth/session-context";
import { OrganizationToolService } from "@/services/tools/organization-tool-service";
import { TOOLS } from "@/tools/registry";

export const metadata = { title: "Herramientas · Configuración · Kamay" };

/**
 * KAM-27 · El catálogo de herramientas. La guardia va aquí y no en el layout,
 * como en el resto de las secciones de la dueña (design D6 de KAM-17).
 */
export default async function ToolsSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const rows = await new OrganizationToolService(context.supabase).list(context.organizationId);

  return <ToolsCatalog entries={catalogEntries(TOOLS, rows)} />;
}
