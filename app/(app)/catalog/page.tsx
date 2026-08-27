import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { CatalogScreen } from "@/features/catalog/catalog-screen";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { itemKindSchema } from "@/lib/catalog/schema";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { UnitService } from "@/services/configuration/unit-service";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ItemService } from "@/services/catalog/item-service";
import { ALL_LINES, type ItemKind } from "@/types";

export const metadata = { title: "Catálogo · Kamay" };

/**
 * V10 · Catálogo. Página completa para ambos roles: el ayudante crea y edita,
 * solo el dueño archiva. Los filtros viven en la dirección para que el listado
 * sea enlazable y compartible.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    line?: string;
    q?: string;
    archived?: string;
  }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  const kind: ItemKind = itemKindSchema.safeParse(params.kind).data ?? "supply";
  const search = params.q ?? "";
  const includeArchived = params.archived === "1";

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );
  const units = await new UnitService(context.supabase).listActive(
    context.organizationId,
  );

  // "all" no filtra; "shared" pide los que no pertenecen a ninguna línea.
  const requested = params.line ?? "all";
  const lineFilter =
    requested === "all" || requested === "shared"
      ? requested
      : (lines.find((line) => line.id === requested)?.id ?? "all");

  const items = await new ItemService(context.supabase).list(
    context.organizationId,
    {
      kind,
      businessLineId:
        lineFilter === "all" ? null : (lineFilter as string | "shared"),
      search,
      includeArchived,
    },
  );

  // Las miniaturas: los buckets son privados, así que cada lectura se firma.
  // Se piden en lote para no encadenar una petición por fila.
  const attachments = new AttachmentService(context.supabase);
  const photos = await attachments.listForEntities(
    context.organizationId,
    "item",
    items.map((item) => item.id),
  );
  const signed = await attachments.signedUrls(photos);

  // La foto vigente de un ítem es la más reciente: `listForEntities` ya
  // entrega de la más nueva a la más vieja, así que la primera gana.
  const photoUrls = new Map<string, string>();
  for (const photo of photos) {
    const url = signed.get(photo.id);
    if (url && !photoUrls.has(photo.entityId)) {
      photoUrls.set(photo.entityId, url);
    }
  }

  // La línea activa del selector global preselecciona el formulario (D5).
  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );

  return (
    <CatalogScreen
      items={items.map((item) => ({
        ...item,
        photoUrl: photoUrls.get(item.id) ?? null,
      }))}
      lines={lines}
      units={units}
      kind={kind}
      lineFilter={lineFilter}
      search={search}
      includeArchived={includeArchived}
      role={context.membership.role}
      activeLineId={activeLine === ALL_LINES ? null : activeLine}
    />
  );
}
