import { notFound, redirect } from "next/navigation";

import { ItemDetail } from "@/features/catalog/item-detail";
import { getSessionContext } from "@/lib/auth/session-context";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { AssetService } from "@/services/assets/asset-service";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { ItemVariantService } from "@/services/catalog/item-variant-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { UnitService } from "@/services/configuration/unit-service";
import { ItemLastCostService } from "@/services/expenses/item-last-cost-service";
import { MovementService } from "@/services/inventory/movement-service";
import { TaskService } from "@/services/tasks/task-service";

export const metadata = { title: "Ítem · Catálogo · Kamay" };

/**
 * Cuántos movimientos trae la primera página. Un insumo muy usado acumula
 * miles de filas al año (§Volumen esperado): la sección carga una página, no
 * el historial entero.
 */
const MOVEMENT_PAGE = 20;

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

  /**
   * Las tres secciones de inventario (KAM-18) son solo de los insumos: un
   * producto o un activo no tiene saldo que explicar.
   *
   * La evolución de precios **no se recorta con un `if` de rol**: se consulta
   * igual para los dos, y para el ayudante RLS devuelve cero filas porque no
   * tiene política de lectura sobre `expenses`. Si no hay datos, el servidor
   * compone sin la sección y nunca la envía (design D9).
   */
  const movements = new MovementService(context.supabase);
  const lastCosts = new ItemLastCostService(context.supabase);
  const isSupply = item.kind === "supply";

  const [balance, itemMovements, prices, lastCostMap] = await Promise.all([
    isSupply ? movements.balanceFor(context.organizationId, item.id) : null,
    isSupply
      ? movements.forItem(context.organizationId, item.id, { limit: MOVEMENT_PAGE })
      : [],
    isSupply ? lastCosts.pricesFor(context.organizationId, item.id) : [],
    isSupply ? lastCosts.mapFor(context.organizationId) : new Map(),
  ]);

  /**
   * Los datos de activo (KAM-19) son solo de los activos y solo del dueño:
   * `asset_details` está *sin acceso* para el ayudante (matriz §16), así que
   * ni se consultan ni llegan a la pantalla. El proveedor del formulario sale
   * del directorio, que ambos roles sí leen.
   */
  const isOwnedAsset = item.kind === "asset" && context.membership.role === "owner";

  const [assetDetails, suppliers] = await Promise.all([
    isOwnedAsset
      ? new AssetService(context.supabase).details(context.organizationId, item.id)
      : null,
    isOwnedAsset
      ? new ContactService(context.supabase).list(context.organizationId, {
          role: "supplier",
        })
      : [],
  ]);

  // El otro lado del vínculo (KAM-21). Un activo se vincula como `asset` y un
  // ítem corriente como `item`, así que se pregunta por el tipo que
  // corresponde a este ítem.
  const relatedTasks = await new TaskService(context.supabase).relatedTasks(
    context.organizationId,
    item.kind === "asset" ? "asset" : "item",
    item.id,
  );

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
      relatedTasks={relatedTasks}
      role={context.membership.role}
      timeZone={context.membership.organization.timezone}
      balance={balance}
      movements={itemMovements}
      hasMoreMovements={itemMovements.length === MOVEMENT_PAGE}
      prices={prices}
      lastCost={lastCostMap.get(item.id)?.lastCost ?? null}
      assetDetails={assetDetails}
      suppliers={suppliers.map((contact) => ({ id: contact.id, name: contact.name }))}
    />
  );
}
