import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
});
