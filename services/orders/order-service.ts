import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrderFormValues, OrderLineValues } from "@/lib/orders/schema";
import type {
  ActivityEntry,
  DeliveryMode,
  Order,
  OrderKind,
} from "@/types";

/**
 * Una línea como la esperan `create_order` y `update_order`: nombres de
 * columna, porque el jsonb entra directo en el `insert` de la base.
 */
function toItemPayload(line: OrderLineValues) {
  return {
    id: line.id,
    item_id: line.itemId,
    variant_id: line.variantId,
    description: line.description,
    quantity: line.quantity,
    // El precio que se registró. El catálogo puede cambiar después y esta
    // línea no se entera (esquema §2).
    unit_price: line.unitPrice,
  };
}

type OrderRow = {
  id: string;
  organization_id: string;
  business_line_id: string;
  kind: string;
  code: number;
  contact_id: string | null;
  status_id: string;
  sales_channel_id: string | null;
  delivery_mode: string | null;
  due_date: string | null;
  occurred_at: string;
  queued_at: string | null;
  notes: string | null;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, business_line_id, kind, code, contact_id, status_id, " +
  "sales_channel_id, delivery_mode, due_date, occurred_at, queued_at, notes, archived_at";

export type OrderFilters = {
  businessLineId?: string | null;
  statusId?: string;
  /** Busca por número de pedido o por nombre del cliente. */
  search?: string;
  includeArchived?: boolean;
};

type OrderTotals = { total: number; paid: number };

/** Un pedido fuera de la vista —archivado— no tiene total ni cobrado. */
const NO_MONEY: OrderTotals = { total: 0, paid: 0 };

/**
 * Un pedido con el total y lo cobrado que trae la vista, nunca columnas de la
 * tabla. El saldo no viaja: se deriva al leer con `lib/payments/balance.ts`.
 */
export type OrderWithTotal = Order & { total: number; paid: number };

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Acceso a `orders`. Ninguna consulta a Supabase vive fuera de aquí, y todas
 * filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2).
 *
 * Dos reglas las decide la base y este servicio solo las pide: quién puede
 * archivar (`enforce_archive_rules`) y cuándo se fija `queued_at` (el trigger
 * de la cola). El total viene de `order_totals` y jamás de una columna.
 */
