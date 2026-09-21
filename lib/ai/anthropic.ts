import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AiAssistant, AiProposal } from "./port";

/** El modelo: rápido y barato alcanza de sobra para reescribir un párrafo. */
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Cuánto se espera al proveedor antes de darlo por caído (spec
 * `ai-writing-assist` → "Un proveedor que falla o tarda se degrada sin
 * arriesgar el texto").
 */
const TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `Reescribes la descripción de una tarea de un taller para que quede clara y
ordenada, sin inventar nada que no esté ya dicho o insinuado en el texto
original.

Reglas, todas verificables:
- Responde siempre en español.
- Conserva la estructura Markdown del original: encabezados, listas y énfasis.
- Conserva cada ítem de lista de verificación ("- [ ]" o "- [x]") con
  exactamente el mismo estado marcado o no marcado que tenía.
- Devuelve únicamente el cuerpo reescrito, sin comentarios ni explicaciones
  alrededor.`;

/**
 * El adaptador real, sobre el SDK de Anthropic directo (decisión de
 * `design.md`: no la pasarela de IA de Vercel).
 */
export class AnthropicAiAssistant implements AiAssistant {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async proposeBodyImprovement(body: string): Promise<AiProposal> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const message = await this.client.messages.create(
        {
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: body }],
        },
        { signal: controller.signal },
      );

      const proposal = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      if (!proposal) throw new Error("el proveedor de IA devolvió una respuesta vacía");

      return { proposal };
    } finally {
      clearTimeout(timeout);
    }
  }
}
