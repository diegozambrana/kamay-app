import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartBar } from "./cart-bar";
import type { CartLine } from "@/lib/fair/cart";

const linea = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1",
  itemId: "taza",
  variantId: null,
  name: "Taza de barro",
  quantity: 2,
  unitPrice: 35,
  ...over,
});

afterEach(cleanup);

describe("CartBar", () => {
  // Escenario: El total sigue al carrito
  it("muestra unidades y total vigentes", () => {
    render(
      <CartBar
        lines={[linea()]}
        units={2}
        total={70}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />,
    );

    expect(screen.getByTestId("cart-total")).toHaveTextContent("70");
    expect(screen.getByText("2 unidades")).toBeInTheDocument();
  });

  it("dice «unidad» en singular", () => {
    render(
      <CartBar lines={[linea({ quantity: 1 })]} units={1} total={35} onRemove={vi.fn()} onCheckout={vi.fn()} />,
    );

    expect(screen.getByText("1 unidad")).toBeInTheDocument();
  });

  // Escenario: Cobrar con el carrito vacío
  it("Cobrar no está disponible con el carrito vacío", () => {
    render(<CartBar lines={[]} units={0} total={0} onRemove={vi.fn()} onCheckout={vi.fn()} />);

    expect(screen.getByTestId("fair-checkout")).toBeDisabled();
  });

  it("la barra sigue presente con el carrito vacío: no entra y sale", () => {
    render(<CartBar lines={[]} units={0} total={0} onRemove={vi.fn()} onCheckout={vi.fn()} />);

    expect(screen.getByTestId("fair-checkout")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("0");
  });

  it("Cobrar avisa cuando hay algo que cobrar", async () => {
    const onCheckout = vi.fn();
    render(
      <CartBar lines={[linea()]} units={2} total={70} onRemove={vi.fn()} onCheckout={onCheckout} />,
    );

    await userEvent.click(screen.getByTestId("fair-checkout"));

    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  // Escenario: Quitar una línea
  it("quitar una línea avisa con su identificador", async () => {
    const onRemove = vi.fn();
    render(
      <CartBar lines={[linea()]} units={2} total={70} onRemove={onRemove} onCheckout={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Quitar Taza de barro/ }));

    expect(onRemove).toHaveBeenCalledWith("l1");
  });

  it("muestra cada línea con su cantidad y su importe", () => {
    render(
      <CartBar lines={[linea()]} units={2} total={70} onRemove={vi.fn()} onCheckout={vi.fn()} />,
    );

    expect(screen.getByText("2 × Taza de barro")).toBeInTheDocument();
  });
});
