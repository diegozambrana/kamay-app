import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartBar } from "./cart-bar";

afterEach(cleanup);

describe("CartBar", () => {
  // Escenario: El total sigue al carrito
  it("muestra unidades y total vigentes", () => {
    render(<CartBar units={2} total={70} onOpen={vi.fn()} />);

    expect(screen.getByTestId("cart-total")).toHaveTextContent("70");
    expect(screen.getByText("2 unidades")).toBeInTheDocument();
  });

  it("dice «unidad» en singular", () => {
    render(<CartBar units={1} total={35} onOpen={vi.fn()} />);

    expect(screen.getByText("1 unidad")).toBeInTheDocument();
  });

  // Escenario: Cobrar con el carrito vacío
  it("Ver carrito no está disponible con el carrito vacío", () => {
    render(<CartBar units={0} total={0} onOpen={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Ver carrito" })).toBeDisabled();
  });

  it("la barra sigue presente con el carrito vacío: no entra y sale", () => {
    render(<CartBar units={0} total={0} onOpen={vi.fn()} />);

    expect(screen.getByTestId("fair-view-cart")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("0");
  });

  it("Ver carrito avisa cuando hay algo en el carrito", async () => {
    const onOpen = vi.fn();
    render(<CartBar units={2} total={70} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: "Ver carrito" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("la barra no lista las líneas: eso vive en el panel", () => {
    render(<CartBar units={2} total={70} onOpen={vi.fn()} />);

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button", { name: /Quitar/ })).toBeNull();
  });
});
