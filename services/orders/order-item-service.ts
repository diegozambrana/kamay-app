import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrderItem } from "@/types";

type OrderItemRow = {
  id: string;
  organization_id: string;
  order_id: string;
  item_id: string | null;
  variant_id: string | null;
  description: string | null;
  quantity: number | string;
  unit_price: number | string;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, order_id, item_id, variant_id, description, quantity, unit_price, archived_at";

/** Una línea con lo que el detalle necesita mostrar sin más consultas. */
export type OrderItemWithNames = OrderItem & {
  itemName: string | null;
  variantName: string | null;
  /** `quantity * unitPrice`. Derivado al vuelo; nunca se guarda. */
  lineTotal: number;
};

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Acceso a `order_items`. El precio de la línea es el que se registró: este
 * servicio nunca lo relee del catálogo, porque un cambio de precio no puede
 * reescribir la historia (esquema §2).
 *
 * Todas las lecturas excluyen las líneas archivadas: quitar una línea al
 * editar el pedido la archiva en vez de borrarla (convención nº 3), y una
 * línea archivada no debe aparecer ni en el detalle ni en el resumen de la
 * tarjeta ni sumar al total.
 */
export class OrderItemService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByOrder(
    organizationId: string,
    orderId: string,
  ): Promise<OrderItemWithNames[]> {
    const { data, error } = await this.supabase
      .from("order_items")
      // El nombre del ítem y de la variante se traen resueltos para que el
      // detalle no dispare una consulta por línea.
      .select(`${COLUMNS}, items(name), item_variants(name)`)
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      // Quitar una línea al editar la archiva (KAM-08): sigue existiendo con
      // su historia, pero ni se muestra ni suma al total.
      .is("archived_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`No se pudieron cargar las líneas: ${error.message}`);
    }

    return (data ?? []).map((raw) => {
      const row = raw as unknown as OrderItemRow & {
        items: { name: string } | null;
        item_variants: { name: string } | null;
      };

      const quantity = toNumber(row.quantity);
      const unitPrice = toNumber(row.unit_price);

      return {
        id: row.id,
        organizationId: row.organization_id,
        orderId: row.order_id,
        itemId: row.item_id,
        variantId: row.variant_id,
        description: row.description,
        quantity,
        unitPrice,
        archivedAt: row.archived_at,
        itemName: row.items?.name ?? null,
        variantName: row.item_variants?.name ?? null,
        lineTotal: quantity * unitPrice,
      };
    });
  }

  /**
   * Un resumen corto de las líneas de varios pedidos, en una sola consulta:
   * es lo que la tarjeta del tablero muestra bajo el cliente. Evita encadenar
   * una petición por tarjeta.
   */
  async summariesFor(
    organizationId: string,
    orderIds: string[],
  ): Promise<Map<string, string>> {
    if (orderIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from("order_items")
      .select("order_id, description, quantity, items(name)")
      .eq("organization_id", organizationId)
      .in("order_id", orderIds)
      .is("archived_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`No se pudieron cargar las líneas: ${error.message}`);
    }

    const parts = new Map<string, string[]>();

    for (const raw of data ?? []) {
      const row = raw as unknown as {
        order_id: string;
        description: string | null;
        quantity: number | string;
        items: { name: string } | null;
      };

      // El nombre del ítem si lo hay; si es una línea libre, su descripción.
      const label = row.items?.name ?? row.description ?? "Sin detalle";
      const quantity = toNumber(row.quantity);
      const current = parts.get(row.order_id) ?? [];
      current.push(`${quantity} × ${label}`);
      parts.set(row.order_id, current);
    }

    const summaries = new Map<string, string>();
    for (const [orderId, list] of parts) {
      // Dos líneas caben en una tarjeta; el resto se resume.
      summaries.set(
        orderId,
        list.length <= 2
          ? list.join(", ")
          : `${list.slice(0, 2).join(", ")} y ${list.length - 2} más`,
      );
    }
    return summaries;
  }
}
