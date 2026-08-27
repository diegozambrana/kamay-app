import type { SupabaseClient } from "@supabase/supabase-js";

import type { Attachment, AttachmentEntityType } from "@/types";

type AttachmentRow = {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, entity_type, entity_id, bucket, storage_path, file_name, mime_type, size_bytes, created_at, archived_at";

/** Una hora: lo que dura una sesión de trabajo mirando un listado. */
const SIGNED_URL_TTL = 60 * 60;

export type NewAttachment = {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  bucket: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  body: ArrayBuffer | Blob;
};

/**
 * Acceso a `attachments` y a los buckets de Storage.
 *
 * Los buckets son privados: nada se muestra por URL pública, se firma cada
 * lectura. Es lo que evita que la foto de un cliente quede accesible a quien
 * adivine la ruta.
 */
export class AttachmentService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: AttachmentRow): Attachment {
    return {
      id: row.id,
      organizationId: row.organization_id,
      entityType: row.entity_type as AttachmentEntityType,
      entityId: row.entity_id,
      bucket: row.bucket,
      storagePath: row.storage_path,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
    };
  }

  /**
   * La ruta empieza siempre con el `organization_id` (esquema §13): es lo que
   * comprueba la política de Storage, así que la arma el servicio y no la
   * pantalla.
   */
  static storagePath(
    organizationId: string,
    entityType: AttachmentEntityType,
    entityId: string,
    attachmentId: string,
    fileName: string,
  ): string {
    const dot = fileName.lastIndexOf(".");
    const extension =
      dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    const suffix = extension === "" ? "" : `.${extension}`;
    return `${organizationId}/${entityType}/${entityId}/${attachmentId}${suffix}`;
  }

  /** Adjuntos vigentes de varios registros de una vez, del más nuevo al más viejo. */
  async listForEntities(
    organizationId: string,
    entityType: AttachmentEntityType,
    entityIds: string[],
  ): Promise<Attachment[]> {
    if (entityIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from("attachments")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("entity_type", entityType)
      .in("entity_id", entityIds)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .overrideTypes<AttachmentRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar los adjuntos: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as AttachmentRow));
  }

  /**
   * Sube el archivo y registra la fila. Si la fila falla, el objeto subido se
   * retira: un objeto sin fila es basura invisible que nadie volverá a mirar.
   */
  async upload(
    organizationId: string,
    userId: string,
    input: NewAttachment,
  ): Promise<Attachment> {
    const storagePath = AttachmentService.storagePath(
      organizationId,
      input.entityType,
      input.entityId,
      input.id,
      input.fileName,
    );

    const { error: uploadError } = await this.supabase.storage
      .from(input.bucket)
      .upload(storagePath, input.body, {
        contentType: input.mimeType ?? undefined,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);
    }

    const { data, error } = await this.supabase
      .from("attachments")
      .insert({
        id: input.id,
        organization_id: organizationId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        bucket: input.bucket,
        storage_path: storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        uploaded_by: userId,
      })
      .select(COLUMNS)
      .single()
      .overrideTypes<AttachmentRow>();

    if (error) {
      await this.supabase.storage.from(input.bucket).remove([storagePath]);
      throw new Error(`No se pudo registrar el adjunto: ${error.message}`);
    }

    return this.toEntity(data as AttachmentRow);
  }

  async setArchived(
    organizationId: string,
    id: string,
    archived: boolean,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("attachments")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo archivar el adjunto: ${error.message}`);
    }
  }

  /**
   * URLs firmadas para mostrar los adjuntos. Se piden en lote porque un
   * listado necesita todas las miniaturas a la vez y una petición por fila
   * sería una cascada.
   */
  async signedUrls(
    attachments: Attachment[],
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (attachments.length === 0) return urls;

    // Las firmas se piden por bucket: la API firma un bucket por llamada.
    const byBucket = new Map<string, Attachment[]>();
    for (const attachment of attachments) {
      const group = byBucket.get(attachment.bucket) ?? [];
      group.push(attachment);
      byBucket.set(attachment.bucket, group);
    }

    for (const [bucket, group] of byBucket) {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrls(
          group.map((attachment) => attachment.storagePath),
          SIGNED_URL_TTL,
        );

      // Una miniatura que no se puede firmar no debe tumbar el listado
      // entero: la fila se muestra sin imagen.
      if (error || !data) continue;

      for (const signed of data) {
        const match = group.find(
          (attachment) => attachment.storagePath === signed.path,
        );
        if (match && signed.signedUrl) urls.set(match.id, signed.signedUrl);
      }
    }

    return urls;
  }
}
