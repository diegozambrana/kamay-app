/**
 * El interruptor de la asistencia de redacción, guardado en
 * `organizations.settings` junto a `allocation` y `activity_retention`
 * (KAM-30, design.md → "Activación por organización").
 */

import { z } from "zod";

export const writingAssistSettingsSchema = z.object({
  enabled: z.boolean(),
});

export type WritingAssistSettingsInput = z.infer<typeof writingAssistSettingsSchema>;

/** Apagada por omisión: una organización que nunca tocó esto no la ofrece. */
export const DEFAULT_WRITING_ASSIST_SETTINGS: WritingAssistSettingsInput = {
  enabled: false,
};

/**
 * Lee el interruptor desde el `settings` de la organización. Un `settings`
 * vacío, o con una forma que no reconocemos, devuelve la de por defecto
 * —apagada— en vez de fallar.
 */
export function readWritingAssistSettings(settings: unknown): WritingAssistSettingsInput {
  const parsed = writingAssistSettingsSchema.safeParse(
    (settings as { ai_writing_assist?: unknown } | null)?.ai_writing_assist,
  );
  return parsed.success ? parsed.data : DEFAULT_WRITING_ASSIST_SETTINGS;
}
