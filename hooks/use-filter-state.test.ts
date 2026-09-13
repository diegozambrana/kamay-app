import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFilterState, useSearchReset } from "./use-filter-state";

const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/expenses",
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  push.mockReset();
});

describe("useFilterState", () => {
  it("sin parámetros de filtro no hay filtros activos", () => {
    search = "view=list";
    const { result } = renderHook(() => useFilterState(["q", "category"]));

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("un filtro vacío no cuenta como activo", () => {
    search = "q=";
    const { result } = renderHook(() => useFilterState(["q"]));

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("un filtro con valor está activo", () => {
    search = "q=tinta&view=list";
    const { result } = renderHook(() => useFilterState(["q", "category"]));

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("quitar filtros borra solo los filtros y conserva la vista", () => {
    search = "q=tinta&category=abc&view=list";
    const { result } = renderHook(() => useFilterState(["q", "category"]));

    act(() => result.current.clearFilters());

    expect(push).toHaveBeenCalledWith("/expenses?view=list");
  });

  it("sin otros parámetros vuelve a la dirección limpia", () => {
    search = "q=tinta";
    const { result } = renderHook(() => useFilterState(["q"]));

    act(() => result.current.clearFilters());

    expect(push).toHaveBeenCalledWith("/expenses");
  });
});

describe("useSearchReset", () => {
  it("no cambia la clave mientras se escribe", () => {
    const { result, rerender } = renderHook(({ search }) => useSearchReset(search), {
      initialProps: { search: "ti" },
    });
    const first = result.current.searchKey;

    rerender({ search: "tin" });
    rerender({ search: "tinta" });

    expect(result.current.searchKey).toBe(first);
  });

  it("armada, reinicia una sola vez cuando la búsqueda llega vacía", () => {
    const { result, rerender } = renderHook(({ search }) => useSearchReset(search), {
      initialProps: { search: "tinta" },
    });
    const first = result.current.searchKey;

    act(() => result.current.armSearchReset());
    // Todavía no llegó la búsqueda vacía del servidor: no se remonta con el
    // texto viejo.
    expect(result.current.searchKey).toBe(first);

    rerender({ search: "" });
    expect(result.current.searchKey).toBe(first + 1);

    rerender({ search: "" });
    expect(result.current.searchKey).toBe(first + 1);
  });
});
