import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El límite de uso de la asistencia de redacción, contado sobre
 * `ai_writing_assist_requests` y su vista `ai_writing_assist_usage_by_period`
 * (design.md → "Límite de uso: tabla de solicitudes + vista, no un
 * contador"). Nada aquí se deriva y se guarda: el conteo vive en la vista, no
 * en una columna.
 */
export class AiUsageService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** El primer instante del mes calendario en curso, en UTC. */
  private currentPeriodStart(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  /** Cuántas solicitudes hizo la organización en el mes en curso. */
  async countCurrentPeriod(organizationId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("ai_writing_assist_usage_by_period")
      .select("request_count")
      .eq("organization_id", organizationId)
      .eq("period_start", this.currentPeriodStart())
      .maybeSingle()
      .overrideTypes<{ request_count: number } | null>();

    if (error) {
      throw new Error(`No se pudo comprobar el límite de uso: ${error.message}`);
    }

    return data?.request_count ?? 0;
  }

  /**
   * Registra una solicitud **antes** de llamar al proveedor, no después de
   * una respuesta exitosa (design.md → "Cuándo se cuenta"): así el límite es
   * a prueba de reintentos contra un proveedor que falla y de condiciones de
   * carrera entre dos solicitudes concurrentes de la misma organización.
   */
  async recordRequest(organizationId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("ai_writing_assist_requests")
      .insert({ organization_id: organizationId, requested_by: userId });

    if (error) {
      throw new Error(`No se pudo registrar la solicitud: ${error.message}`);
    }
  }
}
