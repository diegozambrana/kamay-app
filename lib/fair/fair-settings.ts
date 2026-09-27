/**
 * La bandera «Venta rápida con todas las líneas» (`fair-all-lines`), guardada
 * en `organizations.settings.fair` junto a `allocation`, `retention` y
 * `ai_writing_assist`.
 */

import { z } from "zod";

export const fairSettingsSchema = z.object({
  allLines: z.boolean(),
});

export type FairSettings = z.infer<typeof fairSettingsSchema>;

/** Apagada por omisión: la feria muestra solo su línea y los compartidos. */
export const DEFAULT_FAIR_SETTINGS: FairSettings = { allLines: false };

const storedSchema = z.object({ all_lines: z.boolean() });

/**
 * Lee la bandera desde el `settings` de la organización. Sin la llave, o con
 * una forma que no se reconoce, devuelve la de por omisión —apagada— en vez
 * de fallar: una configuración rara no puede impedir abrir la feria.
 */
export function readFairSettings(settings: unknown): FairSettings {
  const parsed = storedSchema.safeParse((settings as { fair?: unknown } | null)?.fair);
  return parsed.success ? { allLines: parsed.data.all_lines } : DEFAULT_FAIR_SETTINGS;
}
