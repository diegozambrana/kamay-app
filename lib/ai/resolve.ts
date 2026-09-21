import "server-only";

import { AnthropicAiAssistant } from "./anthropic";
import type { AiAssistant } from "./port";

/**
 * Elige el adaptador según lo que haya configurado.
 *
 * **Devuelve `null` mientras falte `ANTHROPIC_API_KEY`**, y esa es la
 * conducta correcta y no un apaño: la variable es opcional y su ausencia
 * apaga la función para toda organización en vez de romper la compilación o
 * el arranque (spec `ai-writing-assist` → "La función se apaga por completo
 * si falta su configuración"), igual que `resolveMailer()` hace con el correo.
 */
export function resolveAiAssistant(): AiAssistant | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  return new AnthropicAiAssistant(apiKey);
}
