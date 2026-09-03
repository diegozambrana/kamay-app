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

  it("conserva el encabezado mientras carga: la pantalla no da un salto", () => {
    render(
      <MainContainer title="Catálogo" loading>
        <p>contenido</p>
      </MainContainer>,
    );

    expect(screen.getByRole("heading", { name: "Catálogo" })).toBeInTheDocument();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });

  it("el vacío sustituye al contenido, no al encabezado", () => {
    render(
      <MainContainer
        title="Contactos"
        isEmpty
        emptyTitle="Sin contactos"
        emptyDescription="Crea el primero."
      >
        <p>contenido</p>
      </MainContainer>,
    );

    expect(screen.getByRole("heading", { name: "Contactos" })).toBeInTheDocument();
    expect(screen.getByText("Sin contactos")).toBeInTheDocument();
    expect(screen.getByText("Crea el primero.")).toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });

  it("el error manda sobre el vacío y sobre la carga", () => {
    render(
      <MainContainer title="Pedidos" error="Se perdió la conexión." isEmpty loading>
        <p>contenido</p>
      </MainContainer>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Se perdió la conexión.");
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
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
