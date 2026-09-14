import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSyncStore } from "@/stores/sync-store";

vi.mock("@/actions/auth", () => ({
  signOut: vi.fn(),
}));

const { signOut } = await import("@/actions/auth");
const { useSignOut } = await import("./use-sign-out");

beforeEach(() => {
  vi.clearAllMocks();
  useSyncStore.setState({
    items: [],
    counts: { pending: 0, held: 0, failed: 0, total: 0 },
  });
});

describe("useSignOut", () => {
  // Sin registros pendientes de sincronizar, cierra sesión directo.
  it("sin registros pendientes cierra sesión sin pedir confirmación", () => {
    const { result } = renderHook(() => useSignOut());

    act(() => result.current.requestSignOut());

    expect(result.current.confirming).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  // Con registros pendientes, pide confirmación antes de seguir (design D3).
  it("con registros pendientes pide confirmación antes de cerrar sesión", () => {
    useSyncStore.setState({
      items: [],
      counts: { pending: 2, held: 0, failed: 0, total: 2 },
    });
    const { result } = renderHook(() => useSignOut());

    act(() => result.current.requestSignOut());

    expect(result.current.confirming).toBe(true);
    expect(result.current.pendingCount).toBe(2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("confirmar cierra el diálogo y cierra sesión", () => {
    useSyncStore.setState({
      items: [],
      counts: { pending: 2, held: 0, failed: 0, total: 2 },
    });
    const { result } = renderHook(() => useSignOut());

    act(() => result.current.requestSignOut());
    act(() => result.current.confirmSignOut());

    expect(result.current.confirming).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
