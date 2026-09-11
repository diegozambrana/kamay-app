import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RETENTION_KEY,
  type RetentionSettingsInput,
  readRetentionMonths,
  retentionCutoff,
  retentionMonthsSchema,
} from "@/lib/activity/retention";
import { toCsv } from "@/lib/reports/csv";

/**
 * La política de retención de una organización: leerla y guardarla.
 *
 * Se valida también aquí y no solo en la acción: un servicio que confía en que
 * alguien más validó es un servicio que se puede llamar mal desde el siguiente
 * punto de entrada que se escriba.
 */
export class RetentionPolicyService {
  constructor(private readonly supabase: SupabaseClient) {}

  async get(organizationId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: unknown }>();

    if (error) {
      throw new Error(
        `No se pudo cargar la política de retención: ${error.message}`,
      );
    }

    return readRetentionMonths(data?.settings);
  }

  /**
   * Guarda **fusionando** dentro de `settings`, nunca reemplazándolo: ese
   * `jsonb` lo comparten la regla de reparto de KAM-20 y las preferencias, y
   * un `update` que lo sustituyera entero borraría en silencio lo de al lado.
   */
  async save(
    organizationId: string,
    input: RetentionSettingsInput,
  ): Promise<number> {
    const months = retentionMonthsSchema.parse(input.months);

    const { data: current, error: readError } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: Record<string, unknown> | null }>();

    if (readError) {
      throw new Error(
        `No se pudo cargar la configuración: ${readError.message}`,
      );
    }

    const settings = {
      ...(current?.settings ?? {}),
      [RETENTION_KEY]: { months },
    };

    const { error } = await this.supabase
      .from("organizations")
      .update({ settings, updated_at: new Date().toISOString() })
      .eq("id", organizationId);

    if (error) {
      throw new Error(
        `No se pudo guardar la política de retención: ${error.message}`,
      );
    }

    return months;
  }
}

/** El bucket privado que solo el service role lee y escribe (design D8). */
export const EXPORTS_BUCKET = "activity-exports";

export type RetentionRun = {
  /** Cuántos eventos entraron en la exportación. */
  exported: number;
  /** Cuántos quedaron sin detalle. Igual a `exported` si todo fue bien. */
  purged: number;
  /** Dónde quedó el archivo, o `null` si no hubo nada que exportar. */
  exportPath: string | null;
  cutoff: string;
  months: number;
};

/** Lo que se lee de cada evento vencido para poder exportarlo. */
type ExpiredRow = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_label: string | null;
  table_name: string;
  record_id: string;
  action: string;
  origin: string | null;
  changes: unknown;
};

/**
 * La retención: exportar, **verificar** y solo entonces vaciar.
 *
 * Corre con el cliente de service role, en un trabajo programado y jamás en
 * una acción disparada por una persona (convención nº 2). El vaciado propio lo
 * hace `purge_activity_detail()`, con `execute` revocado a `authenticated`:
 * partirlo así es lo que convierte «ningún usuario puede vaciar un evento» en
 * una regla del esquema comprobable por pgTAP, en vez de una promesa del
 * código que la llama (design D7).
 *
 * **El orden es el requisito.** Si la exportación no se escribe, o se escribe
 * y no supera la verificación, la función retorna sin haber llamado nunca a la
 * purga, y la bitácora queda exactamente como estaba.
 */
export class RetentionService {
  constructor(private readonly supabase: SupabaseClient) {}

  async run(
    organizationId: string,
    options: { now?: Date } = {},
  ): Promise<RetentionRun> {
    const months = await new RetentionPolicyService(this.supabase).get(
      organizationId,
    );
    const cutoff = retentionCutoff(months, options.now);

    const expired = await this.expired(organizationId, cutoff);

    // Nada que hacer no es un caso especial: es el estado normal de una
    // organización joven, y no debe producir un archivo vacío en Storage.
    if (expired.length === 0) {
      return { exported: 0, purged: 0, exportPath: null, cutoff, months };
    }

    const exportPath = await this.export(organizationId, cutoff, expired);
    await this.verify(exportPath, expired.length);

    const purged = await this.purge(organizationId, cutoff);

    return { exported: expired.length, purged, exportPath, cutoff, months };
  }

