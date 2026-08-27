import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePendingToggle } from "./use-pending-toggle";

describe("usePendingToggle", () => {
  it("responde al instante, antes de que el servidor conteste", () => {
    const { result } = renderHook(({ v }) => usePendingToggle(v), {
      initialProps: { v: false },
    });

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
  });

  it("cuando llega la respuesta del servidor, coinciden sin parpadeo", () => {
    const { result, rerender } = renderHook(({ v }) => usePendingToggle(v), {
      initialProps: { v: false },
    });

    act(() => result.current[1](true));
    // La navegación terminó y el servidor entrega el filtro ya aplicado.
    rerender({ v: true });

    expect(result.current[0]).toBe(true);
  });

  it("un cambio del servidor manda sobre lo elegido en local", () => {
    const { result, rerender } = renderHook(({ v }) => usePendingToggle(v), {
      initialProps: { v: true },
    });

    // Volver atrás en el historial deja la dirección sin el filtro.
    rerender({ v: false });

    expect(result.current[0]).toBe(false);
  });
});
