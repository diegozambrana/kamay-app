import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MainContainer } from "./main-container";

afterEach(cleanup);

describe("MainContainer", () => {
  it("rinde el título, la descripción y la acción", () => {
    render(
      <MainContainer
        title="Pedidos"
        description="El trabajo comprometido con clientes."
        action={<button type="button">Nuevo</button>}
      >
        <p>contenido</p>
      </MainContainer>,
    );

    expect(screen.getByRole("heading", { name: "Pedidos" })).toBeInTheDocument();
    expect(
      screen.getByText("El trabajo comprometido con clientes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo" })).toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("es el landmark principal de la página", () => {
    render(
      <MainContainer title="Panel">
        <p>contenido</p>
      </MainContainer>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("sin descripción ni acción no rinde huecos", () => {
    render(
      <MainContainer title="Panel">
        <p>contenido</p>
      </MainContainer>,
    );

    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("migas de pan", () => {
    it("sin migas no rinde la navegación", () => {
      render(
        <MainContainer title="Pedidos">
          <p>contenido</p>
        </MainContainer>,
      );

      expect(screen.queryByRole("navigation", { name: "Ruta" })).not.toBeInTheDocument();
    });

    it("los tramos anteriores enlazan y el último es la página actual", () => {
      render(
        <MainContainer
          title="Editar pedido #42"
          breadcrumbs={[
            { label: "Pedidos", href: "/orders?view=list" },
            { label: "Pedido #42", href: "/orders/abc" },
            { label: "Editar" },
          ]}
        >
          <p>contenido</p>
        </MainContainer>,
      );

      const nav = screen.getByRole("navigation", { name: "Ruta" });
      expect(nav).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute(
        "href",
        "/orders?view=list",
      );
      expect(screen.getByRole("link", { name: "Pedido #42" })).toHaveAttribute(
        "href",
        "/orders/abc",
      );
      // «El último tramo no es un enlace» y se anuncia como la página actual.
      expect(screen.queryByRole("link", { name: "Editar" })).not.toBeInTheDocument();
      expect(screen.getByText("Editar")).toHaveAttribute("aria-current", "page");
    });

    it("un tramo con onClick lo invoca al pulsarlo", () => {
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      render(
        <MainContainer
          title="Nuevo pedido"
          breadcrumbs={[{ label: "Pedidos", href: "/orders", onClick }, { label: "Nuevo pedido" }]}
        >
          <p>contenido</p>
        </MainContainer>,
      );

      fireEvent.click(screen.getByRole("link", { name: "Pedidos" }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
