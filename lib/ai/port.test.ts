import { describe, expect, it } from "vitest";

import { type AiAssistant, FailingAiAssistant, MemoryAiAssistant } from "./port";

describe("MemoryAiAssistant", () => {
  it("responde con el texto fijo configurado", async () => {
    const assistant = new MemoryAiAssistant("Texto mejorado.");

    const { proposal } = await assistant.proposeBodyImprovement("Texto apurado.");

    expect(proposal).toBe("Texto mejorado.");
  });

  it("responde con lo que devuelva la función configurada", async () => {
    const assistant = new MemoryAiAssistant((body) => `${body} (mejorado)`);

    const { proposal } = await assistant.proposeBodyImprovement("Texto apurado.");

    expect(proposal).toBe("Texto apurado. (mejorado)");
  });

  it("por omisión devuelve el mismo cuerpo que recibió", async () => {
    const assistant = new MemoryAiAssistant();

    const { proposal } = await assistant.proposeBodyImprovement("Texto apurado.");

    expect(proposal).toBe("Texto apurado.");
  });
});

describe("FailingAiAssistant", () => {
  it("siempre lanza, sin devolver ningún resultado parcial", async () => {
    const assistant: AiAssistant = new FailingAiAssistant();

    await expect(assistant.proposeBodyImprovement("Texto apurado.")).rejects.toThrow();
  });
});
