import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { ToolPage } from "@/features/tools/tool-components";
import { getSessionContext } from "@/lib/auth/session-context";
import { getRequestActiveToolSlugs } from "@/lib/tools/request-tools";
import { OrganizationToolService } from "@/services/tools/organization-tool-service";
import { toolBySlug, usableTool } from "@/tools/resolve";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Solo el nombre, que es público en el registro: si la persona puede usarla
  // o no lo decide la página, no el título de la pestaña.
  return { title: `${toolBySlug(slug)?.name ?? "Herramienta"} · Kamay` };
}

/**
 * KAM-27 · La página propia de una herramienta (spec `tenant-tools` → *Una
 * herramienta activa tiene página propia*).
 *
 * Responde solo si la herramienta está en el registro, está activa para **esta**
 * organización y el rol alcanza. Cualquier otra cosa es «no encontrada», el
 * mismo mensaje para los tres casos: distinguirlos le diría a alguien que la
 * herramienta existe para otro taller.
 */
export default async function ToolExtensionPage({ params }: Props) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { slug } = await params;
  const activeSlugs = await getRequestActiveToolSlugs(context.organizationId);
  const tool = usableTool(slug, activeSlugs, context.role, { hook: "page" });
  if (!tool) notFound();

  // Los parámetros solo los lee la dueña (RLS). Para una herramienta de
  // ayudante llega `null` y la herramienta trabaja con sus valores por defecto.
  const config = await new OrganizationToolService(context.supabase).getActiveConfig(
    context.organizationId,
    tool.slug,
  );

  return (
    <MainContainer
      title={tool.name}
      description={tool.description}
      breadcrumbs={[
        context.role === "owner"
          ? { label: "Herramientas", href: "/settings/tools" }
          : { label: "Herramientas" },
        { label: tool.name },
      ]}
    >
      <ToolPage slug={tool.slug} config={config} currency={context.organization.currency} />
    </MainContainer>
  );
}
