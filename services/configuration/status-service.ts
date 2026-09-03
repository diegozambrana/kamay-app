import type { SupabaseClient } from "@supabase/supabase-js";

import { defaultSetAsJson } from "@/lib/statuses/default-sets";
import type { LineColor, Status, StatusFlow, StatusKind } from "@/types";

type StatusRow = {
  id: string;
  organization_id: string;
  business_line_id: string | null;
  flow: string;
  name: string;
  kind: string;
  color: string;
  position: number;
  is_queue: boolean;
  archived_at: string | null;
};

export type StatusInput = {
  name: string;
  kind: StatusKind;
  color: LineColor;
  isQueue: boolean;
};

const COLUMNS =
  "id, organization_id, business_line_id, flow, name, kind, color, position, is_queue, archived_at";

/**
 * Acceso a `statuses`. La resolución del juego vigente vive en la base
 * (`resolve_statuses`), igual que el archivado con reasignación, el restaurar
 * y el volver al juego de la organización: aquí solo se invocan.
 */
export class StatusService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: StatusRow): Status {
    return {
      id: row.id,
      organizationId: row.organization_id,
      businessLineId: row.business_line_id,
      flow: row.flow as StatusFlow,
      name: row.name,
      kind: row.kind as StatusKind,
      color: row.color as LineColor,
      position: row.position,
      isQueue: row.is_queue,
      archivedAt: row.archived_at,
    };
  }

  /**
   * El juego vigente para una línea: el propio completo, o el de la
   * organización. Única vía de lectura para tableros y formularios; la regla
   * no se reimplementa en TypeScript.
   */
  async resolve(
    organizationId: string,
    businessLineId: string | null,
    flow: StatusFlow,
  ): Promise<Status[]> {
    const { data, error } = await this.supabase.rpc("resolve_statuses", {
      org: organizationId,
      line: businessLineId,
      p_flow: flow,
    });

    if (error) {
      throw new Error(`No se pudo resolver el juego de estados: ${error.message}`);
    }

    return ((data ?? []) as StatusRow[]).map((row) => this.toEntity(row));
  }

  /**
   * Todos los estados de un flujo en la organización, sin resolver alcance y
   * sin ocultar lo archivado. Es lo que necesita el tablero para saber el
   * `kind` y el nombre del estado de cada pedido cuando la línea activa es
   * "Todas" —o cuando un pedido antiguo quedó en un estado ya archivado—,
   * sin disparar una resolución por línea.
   */
  async listAllForFlow(
    organizationId: string,
    flow: StatusFlow,
  ): Promise<Status[]> {
    const { data, error } = await this.supabase
      .from("statuses")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("flow", flow)
      .order("position");

    if (error) {
      throw new Error(`No se pudieron cargar los estados: ${error.message}`);
    }

    return ((data ?? []) as StatusRow[]).map((row) => this.toEntity(row));
  }

  /**
   * Lectura administrativa de V22: exactamente el juego del alcance pedido
   * (organización o línea), sin resolución y sin ocultar lo archivado.
   */
  async listForScope(
    organizationId: string,
    businessLineId: string | null,
    flow: StatusFlow,
  ): Promise<Status[]> {
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    let query = this.supabase
      .from("statuses")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("flow", flow);

    query =
      businessLineId === null
        ? query.is("business_line_id", null)
        : query.eq("business_line_id", businessLineId);

    const { data, error } = await query
      .order("position", { ascending: true })
      .overrideTypes<StatusRow[]>();

    if (error) {
      throw new Error(`No se pudo cargar el juego de estados: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as StatusRow));
  }

  async create(
    organizationId: string,
    businessLineId: string | null,
    flow: StatusFlow,
    input: StatusInput,
  ): Promise<Status> {
    // Un estado nuevo va al final de su juego.
    const existing = await this.listForScope(organizationId, businessLineId, flow);
    const position =
      existing.reduce((max, status) => Math.max(max, status.position), 0) + 1;

    const { data, error } = await this.supabase
      .from("statuses")
      .insert({
        organization_id: organizationId,
        business_line_id: businessLineId,
        flow,
        name: input.name,
        kind: input.kind,
        color: input.color,
        is_queue: input.isQueue,
        position,
      })
      .select(COLUMNS)
      .single()
      .overrideTypes<StatusRow>();

    if (error) {
      throw new Error(`No se pudo crear el estado: ${error.message}`);
    }

    return this.toEntity(data as StatusRow);
  }

  async update(
    organizationId: string,
    id: string,
    input: StatusInput,
  ): Promise<Status> {
    const { data, error } = await this.supabase
      .from("statuses")
      .update({
        name: input.name,
        kind: input.kind,
        color: input.color,
        is_queue: input.isQueue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select(COLUMNS)
      .single()
      .overrideTypes<StatusRow>();

    if (error) {
      throw new Error(`No se pudo actualizar el estado: ${error.message}`);
    }

    return this.toEntity(data as StatusRow);
  }

  /** Persiste el orden del arrastre: la posición es el lugar en la lista. */
  async reorder(organizationId: string, orderedIds: string[]): Promise<void> {
    for (const [index, id] of orderedIds.entries()) {
      const { error } = await this.supabase
        .from("statuses")
        .update({ position: index + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organizationId);

      if (error) {
        throw new Error(`No se pudo reordenar el juego: ${error.message}`);
      }
    }
  }

  /**
   * Archiva vía `archive_status()`: la base reasigna los registros que lo
   * usaban (ninguno queda huérfano) y exige destino cuando hace falta.
   */
  async archive(id: string, moveToId: string | null): Promise<void> {
    const { error } = await this.supabase.rpc("archive_status", {
      p_status_id: id,
      p_move_to: moveToId,
    });

    if (error) {
      throw new Error(`No se pudo archivar el estado: ${error.message}`);
    }
  }

  /** Aplica el juego por defecto del flujo, en una sola transacción. */
  async restoreDefaults(
    organizationId: string,
    businessLineId: string | null,
    flow: StatusFlow,
  ): Promise<void> {
    const { error } = await this.supabase.rpc("restore_default_statuses", {
      p_org: organizationId,
      p_line: businessLineId,
      p_flow: flow,
      p_defaults: defaultSetAsJson(flow),
    });

    if (error) {
      throw new Error(
        `No se pudo restaurar el juego por defecto: ${error.message}`,
      );
    }
  }

  /**
   * Crea el juego propio de una línea copiando el de la organización (o el
   * juego por defecto del flujo si la organización no tiene). Va por
   * `restore_default_statuses` porque un juego no puede nacer estado por
   * estado: la integridad exige inicial y final en una sola transacción.
   */
  async createOwnSet(
    organizationId: string,
    businessLineId: string,
    flow: StatusFlow,
  ): Promise<void> {
    const orgSet = (
      await this.listForScope(organizationId, null, flow)
    ).filter((status) => status.archivedAt === null);

    const template =
      orgSet.length > 0
        ? orgSet.map((status) => ({
            name: status.name,
            kind: status.kind,
            color: status.color,
            is_queue: status.isQueue,
            position: status.position,
          }))
        : defaultSetAsJson(flow);

    const { error } = await this.supabase.rpc("restore_default_statuses", {
      p_org: organizationId,
      p_line: businessLineId,
      p_flow: flow,
      p_defaults: template,
    });

    if (error) {
      throw new Error(`No se pudo crear el juego propio: ${error.message}`);
    }
  }

  /** Archiva el juego propio de la línea: vuelve a regir el de la organización. */
  async useOrganizationSet(
    organizationId: string,
    businessLineId: string,
    flow: StatusFlow,
  ): Promise<void> {
    const { error } = await this.supabase.rpc("use_organization_statuses", {
      p_org: organizationId,
      p_line: businessLineId,
      p_flow: flow,
    });

    if (error) {
      throw new Error(
        `No se pudo volver al juego de la organización: ${error.message}`,
      );
    }
  }
}
