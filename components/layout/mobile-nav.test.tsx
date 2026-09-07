import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/stores/user-store";

const pathname = vi.hoisted(() => ({ value: "/orders" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

import { MobileNav } from "./mobile-nav";

function renderNav(route: string, role: "owner" | "assistant" = "owner") {
  pathname.value = route;
  useUserStore.setState({
    membership: {
      id: "m1",
      organizationId: "o1",
      role,
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

  it("no se rinde en el alta de compra ni en la de gasto", () => {
    // KAM-09 dejó la nota y no la aplicó: la barra tapaba el guardar del
    // formulario de gasto y ofrecía una salida sin confirmar el descarte.
    renderNav("/expenses/purchases/new");
    expect(screen.queryByTestId("bottom-bar")).toBeNull();

    cleanup();

    renderNav("/expenses/costs/new");
    expect(screen.queryByTestId("bottom-bar")).toBeNull();
  });

  it("tiene cuatro ranuras: Inicio, Pedidos, Tareas y Más", () => {
    renderNav("/orders");

    const barra = screen.getByTestId("bottom-bar");
    expect(
      [...barra.children].map((slot) => slot.textContent),
    ).toEqual(["Inicio", "Pedidos", "Tareas", "Más"]);
  });

  it("son cuatro también para el ayudante", () => {
    // Ni una sección más aunque el rol vea menos: los rótulos se cortaban
    // justamente porque la barra crecía con el menú.
    renderNav("/orders", "assistant");

    expect(screen.getByTestId("bottom-bar").children).toHaveLength(4);
  });

  it("Inicio lleva al registro rápido y Tareas a Mis pendientes", () => {
    renderNav("/orders");

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      "/quick",
    );
    // A *Mis pendientes*, no al tablero: en el celular interesa qué hago hoy.
    expect(screen.getByRole("link", { name: "Tareas" })).toHaveAttribute(
      "href",
      "/my-tasks",
    );
  });

  it("Más es un botón que despliega, no un enlace", () => {
    renderNav("/orders");

    const mas = screen.getByTestId("bottom-bar-more");
    expect(mas.tagName).toBe("BUTTON");
    expect(mas).toHaveAttribute("aria-expanded", "false");
  });
});

describe("panel Más", () => {
  it("ofrece al dueño el resto de secciones", async () => {
    renderNav("/orders");
    await userEvent.click(screen.getByTestId("bottom-bar-more"));

    const panel = screen.getByTestId("more-panel");
    for (const label of ["Panel", "Egresos", "Catálogo", "Contactos", "Configuración"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(panel).toBeInTheDocument();
  });

  it("al ayudante no le ofrece egresos ni configuración", async () => {
    renderNav("/orders", "assistant");
    await userEvent.click(screen.getByTestId("bottom-bar-more"));

    expect(screen.getByRole("link", { name: "Catálogo" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Egresos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Configuración" })).toBeNull();
  });

  it("no repite dentro las secciones que ya tienen ranura", async () => {
    renderNav("/orders");
    await userEvent.click(screen.getByTestId("bottom-bar-more"));

    const panel = screen.getByTestId("more-panel");
    expect(panel.textContent).not.toContain("Inicio");
    expect(panel.textContent).not.toContain("Pedidos");
  });

  it("elegir una entrada cierra el panel", async () => {
    renderNav("/orders");
    await userEvent.click(screen.getByTestId("bottom-bar-more"));
    await userEvent.click(screen.getByRole("link", { name: "Catálogo" }));

    expect(screen.queryByTestId("more-panel")).toBeNull();
  });
});
