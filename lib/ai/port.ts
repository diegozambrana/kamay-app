/**
 * El puerto hacia un modelo de lenguaje.
 *
 * Al estilo exacto de `lib/email/port.ts`: una interfaz mínima, el proveedor
 * concreto detrás de un adaptador (`anthropic.ts`), y dos adaptadores para las
 * pruebas —`MemoryAiAssistant`, para que ninguna prueba toque la red, y
 * `FailingAiAssistant`, para demostrar que un fallo del modelo no se lleva por
 * delante el editor.
 *
 * KAM-30 es la primera funcionalidad que llama a un modelo; este puerto es el
 * patrón que las siguientes reutilizarán, no algo específico de la
 * descripción de una tarea.
 */
export type AiProposal = {
  /** El texto propuesto, tal como lo devolvió el modelo, sin sanear. */
  proposal: string;
};

export interface AiAssistant {
  /**
   * Propone una versión mejorada de `body`. Lanza si el proveedor falla o si
   * no responde dentro de su propio plazo — nunca devuelve un resultado
   * parcial.
   */
  proposeBodyImprovement(body: string): Promise<AiProposal>;
}

/**
 * El adaptador de las pruebas: no sale a la red. Se configura con una
 * respuesta fija o con una función, para cubrir tanto el caso feliz como
 * comportamientos concretos (una propuesta que pierde un ítem, por ejemplo).
 */
export class MemoryAiAssistant implements AiAssistant {
  constructor(
    private readonly respond: string | ((body: string) => string) = (body) => body,
  ) {}

  async proposeBodyImprovement(body: string): Promise<AiProposal> {
    const proposal = typeof this.respond === "function" ? this.respond(body) : this.respond;
    return { proposal };
  }
}

/**
 * Un adaptador que siempre falla, para probar que el editor se degrada sin
 * arriesgar el texto (spec `ai-writing-assist` → "Un proveedor que falla o
 * tarda se degrada sin arriesgar el texto").
 */
export class FailingAiAssistant implements AiAssistant {
  async proposeBodyImprovement(): Promise<AiProposal> {
    throw new Error("el proveedor de IA no responde");
  }
}
