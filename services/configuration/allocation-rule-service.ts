import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type AllocationSettingsInput,
  allocationSettingsSchema,
  readAllocationSettings,
} from "@/lib/reports/allocation-schema";

/**
 * La regla de reparto de gastos compartidos, guardada en
 * `organizations.settings` (KAM-20).
 *
 * Vive en `settings` y no en una tabla propia porque es **una fila por
 * organización**: una tabla de una fila con su RLS y su archivado sería más
 * maquinaria que dato. El esquema lo previó así desde KAM-02, y esta es la
 * primera clave que ocupa ese `jsonb`.
 *
 * La escritura no comprueba el rol: la RLS de `organizations` ya deja escribir
 * solo a la persona dueña, y repetir aquí esa decisión daría dos sitios donde
 * cambiarla.
 */
export class AllocationRuleService {
  constructor(private readonly supabase: SupabaseClient) {}

  async get(organizationId: string): Promise<AllocationSettingsInput> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: unknown }>();

    if (error) {
      throw new Error(
        `No se pudo cargar la regla de reparto: ${error.message}`,
      );
    }

    return readAllocationSettings(data?.settings);
  }

  /**
   * Guarda la regla **fusionando** dentro de `settings`, no reemplazándolo:
   * ese `jsonb` es el sitio previsto también para la retención de la bitácora
   * y las preferencias de aviso, y un `update` que lo sustituyera entero
   * borraría en silencio lo que guarde la tarea de al lado.
   */
  async save(
    organizationId: string,
    input: AllocationSettingsInput,
  ): Promise<AllocationSettingsInput> {
    // Se valida aquí además de en la acción: un servicio que confía en que
    // alguien más validó es un servicio que se puede llamar mal desde el
    // siguiente punto de entrada que se escriba.
    const parsed = allocationSettingsSchema.parse(input);

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
      allocation: parsed,
    };

    const { error } = await this.supabase
      .from("organizations")
      .update({ settings, updated_at: new Date().toISOString() })
      .eq("id", organizationId);

    if (error) {
      throw new Error(`No se pudo guardar la regla de reparto: ${error.message}`);
    }

    return parsed;
  }
}
