import type { SupabaseClient } from "@supabase/supabase-js";

import { orderGrid, type GridProduct } from "@/lib/fair/grid-order";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";
import { AttachmentService } from "@/services/catalog/attachment-service";

/**
 * La venta directa del modo feria (KAM-12).
 *
 * Todo acceso a Supabase vive aquí (convención nº 1); el `SupabaseClient`
 * entra por inyección desde la capa de acciones.
 */

type ProductRow = {
  id: string;
  name: string;
  sale_price: number | string | null;
  business_line_id: string | null;
};

type BestSellerRow = {
  item_id: string;
  quantity_sold: number | string | null;
};

/** Un producto tal como lo pinta la cuadrícula. */
export type FairProduct = GridProduct & {
  businessLineId: string | null;
  /**
   * La miniatura firmada de su foto vigente —la más reciente—, o `null` sin
   * foto. Caduca a la hora: sin señal, la tarjeta usa la copia que guardó la
   * captura (design.md, decisión 2).
   */
  photoUrl: string | null;
  /** Qué foto es: la captura no vuelve a bajar una que ya tiene. */
  photoAttachmentId: string | null;
  /**
   * El nombre de la línea del producto, o `null` si es compartido. La tarjeta
   * lo muestra con «Venta rápida con todas las líneas» (`fair-all-lines`).
   */
  businessLineName: string | null;
};

/** El alcance de la cuadrícula (`fair-all-lines`, design.md decisión 2). */
export type SellableScope = {
  /** La bandera «Venta rápida con todas las líneas» de la organización. */
  allLines: boolean;
  /** Las líneas activas: con la bandera, las únicas cuyos productos se ofrecen. */
  lines: readonly { id: string; name: string }[];
};

