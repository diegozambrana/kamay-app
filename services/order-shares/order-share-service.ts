import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateOrderShareToken,
  hashOrderShareToken,
  orderShareExpiry,
} from "@/lib/order-shares/token";
import type { OrderComment, OrderShare } from "@/types";

type OrderShareRow = {
  id: string;
  organization_id: string;
  order_id: string;
  expires_at: string;
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

type OrderCommentRow = {
  id: string;
  organization_id: string;
  order_id: string;
  author_name: string;
  body: string;
  occurred_at: string;
  archived_at: string | null;
};

const SHARE_COLUMNS =
  "id, organization_id, order_id, expires_at, created_by, created_at, archived_at";
const COMMENT_COLUMNS =
  "id, organization_id, order_id, author_name, body, occurred_at, archived_at";

function toShare(row: OrderShareRow): OrderShare {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

function toComment(row: OrderCommentRow): OrderComment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    authorName: row.author_name,
    body: row.body,
    occurredAt: row.occurred_at,
    archivedAt: row.archived_at,
  };
}

/**
 * Acceso a `order_shares` y `order_comments`.
 *
 * Generar, regenerar y revocar son escrituras normales de sesión —igual que
 * `OrderRequestService` de KAM-28—: no hay una función SQL para cada una
 * (design D5 de `public-order-share`). El único enlace vigente por pedido lo
 * garantiza el índice único parcial de la base; aquí solo se traduce su
 * rechazo a un mensaje entendible.
 */
export class OrderShareService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** El enlace vigente de un pedido, si existe. */
  async getActive(organizationId: string, orderId: string): Promise<OrderShare | null> {
    const { data, error } = await this.supabase
      .from("order_shares")
      .select(SHARE_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      .is("archived_at", null)
      .maybeSingle()
      .overrideTypes<OrderShareRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar el enlace: ${error.message}`);
    }

    return data ? toShare(data as OrderShareRow) : null;
  }

  /**
   * Genera el enlace y devuelve el token en claro **una sola vez** (mismo
   * patrón que `InvitationService.create()` y `OrderRequestService.create()`):
   * en la base solo queda su hash.
   */
  async create(
    organizationId: string,
    input: { orderId: string; createdBy: string },
  ): Promise<{ share: OrderShare; token: string }> {
    const token = generateOrderShareToken();

    const { data, error } = await this.supabase
      .from("order_shares")
      .insert({
        organization_id: organizationId,
        order_id: input.orderId,
        token_hash: hashOrderShareToken(token),
        expires_at: orderShareExpiry(),
        created_by: input.createdBy,
      })
      .select(SHARE_COLUMNS)
      .single()
      .overrideTypes<OrderShareRow>();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Este pedido ya tiene un enlace vigente.");
      }
      throw new Error(`No se pudo generar el enlace: ${error.message}`);
    }

    return { share: toShare(data as OrderShareRow), token };
  }

  /** Rota el token. Solo tiene efecto mientras el enlace no esté revocado. */
  async regenerate(organizationId: string, id: string): Promise<string> {
    const token = generateOrderShareToken();

    const { data, error } = await this.supabase
      .from("order_shares")
      .update({
        token_hash: hashOrderShareToken(token),
        expires_at: orderShareExpiry(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo regenerar el enlace: ${error.message}`);
    }
    if (!data) {
      throw new Error("El enlace ya no está vigente.");
    }

    return token;
  }

  /** Revocar es archivar: corta el acceso de inmediato, nunca borra la fila. */
  async revoke(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("order_shares")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo revocar el enlace: ${error.message}`);
    }
  }

  /** Los comentarios vigentes de un pedido, del más reciente al más viejo. */
  async listComments(organizationId: string, orderId: string): Promise<OrderComment[]> {
    const { data, error } = await this.supabase
      .from("order_comments")
      .select(COMMENT_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .overrideTypes<OrderCommentRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar los comentarios: ${error.message}`);
    }

    return (data ?? []).map((row) => toComment(row as OrderCommentRow));
  }

  /** La organización archiva un comentario; nunca lo borra ni lo edita. */
  async archiveComment(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("order_comments")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo archivar el comentario: ${error.message}`);
    }
  }
}
