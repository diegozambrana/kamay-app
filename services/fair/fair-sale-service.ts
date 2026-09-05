import type { SupabaseClient } from "@supabase/supabase-js";

import { orderGrid, type GridProduct } from "@/lib/fair/grid-order";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";

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
};

export class FairSaleService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * El catálogo vendible de una línea, ya ordenado para la cuadrícula.
   *
   * Ofrece productos —no insumos ni activos— no archivados, de la línea activa
   * **o compartidos**, y con precio de venta definido: sin precio no se puede
   * vender en dos toques, así que un producto sin él no pinta nada aquí.
   *
   * Parte del catálogo y hace `left join` con `best_selling_products` en
   * memoria: ordenar desde la vista dejaría fuera cualquier producto recién
   * creado, que es justo el que más falta hace mostrar (design, decisión 4).
   */
  async listSellableProducts(
    organizationId: string,
    businessLineId: string,
  ): Promise<FairProduct[]> {
    const { data: products, error } = await this.supabase
      .from("items")
      .select("id, name, sale_price, business_line_id")
      // Convención nº 2: la organización, explícita, aunque RLS ya filtre.
      .eq("organization_id", organizationId)
      .eq("kind", "product")
      .is("archived_at", null)
      .not("sale_price", "is", null)
      // De la línea activa o compartido (`business_line_id` nulo).
      .or(`business_line_id.eq.${businessLineId},business_line_id.is.null`);

    if (error) throw new Error(error.message);

    const { data: sellers, error: sellersError } = await this.supabase
      .from("best_selling_products")
      .select("item_id, quantity_sold")
      .eq("organization_id", organizationId)
      .eq("business_line_id", businessLineId);

    if (sellersError) throw new Error(sellersError.message);

    const sold = new Map<string, number>();
    for (const row of (sellers ?? []) as BestSellerRow[]) {
      sold.set(row.item_id, (sold.get(row.item_id) ?? 0) + Number(row.quantity_sold ?? 0));
    }

    const grid: FairProduct[] = ((products ?? []) as ProductRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      salePrice: Number(row.sale_price ?? 0),
      businessLineId: row.business_line_id,
      quantitySold: sold.get(row.id) ?? 0,
    }));

    return orderGrid(grid) as FairProduct[];
  }

  /**
   * Registrar la venta con su cobro. Una sola llamada, una sola transacción
   * (design, decisión 2). La función de la base es idempotente por `id`, así
   * que reenviar esto desde la cola no crea una segunda venta.
   */
  async create(sale: DirectSaleInput): Promise<string> {
    const { data, error } = await this.supabase.rpc("create_direct_sale", {
      p_sale: {
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
      p_items: sale.items.map((line) => ({
        id: line.id,
        item_id: line.itemId,
        variant_id: line.variantId,
        description: line.description,
        quantity: line.quantity,
        // El precio que se registró, no el que tenga el catálogo después.
        unit_price: line.unitPrice,
      })),
      p_payment: sale.payment
        ? {
            id: sale.payment.id,
            amount: sale.payment.amount,
            method: sale.payment.method,
            occurred_at: sale.occurredAt,
          }
        : null,
    });

    // El mensaje de la base ya está escrito para una persona; se envuelve para
    // que la acción pueda traducirlo.
    if (error) throw new Error(error.message);

    return (data as string | null) ?? sale.id;
  }
}