  /** Los eventos vencidos que todavía conservan detalle. */
  private async expired(
    organizationId: string,
    cutoff: string,
  ): Promise<ExpiredRow[]> {
    const { data, error } = await this.supabase
      .from("activity_log")
      .select(
        "id, occurred_at, actor_id, actor_label, table_name, record_id, action, origin, changes",
      )
      .eq("organization_id", organizationId)
      .lt("occurred_at", cutoff)
      .not("changes", "is", null)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      throw new Error(
        `No se pudieron leer los eventos vencidos: ${error.message}`,
      );
    }

    return (data ?? []) as unknown as ExpiredRow[];
  }

  /**
   * El volcado, con el detalle **en crudo**.
   *
   * Aquí sí va el `changes` tal cual, al revés que en la exportación que el
   * dueño descarga desde V23: esto es el respaldo de lo que se va a soltar, y
   * lo que hay que poder reconstruir es el dato, no una frase.
   */
  private async export(
    organizationId: string,
    cutoff: string,
    rows: readonly ExpiredRow[],
  ): Promise<string> {
    const csv = toCsv(
      {
        title: "Bitácora — detalle liberado por retención",
        period: `Eventos anteriores a ${cutoff}`,
        line: "Todas",
      },
      {
        headers: [
          "Evento",
          "Fecha",
          "Autor",
          "Etiqueta de autor",
          "Tabla",
          "Registro",
          "Acción",
          "Origen",
          "Detalle",
        ],
        rows: rows.map((row) => [
          row.id,
          row.occurred_at,
          row.actor_id,
          row.actor_label,
          row.table_name,
          row.record_id,
          row.action,
          row.origin,
          JSON.stringify(row.changes),
        ]),
      },
    );

    const path = `${organizationId}/${cutoff.slice(0, 10)}-bitacora-hasta-${cutoff.slice(0, 10)}.csv`;

    const { error } = await this.supabase.storage
      .from(EXPORTS_BUCKET)
      .upload(path, new Blob([csv], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: true,
      });

    if (error) {
      throw new Error(
        `La exportación previa a la purga no se pudo escribir: ${error.message}`,
      );
    }

    return path;
  }

  /**
   * Que la exportación **está ahí y se lee**.
   *
   * Es una relectura y no un `if (!error)` a propósito: «se subió sin error» y
   * «está ahí y es legible» no son la misma afirmación, y el criterio de
   * aceptación pide la segunda antes de soltar nada.
   */
  private async verify(path: string, expectedRows: number): Promise<void> {
    const { data, error } = await this.supabase.storage
      .from(EXPORTS_BUCKET)
      .download(path);

    if (error || !data) {
      throw new Error(
        `La exportación previa a la purga no se pudo verificar: ${error?.message ?? "no se pudo descargar"}`,
      );
    }

    const text = await data.text();
    // El contexto son cuatro líneas más una en blanco, luego la cabecera y una
    // línea por evento. Se comprueba el recuento y no solo que el archivo
    // exista: un archivo truncado también «se descarga».
    const lines = text.trimEnd().split("\r\n");
    const dataLines = lines.length - lines.indexOf("") - 2;

    if (dataLines !== expectedRows) {
      throw new Error(
        `La exportación previa a la purga está incompleta: ${dataLines} de ${expectedRows} eventos.`,
      );
    }
  }

  /** El vaciado, en la función de la base con privilegio revocado a usuarios. */
  private async purge(
    organizationId: string,
    cutoff: string,
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc("purge_activity_detail", {
      p_organization: organizationId,
      p_cutoff: cutoff,
    });

    if (error) {
      throw new Error(`No se pudo vaciar el detalle: ${error.message}`);
    }

    return (data as number | null) ?? 0;
  }
}

/** El resumen que la rutina informa al terminar, para el registro del trabajo. */
export function describeRun(run: RetentionRun): string {
  if (run.exported === 0) {
    return `Retención de ${run.months} meses: no había eventos anteriores a ${run.cutoff} con detalle. Nada que exportar ni que vaciar.`;
  }

  return `Retención de ${run.months} meses: ${run.exported} eventos exportados a ${EXPORTS_BUCKET}/${run.exportPath}, ${run.purged} vaciados. Corte en ${run.cutoff}.`;
}
