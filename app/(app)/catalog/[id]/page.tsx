import { notFound, redirect } from "next/navigation";

import { ItemDetail } from "@/features/catalog/item-detail";
import { getSessionContext } from "@/lib/auth/session-context";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ItemService } from "@/services/catalog/item-service";
import { ItemVariantService } from "@/services/catalog/item-variant-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { UnitService } from "@/services/configuration/unit-service";

export const metadata = { title: "Ítem · Catálogo · Kamay" };

/**
 * V11 · Detalle de ítem. Ruta propia y no panel: el mapa de navegación exige
 * que el detalle sea enlazable desde reportes, avisos y líneas de pedido.
 */
export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;
  const item = await new ItemService(context.supabase).findById(
    context.organizationId,
    id,
  );
  if (!item) notFound();

  const attachments = new AttachmentService(context.supabase);

  const [variants, lines, units, history, photoRows] = await Promise.all([
    new ItemVariantService(context.supabase).listForItem(
      context.organizationId,
      item.id,
    ),
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new UnitService(context.supabase).listActive(context.organizationId),
    // La bitácora solo la lee el dueño: para el ayudante RLS devuelve vacío.
    context.membership.role === "owner"
      ? new ItemService(context.supabase).history(context.organizationId, item.id)
      : Promise.resolve([]),
    attachments.listForEntities(context.organizationId, "item", [item.id]),
  ]);

  // El bucket es privado: cada lectura se firma, y una firma que falla deja la
  // tarjeta sin imagen en vez de tumbar la página.
  const signed = await attachments.signedUrls(photoRows);
  const photos = photoRows.map((photo) => ({
    ...photo,
    url: signed.get(photo.id) ?? null,
  }));

  return (
    <ItemDetail
      item={item}
      variants={variants}
      photos={photos}
      lines={lines}
      units={units}
      history={history}
      role={context.membership.role}
      timeZone={context.membership.organization.timezone}
    />
  );
}
