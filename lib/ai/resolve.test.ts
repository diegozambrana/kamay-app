// @vitest-environment node
//
// El SDK de Anthropic se niega a inicializarse "en un entorno de navegador",
// y jsdom (el entorno por omisión de este proyecto) cuenta como uno para su
// detección, aunque este módulo esté guardado con `import "server-only"` y
// nunca llegue al bundle de cliente (KAM-30). Node es el entorno real de este
// código.
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicAiAssistant } from "./anthropic";
import { resolveAiAssistant } from "./resolve";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAiAssistant", () => {
  it("sin ANTHROPIC_API_KEY, devuelve null: la función queda apagada", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    expect(resolveAiAssistant()).toBeNull();
  });

  it("con la variable en blanco, también queda apagada", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");

    expect(resolveAiAssistant()).toBeNull();
  });

  it("con ANTHROPIC_API_KEY configurada, resuelve el adaptador real", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");

    expect(resolveAiAssistant()).toBeInstanceOf(AnthropicAiAssistant);
  });
});
