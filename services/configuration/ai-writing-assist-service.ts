import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type WritingAssistSettingsInput,
  readWritingAssistSettings,
  writingAssistSettingsSchema,
} from "@/lib/ai/writing-assist-settings";

/**
 * El interruptor de la asistencia de redacción, guardado en
 * `organizations.settings` (KAM-30), al mismo patrón que
 * `AllocationRuleService`: relee, esparce y sobrescribe solo su llave, para no
 * pisar lo que otra sección guarde al lado.
 *
 * La escritura no comprueba el rol: la RLS de `organizations` ya deja
 * escribir solo a la persona dueña.
 */
export class AiWritingAssistService {
  constructor(private readonly supabase: SupabaseClient) {}

  async get(organizationId: string): Promise<WritingAssistSettingsInput> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: unknown }>();

    if (error) {
      throw new Error(`No se pudo cargar la asistencia de redacción: ${error.message}`);
    }

    return readWritingAssistSettings(data?.settings);
  }

  async save(
    organizationId: string,
    input: WritingAssistSettingsInput,
  ): Promise<WritingAssistSettingsInput> {
    const parsed = writingAssistSettingsSchema.parse(input);

    const { data: current, error: readError } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: Record<string, unknown> | null }>();

    if (readError) {
      throw new Error(`No se pudo cargar la configuración: ${readError.message}`);
    }

    const settings = {
      ...(current?.settings ?? {}),
      ai_writing_assist: parsed,
    };

    const { error } = await this.supabase
      .from("organizations")
      .update({ settings, updated_at: new Date().toISOString() })
      .eq("id", organizationId);

    if (error) {
      throw new Error(`No se pudo guardar la asistencia de redacción: ${error.message}`);
    }

    return parsed;
  }
}
