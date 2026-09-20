import type { SupabaseClient } from "@supabase/supabase-js";

import { AttachmentService } from "@/services/catalog/attachment-service";
import {
  generateOrderRequestToken,
  hashOrderRequestToken,
  orderRequestExpiry,
} from "@/lib/order-requests/token";
import { ORDER_REQUESTS_BUCKET, type OrderRequest } from "@/types";

type OrderRequestRow = {
  id: string;
  organization_id: string;
  business_line_id: string;
  contact_id: string | null;
  prefilled_name: string;
  prefilled_phone: string;
  declared_name: string | null;
  declared_phone: string | null;
  declared_note: string | null;
  expires_at: string;
  submitted_at: string | null;
  order_id: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

// Un solo literal, sin concatenar con `+`: concatenar ensancha el tipo a
// `string` y le quita a Supabase la firma literal que necesita para tipar
// `data` en el resto de la cadena (hallazgo — ver el resto de `services/`,
// donde ninguna `COLUMNS` se parte en más de una expresión).
const COLUMNS =
  "id, organization_id, business_line_id, contact_id, prefilled_name, prefilled_phone, declared_name, declared_phone, declared_note, expires_at, submitted_at, order_id, created_by, created_at, archived_at";

function toEntity(row: OrderRequestRow): OrderRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    businessLineId: row.business_line_id,
    contactId: row.contact_id,
    prefilledName: row.prefilled_name,
    prefilledPhone: row.prefilled_phone,
    declaredName: row.declared_name,
    declaredPhone: row.declared_phone,
    declaredNote: row.declared_note,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    orderId: row.order_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export type NewOrderRequest = {
  id: string;
  businessLineId: string;
  contactId: string | null;
  prefilledName: string;
  prefilledPhone: string;
  createdBy: string;
};

/** Una imagen de la cuarentena, lista para mostrarse en la bandeja. */
export type QuarantineImage = {
  path: string;
  name: string;
  signedUrl: string | null;
};

/**
 * Acceso a `order_requests` y a su cuarentena de imágenes (`order-requests`).
 *
 * Generar, regenerar, aceptar y descartar son escrituras normales de sesión
 * —`insert`/`update` gobernados por la política `is_member`—, igual que
 * `InvitationService`: no hay una función SQL por cada una. Las únicas dos
 * funciones `security definer` del cambio (`resolve_order_request`,
 * `submit_order_request`) son las que ocurren sin sesión, y viven en la
 * migración, no aquí (design.md — D9).
 */
export class OrderRequestService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** La bandeja: lo más reciente primero. */
  async list(organizationId: string): Promise<OrderRequest[]> {
    const { data, error } = await this.supabase
      .from("order_requests")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .overrideTypes<OrderRequestRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las solicitudes: ${error.message}`);
    }

    return (data ?? []).map((row) => toEntity(row as OrderRequestRow));
  }

  async get(organizationId: string, id: string): Promise<OrderRequest | null> {
    const { data, error } = await this.supabase
      .from("order_requests")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<OrderRequestRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar la solicitud: ${error.message}`);
    }

    return data ? toEntity(data as OrderRequestRow) : null;
  }

  /**
   * Genera la solicitud y devuelve el token **una sola vez**: en la base
   * queda su hash, así que este es el único momento en que se puede armar el
   * enlace (mismo patrón que `InvitationService.create()`).
   */
  async create(
    organizationId: string,
    input: NewOrderRequest,
  ): Promise<{ orderRequest: OrderRequest; token: string }> {
    const token = generateOrderRequestToken();

    const { data, error } = await this.supabase
      .from("order_requests")
      .insert({
        id: input.id,
        organization_id: organizationId,
        business_line_id: input.businessLineId,
        contact_id: input.contactId,
        prefilled_name: input.prefilledName,
        prefilled_phone: input.prefilledPhone,
        token_hash: hashOrderRequestToken(token),
        expires_at: orderRequestExpiry(),
        created_by: input.createdBy,
      })
      .select(COLUMNS)
      .single()
      .overrideTypes<OrderRequestRow>();

    if (error) {
      throw new Error(`No se pudo generar la solicitud: ${error.message}`);
    }

    return { orderRequest: toEntity(data as OrderRequestRow), token };
  }

  /**
   * Rota el token y la vigencia. Solo tiene efecto mientras la solicitud
   * sigue esperando al cliente — la base lo hace cumplir de todas formas
   * (`guard_order_request_updates`, design D9), y aquí se comprueba también
   * para dar un mensaje claro en vez de una fila que no cambió.
   */
  async regenerate(organizationId: string, id: string): Promise<string> {
    const token = generateOrderRequestToken();

    const { data, error } = await this.supabase
      .from("order_requests")
      .update({
        token_hash: hashOrderRequestToken(token),
        expires_at: orderRequestExpiry(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("submitted_at", null)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo regenerar el enlace: ${error.message}`);
    }
    if (!data) {
      throw new Error(
        "El enlace no se puede regenerar: la solicitud ya no está esperando al cliente.",
      );
    }

    return token;
  }

  /** Descartar archiva, nunca borra. */
  async discard(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("order_requests")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo descartar la solicitud: ${error.message}`);
    }
  }

  /** Las imágenes de la cuarentena de una solicitud, con su URL firmada. */
  async quarantineImages(
    organizationId: string,
    id: string,
  ): Promise<QuarantineImage[]> {
    const folder = `${organizationId}/${id}`;
    const { data, error } = await this.supabase.storage
      .from(ORDER_REQUESTS_BUCKET)
      .list(folder);

    if (error) {
      throw new Error(`No se pudieron cargar las imágenes: ${error.message}`);
    }

    const files = (data ?? []).filter((entry) => entry.id !== null);
    if (files.length === 0) return [];

    const paths = files.map((entry) => `${folder}/${entry.name}`);
    const { data: signed } = await this.supabase.storage
      .from(ORDER_REQUESTS_BUCKET)
      .createSignedUrls(paths, 60 * 60);

    return files.map((entry, index) => ({
      path: paths[index],
      name: entry.name,
      signedUrl: signed?.[index]?.signedUrl ?? null,
    }));
  }

  /**
   * Aceptar: copia (no mueve) cada imagen de la cuarentena a `attachments`
   * del pedido, y fija `order_id` solo al terminar (design D6). Reintentable:
   * `unique (bucket, storage_path)` hace que repetir una copia ya hecha no
   * duplique el adjunto, y `order_id` no se toca hasta que todas terminaron.
   *
   * El pedido ya existe — lo creó la acción de alta existente, sin tocarla
   * (spec `order-requests` — Requirement: Aceptar reutiliza el alta de
   * pedido existente y traslada las imágenes).
   */
  async accept(
    organizationId: string,
    id: string,
    orderId: string,
    userId: string,
  ): Promise<void> {
    const images = await this.quarantineImages(organizationId, id);

    for (const image of images) {
      const attachmentId = crypto.randomUUID();
      const destinationPath = AttachmentService.storagePath(
        organizationId,
        "order",
        orderId,
        attachmentId,
        image.name,
      );

      const { error: copyError } = await this.supabase.storage
        .from(ORDER_REQUESTS_BUCKET)
        .copy(image.path, destinationPath, { destinationBucket: "attachments" });

      // Un objeto que ya se copió en un intento anterior no es un error: es
      // justo lo que hace reintentable este paso.
      if (copyError && !/exists|duplicate/i.test(copyError.message)) {
        throw new Error(`No se pudo copiar una imagen: ${copyError.message}`);
      }

      const { error: insertError } = await this.supabase
        .from("attachments")
        .insert({
          id: attachmentId,
          organization_id: organizationId,
          entity_type: "order",
          entity_id: orderId,
          bucket: "attachments",
          storage_path: destinationPath,
          file_name: image.name,
          uploaded_by: userId,
        });

      // `unique (bucket, storage_path)` — 23505 — es el mismo reintento.
      if (insertError && insertError.code !== "23505") {
        throw new Error(`No se pudo registrar un adjunto: ${insertError.message}`);
      }
    }

    const { error } = await this.supabase
      .from("order_requests")
      .update({ order_id: orderId })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo vincular el pedido a la solicitud: ${error.message}`);
    }
  }
}
