import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/stores/user-store";

const pathname = vi.hoisted(() => ({ value: "/orders" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

import { MobileNav } from "./mobile-nav";

function renderNav(route: string) {
  pathname.value = route;
  useUserStore.setState({
    membership: {
      id: "m1",
      organizationId: "o1",
      role: "owner",
      displayName: null,
    },
  });
  return render(<MobileNav />);
}

afterEach(cleanup);

describe("MobileNav", () => {
  it("se rinde en las pantallas normales", () => {
    renderNav("/orders");

    expect(screen.getByTestId("bottom-bar")).toBeInTheDocument();
  });

  it("también en el detalle de un pedido", () => {
    renderNav("/orders/86e70354-5706-4f88-9122-b2474f9cc9fc");

    expect(screen.getByTestId("bottom-bar")).toBeInTheDocument();
  });

  /**
   * Los formularios de captura son pantalla completa en el celular: la barra
   * taparía las acciones de guardar y ofrecería salidas que se saltarían la
   * confirmación de descarte.
   */
  it("no se rinde en el alta de pedido", () => {
    renderNav("/orders/new");

    expect(screen.queryByTestId("bottom-bar")).toBeNull();
  });

  it("no se rinde en la edición de un pedido", () => {
    renderNav("/orders/86e70354-5706-4f88-9122-b2474f9cc9fc/edit");

    expect(screen.queryByTestId("bottom-bar")).toBeNull();
  });

  it("una ruta que solo se parece sigue mostrando la barra", () => {
    renderNav("/orders/new/algo-mas");

    expect(screen.getByTestId("bottom-bar")).toBeInTheDocument();
  });
});
