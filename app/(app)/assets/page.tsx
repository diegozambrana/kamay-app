import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { AssetsScreen, type AssetRowView } from "@/features/assets/assets-screen";
import type { AssetDetailView } from "@/features/assets/asset-detail-panel";
import { getOwnerContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { AssetService } from "@/services/assets/asset-service";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ALL_LINES } from "@/types";

export const metadata = { title: "Activos · Kamay" };

/**
 * V12 · Activos. Solo la persona dueña: la matriz de acceso §16 deja
 * `asset_details` sin acceso para el ayudante, y quien llegue por dirección
 * directa va a su aterrizaje habitual, sin pantalla de "no autorizado" — el
 * mismo trato que ya recibe `/expenses`.
 *
 * Página delgada: ninguna consulta a Supabase fuera de `services/`
 * (convención nº 1) y ningún porcentaje calculado aquí (design D5).
 */
export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; selected?: string }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  const includeArchived = params.archived === "1";

  const lines = await new BusinessLineService(context.supabase).listAll(
    context.organizationId,
  );
  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines.filter((line) => line.archivedAt === null),
  );
  const activeLineId = activeLine === ALL_LINES ? null : activeLine;

  const assetService = new AssetService(context.supabase);

  const [recoveries, suppliers] = await Promise.all([
    assetService.list(context.organizationId, {
      businessLineId: activeLineId,
      includeArchived,
    }),
    new ContactService(context.supabase).list(context.organizationId, {
      role: "supplier",
    }),
  ]);

  // El archivado y el nombre de la línea viven en el ítem y en la línea, no en
  // la vista: se resuelven aquí, sobre el conjunto ya recortado.
  const items = await new ItemService(context.supabase).list(context.organizationId, {
    kind: "asset",
    includeArchived: true,
  });
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const linesById = new Map(lines.map((line) => [line.id, line]));

  const assets: AssetRowView[] = recoveries.map((asset) => {
    const line = asset.businessLineId ? linesById.get(asset.businessLineId) : undefined;
    return {
      ...asset,
      lineName: line?.name ?? "Compartido",
      lineColor: line?.color ?? ("zinc" as const),
      archivedAt: itemsById.get(asset.itemId)?.archivedAt ?? null,
    };
  });

  let detail: AssetDetailView | null = null;

  if (params.selected) {
    const asset = await assetService.recovery(context.organizationId, params.selected);
    if (asset) {
      const [details, expenses, history] = await Promise.all([
        assetService.details(context.organizationId, asset.itemId),
        assetService.expenses(context.organizationId, asset.itemId),
        assetService.history(context.organizationId, asset.itemId),
      ]);

      // Con archivados: un activo vigente puede haberse comprado a un
      // proveedor ya archivado, y su nombre tiene que seguir apareciendo.
      const allSuppliers = await new ContactService(context.supabase).list(
        context.organizationId,
        { role: "supplier", includeArchived: true },
      );

      detail = {
        asset,
        supplierId: details?.supplierId ?? null,
        supplierName:
          allSuppliers.find((contact) => contact.id === details?.supplierId)?.name ?? null,
        notes: details?.notes ?? null,
        expenses,
        history,
        suppliers: suppliers.map((contact) => ({ id: contact.id, name: contact.name })),
      };
    }
  }

  return (
    <AssetsScreen
      assets={assets}
      detail={detail}
      timezone={context.membership.organization.timezone}
      includeArchived={includeArchived}
    />
  );
}