export class OrderService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: OrderRow): Order {
    return {
      id: row.id,
      organizationId: row.organization_id,
      businessLineId: row.business_line_id,
      kind: row.kind as OrderKind,
      code: row.code,
      contactId: row.contact_id,
      statusId: row.status_id,
      salesChannelId: row.sales_channel_id,
      deliveryMode: row.delivery_mode as DeliveryMode | null,
      dueDate: row.due_date,
      occurredAt: row.occurred_at,
      queuedAt: row.queued_at,
      notes: row.notes,
      archivedAt: row.archived_at,
    };
  }

  /**
   * Total y cobrado de un conjunto de pedidos, en una sola consulta a la
   * vista. Un pedido ausente de la vista (archivado) cuenta como 0.
   *
   * `paid` viaja aquí y no en una consulta aparte para que la señal de pago
   * de la tarjeta no cueste una consulta por tarjeta (KAM-10).
   */
  private async totalsFor(orderIds: string[]): Promise<Map<string, OrderTotals>> {
    if (orderIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from("order_totals")
      .select("order_id, total, paid")
      .in("order_id", orderIds);

    if (error) {
      throw new Error(`No se pudieron calcular los totales: ${error.message}`);
    }

    const totals = new Map<string, OrderTotals>();
    for (const row of (data ?? []) as {
      order_id: string;
      total: number | string;
      paid: number | string;
    }[]) {
      totals.set(row.order_id, { total: toNumber(row.total), paid: toNumber(row.paid) });
    }
    return totals;
  }

  async list(
    organizationId: string,
    filters: OrderFilters = {},
  ): Promise<OrderWithTotal[]> {
    let query = this.supabase
      .from("orders")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      // Invariante del tablero: SOLO pedidos. La venta directa tiene su
      // propio flujo (V6) y no recorre ningún ciclo de producción, así que no
      // aparece en ninguna de las tres vistas —tablero, lista y calendario—
      // ni siquiera con «Ver archivados» activado, porque este filtro no
      // depende de ningún filtro que el usuario pueda desactivar.
      //
      // Quitar esta línea llena el tablero de ventas de feria. Hay pruebas
      // que fallan si desaparece, a propósito.
      .eq("kind", "order");

    if (filters.businessLineId) {
      query = query.eq("business_line_id", filters.businessLineId);
    }
    if (filters.statusId) query = query.eq("status_id", filters.statusId);

    // Lo archivado no aparece salvo que se pida: es la regla de todo listado.
    if (!filters.includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query.order("occurred_at", { ascending: false });

    if (error) {
      throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);
    }

    const orders = (data ?? []).map((row) => this.toEntity(row as unknown as OrderRow));
    const totals = await this.totalsFor(orders.map((order) => order.id));

    return orders.map((order) => ({
      ...order,
      ...(totals.get(order.id) ?? NO_MONEY),
    }));
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<OrderWithTotal | null> {
    const { data, error } = await this.supabase
      .from("orders")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo cargar el pedido: ${error.message}`);
    }
    if (!data) return null;

    const order = this.toEntity(data as unknown as OrderRow);
    const totals = await this.totalsFor([order.id]);

    return { ...order, ...(totals.get(order.id) ?? NO_MONEY) };
  }

  /**
   * Alta del pedido (V5). Una sola llamada: `create_order` inserta el pedido
   * y todas sus líneas en la misma transacción y resuelve el estado inicial
   * desde el juego de la línea (design.md D1 y D3).
   *
   * Por eso aquí no se envía `status_id` —ni existe en el formulario—: si el
   * alta fuera dos inserciones encadenadas, un fallo a mitad dejaría un
   * pedido sin líneas que nadie podría borrar.
   */
  async create(
    organizationId: string,
    values: OrderFormValues,
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc("create_order", {
      p_order: {
        // Identificador generado en el cliente (convención nº 9).
        id: values.id,
        organization_id: organizationId,
        business_line_id: values.businessLineId,
        contact_id: values.contactId,
        sales_channel_id: values.salesChannelId,
        delivery_mode: values.deliveryMode,
        due_date: values.dueDate,
        occurred_at: values.occurredAt,
        notes: values.notes,
      },
      p_items: values.items.map(toItemPayload),
    });

    // El mensaje de la base ya está escrito para una persona; se envuelve en
    // un `Error` para que la acción pueda traducirlo.
    if (error) throw new Error(error.message);

    return (data as string | null) ?? values.id;
  }

  /**
   * Edición del pedido y de sus líneas, también en una sola transacción.
   *
   * `p_items` es la lista completa de líneas vigentes, no un diferencial: lo
   * que no viaje se archiva (design.md D2). Ni la línea de negocio ni el
   * estado se envían — cambiar la línea cambiaría el flujo del pedido, y el
   * estado tiene su propia vía.
   */
  async update(organizationId: string, values: OrderFormValues): Promise<void> {
    const { error } = await this.supabase.rpc("update_order", {
      p_order: {
        id: values.id,
        organization_id: organizationId,
        contact_id: values.contactId,
        sales_channel_id: values.salesChannelId,
        delivery_mode: values.deliveryMode,
        due_date: values.dueDate,
        notes: values.notes,
      },
      p_items: values.items.map(toItemPayload),
    });

    if (error) throw new Error(error.message);
  }

  /**
   * Cambia el estado. `queued_at` lo ajusta el trigger de la base según el
   * `is_queue` del destino: no se toca desde aquí, para que el tablero, el
   * detalle y el formulario no puedan divergir.
   */
  async moveToStatus(
    organizationId: string,
    id: string,
    statusId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("orders")
      .update({ status_id: statusId, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo mover el pedido: ${error.message}`);
    }
  }

  /**
   * Reescribe la llegada de un pedido a la cola. Es la única escritura
   * directa de `queued_at`; el trigger no la pisa porque solo actúa cuando
   * cambia `status_id` (design.md D4).
   */
  async setQueuedAt(
    organizationId: string,
    id: string,
    queuedAt: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("orders")
      .update({ queued_at: queuedAt, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo reordenar la cola: ${error.message}`);
    }
  }

  /** Reescribe varias llegadas de una vez, al renormalizar la columna. */
  async setManyQueuedAt(
    organizationId: string,
    entries: ReadonlyMap<string, string>,
  ): Promise<void> {
    for (const [id, queuedAt] of entries) {
      await this.setQueuedAt(organizationId, id, queuedAt);
    }
  }

  /**
   * Archivar y desarchivar. Quién puede hacerlo lo decide el trigger
   * `enforce_archive_rules`: aquí solo se pide, y el error de la base sube
   * tal cual para que la acción lo traduzca.
   */
  async setArchived(
    organizationId: string,
    id: string,
    archived: boolean,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("orders")
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) throw error;
  }

  /**
   * El historial del pedido. Un solo historial (convención nº 7): todo lo que
   * muestre "qué pasó aquí" lee de `activity_log` y de ninguna otra fuente.
   * La bitácora solo es legible por el dueño; para el ayudante devuelve vacío
   * por RLS.
   */
  async history(organizationId: string, id: string): Promise<ActivityEntry[]> {
    const { data, error } = await this.supabase
      .from("activity_log")
      .select("id, action, actor_id, actor_label, changes, occurred_at")
      .eq("organization_id", organizationId)
      .eq("table_name", "orders")
      .eq("record_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`No se pudo cargar el historial: ${error.message}`);
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as number,
      action: row.action as ActivityEntry["action"],
      actorId: (row.actor_id as string | null) ?? null,
      actorLabel: (row.actor_label as string | null) ?? null,
      changes: (row.changes as Record<string, unknown> | null) ?? null,
      occurredAt: row.occurred_at as string,
    }));
  }
}