export class FairSaleService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * El catálogo vendible de una línea, ya ordenado para la cuadrícula.
   *
   * Ofrece productos —no insumos ni activos— no archivados, con «Mostrar en
   * venta rápida» activado, de la línea activa **o compartidos**, y con precio
   * de venta definido: sin precio no se puede vender en dos toques, así que un
   * producto sin él no pinta nada aquí.
   *
   * Parte del catálogo y hace `left join` con `best_selling_products` en
   * memoria: ordenar desde la vista dejaría fuera cualquier producto recién
   * creado, que es justo el que más falta hace mostrar (design, decisión 4).
   *
   * Con `scope.allLines` (`fair-all-lines`), los productos son los de todas
   * las líneas **activas** —no las archivadas— y los compartidos, y el orden
   * es el de toda la organización: se suman las ventas de todas las líneas.
   */
  async listSellableProducts(
    organizationId: string,
    businessLineId: string,
    scope: SellableScope = { allLines: false, lines: [] },
  ): Promise<FairProduct[]> {
    const lineFilter = scope.allLines
      ? `business_line_id.in.(${scope.lines.map((line) => line.id).join(",")}),business_line_id.is.null`
      : `business_line_id.eq.${businessLineId},business_line_id.is.null`;

    const { data: products, error } = await this.supabase
      .from("items")
      .select("id, name, sale_price, business_line_id")
      // Convención nº 2: la organización, explícita, aunque RLS ya filtre.
      .eq("organization_id", organizationId)
      .eq("kind", "product")
      .eq("show_in_fair", true)
      .is("archived_at", null)
      .not("sale_price", "is", null)
      // De la línea activa —o de las activas, con la bandera— o compartido
      // (`business_line_id` nulo).
      .or(lineFilter);

    if (error) throw new Error(error.message);

    let sellersQuery = this.supabase
      .from("best_selling_products")
      .select("item_id, quantity_sold")
      .eq("organization_id", organizationId);
    // Sin la bandera, lo que se vende en ESTA línea. Con ella, en toda la
    // organización: las filas de cada línea se suman abajo por producto.
    if (!scope.allLines) sellersQuery = sellersQuery.eq("business_line_id", businessLineId);

    const { data: sellers, error: sellersError } = await sellersQuery;

    if (sellersError) throw new Error(sellersError.message);

    const sold = new Map<string, number>();
    for (const row of (sellers ?? []) as BestSellerRow[]) {
      sold.set(row.item_id, (sold.get(row.item_id) ?? 0) + Number(row.quantity_sold ?? 0));
    }

    const rows = (products ?? []) as ProductRow[];
    const photos = await this.currentPhotos(
      organizationId,
      rows.map((row) => row.id),
    );

    const lineNames = new Map(scope.lines.map((line) => [line.id, line.name]));

    const grid: FairProduct[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      salePrice: Number(row.sale_price ?? 0),
      businessLineId: row.business_line_id,
      quantitySold: sold.get(row.id) ?? 0,
      photoUrl: photos.get(row.id)?.url ?? null,
      photoAttachmentId: photos.get(row.id)?.attachmentId ?? null,
      businessLineName: row.business_line_id
        ? (lineNames.get(row.business_line_id) ?? null)
        : null,
    }));

    return orderGrid(grid) as FairProduct[];
  }

  /**
   * La foto vigente de cada producto —la más reciente, como en el catálogo—
   * con su miniatura firmada. Un solo lote de adjuntos y uno de firmas.
   */
  private async currentPhotos(
    organizationId: string,
    itemIds: string[],
  ): Promise<Map<string, { attachmentId: string; url: string | null }>> {
    const current = new Map<string, { attachmentId: string; url: string | null }>();
    if (itemIds.length === 0) return current;

    const attachments = new AttachmentService(this.supabase);
    const photos = await attachments.listForEntities(organizationId, "item", itemIds);
    // `listForEntities` entrega de la más nueva a la más vieja: la primera gana.
    const newest = photos.filter((photo) => {
      if (current.has(photo.entityId)) return false;
      current.set(photo.entityId, { attachmentId: photo.id, url: null });
      return true;
    });

    const signed = await attachments.signedThumbnailUrls(newest);
    for (const photo of newest) {
      current.set(photo.entityId, {
        attachmentId: photo.id,
        url: signed.get(photo.id) ?? null,
      });
    }
    return current;
  }

  /**
   * Registrar la venta con su cobro. Una sola llamada, una sola transacción
   * (design, decisión 2). La función de la base es idempotente por `id`, así
   * que reenviar esto desde la cola no crea una segunda venta.
   */
  async create(sale: DirectSaleInput): Promise<string> {
    const { sale: p_sale, items: p_items, payment: p_payment } = toRpcSale(sale);
    const { data, error } = await this.supabase.rpc("create_direct_sale", {
      p_sale,
      p_items,
      p_payment,
    });

    // El mensaje de la base ya está escrito para una persona; se envuelve para
    // que la acción pueda traducirlo.
    if (error) throw new Error(error.message);

    return (data as string | null) ?? sale.id;
  }

  /**
   * Registrar las ventas de un carrito con productos de varias líneas
   * (`fair-all-lines`, design.md decisión 5). Una sola llamada: la base las
   * guarda todas o ninguna, y reenviar el lote no crea nada de más.
   */
  async createMany(sales: readonly DirectSaleInput[]): Promise<string[]> {
    const { data, error } = await this.supabase.rpc("create_direct_sales", {
      p_sales: sales.map(toRpcSale),
    });

    if (error) throw new Error(error.message);

    return (data as string[] | null) ?? sales.map((sale) => sale.id);
  }
}

/** Una venta en la forma de los argumentos de `create_direct_sale`. */
function toRpcSale(sale: DirectSaleInput) {
  return {
    sale: {
      // Identificador generado en el cliente (convención nº 9).
      id: sale.id,
      organization_id: sale.organizationId,
      business_line_id: sale.businessLineId,
      contact_id: sale.contactId,
      sales_channel_id: sale.salesChannelId,
      // La hora real del hecho, no la de llegada.
      occurred_at: sale.occurredAt,
      notes: sale.notes,
    },
    items: sale.items.map((line) => ({
      id: line.id,
      item_id: line.itemId,
      variant_id: line.variantId,
      description: line.description,
      quantity: line.quantity,
      // El precio que se registró, no el que tenga el catálogo después.
      unit_price: line.unitPrice,
    })),
    payment: sale.payment
      ? {
          id: sale.payment.id,
          amount: sale.payment.amount,
          method: sale.payment.method,
          occurred_at: sale.occurredAt,
        }
      : null,
  };
}
