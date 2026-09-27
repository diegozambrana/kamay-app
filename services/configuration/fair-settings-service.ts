import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type FairSettings,
  fairSettingsSchema,
  readFairSettings,
} from "@/lib/fair/fair-settings";

/**
 * La bandera «Venta rápida con todas las líneas» (`fair-all-lines`), al mismo
 * patrón que `AiWritingAssistService`: relee, esparce y sobrescribe solo su
 * llave, para no pisar lo que otra sección guarde al lado. Dentro de
 * `settings.fair` también esparce: la llave es de la feria, no de esta
 * bandera sola.
 *
 * La escritura no comprueba el rol: la RLS de `organizations` ya deja
 * escribir solo a la persona dueña.
 */
export class FairSettingsService {
  constructor(private readonly supabase: SupabaseClient) {}

  async get(organizationId: string): Promise<FairSettings> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: unknown }>();

    if (error) {
      throw new Error(`No se pudo cargar la configuración de la venta rápida: ${error.message}`);
    }

    return readFairSettings(data?.settings);
  }

  async save(organizationId: string, input: FairSettings): Promise<FairSettings> {
    const parsed = fairSettingsSchema.parse(input);

    const { data: current, error: readError } = await this.supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single()
      .overrideTypes<{ settings: Record<string, unknown> | null }>();

    if (readError) {
      throw new Error(`No se pudo cargar la configuración: ${readError.message}`);
    }

    const previous = current?.settings ?? {};
    const previousFair =
      typeof previous.fair === "object" && previous.fair !== null
        ? (previous.fair as Record<string, unknown>)
        : {};

    const settings = {
      ...previous,
      fair: { ...previousFair, all_lines: parsed.allLines },
    };

    const { error } = await this.supabase
      .from("organizations")
      .update({ settings, updated_at: new Date().toISOString() })
      .eq("id", organizationId);

    if (error) {
      throw new Error(`No se pudo guardar la venta rápida: ${error.message}`);
    }

    return parsed;
  }
}
