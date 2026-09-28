import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CartLine } from "@/lib/fair/cart";

import { CartDrawer } from "./cart-drawer";

/**
 * El panel del carrito: detalle y cobro en un solo lugar. Escenarios del
 * delta `fair-mode`, requisito «Carrito y cobro en cuatro interacciones o
 * menos».
 */

const linea = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1",
  itemId: "taza",
  variantId: null,
  name: "Taza de barro",
  quantity: 2,
  unitPrice: 35,
  businessLineId: null,
  ...over,
});

const maceta = linea({ id: "l2", itemId: "maceta", name: "Maceta", quantity: 1, unitPrice: 45 });

function renderDrawer(
  props: Partial<React.ComponentProps<typeof CartDrawer>> = {},
) {
  const all = {
    open: true,
    lines: [linea(), maceta],
    units: 3,
    total: 115,
    onOpenChange: vi.fn(),
    onSetQuantity: vi.fn(),
    onRemove: vi.fn(),
    onRegister: vi.fn(),
    ...props,
  };
  const utils = render(<CartDrawer {...all} />);
  return { ...utils, props: all };
}

afterEach(cleanup);

describe("CartDrawer", () => {
  it("se abre como panel por la derecha con cada línea y su subtotal", () => {
    renderDrawer();

    const dialog = screen.getByRole("dialog", { name: /Carrito/ });
    expect(dialog).toHaveAttribute("data-side", "right");

    const [taza, segunda] = within(dialog).getAllByTestId("cart-line");
    expect(taza).toHaveTextContent("Taza de barro");
    expect(taza).toHaveTextContent("35 × 2");
    expect(within(taza).getByTestId("cart-line-subtotal")).toHaveTextContent("70");
    expect(segunda).toHaveTextContent("Maceta");
    expect(screen.getByTestId("drawer-total")).toHaveTextContent("115");
  });

  // Escenario: Cambiar la cantidad desde el panel
  it("+ y − piden la cantidad siguiente de la línea", async () => {
    const { props } = renderDrawer();

    await userEvent.click(screen.getByRole("button", { name: "Aumentar Taza de barro" }));
    expect(props.onSetQuantity).toHaveBeenLastCalledWith("l1", 3);

    await userEvent.click(screen.getByRole("button", { name: "Disminuir Taza de barro" }));
    expect(props.onSetQuantity).toHaveBeenLastCalledWith("l1", 1);
  });

  // Escenario: La cantidad de una línea no baja de 1
  it("− no está disponible en una línea de cantidad 1", () => {
    renderDrawer();

    expect(screen.getByRole("button", { name: "Disminuir Maceta" })).toBeDisabled();
  });

  // Escenario: Quitar una línea
  it("quitar una línea avisa con su identificador", async () => {
    const { props } = renderDrawer();

    await userEvent.click(screen.getByRole("button", { name: "Quitar Maceta" }));

    expect(props.onRemove).toHaveBeenCalledWith("l2");
  });

  // Escenario: Monto propuesto
  it("propone el total y se registra sin escribir nada", async () => {
    const { props } = renderDrawer();

    expect(screen.getByTestId("fair-amount")).toHaveValue("115");
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    expect(props.onRegister).toHaveBeenCalledWith(115, "cash");
  });

  // Escenario: El monto propuesto sigue a los cambios del panel
  it("mientras no se edita, el monto sigue al total", () => {
    const { rerender, props } = renderDrawer();

    rerender(<CartDrawer {...props} total={150} />);

    expect(screen.getByTestId("fair-amount")).toHaveValue("150");
  });

  it("un monto editado se conserva aunque cambie el total", async () => {
    const { rerender, props } = renderDrawer();

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "80");
    rerender(<CartDrawer {...props} total={150} />);

    expect(screen.getByTestId("fair-amount")).toHaveValue("80");
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    expect(props.onRegister).toHaveBeenCalledWith(80, "cash");
  });

  it("al cerrar y reabrir, vuelve a proponer el total vigente", async () => {
    const { rerender, props } = renderDrawer();

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "80");
    rerender(<CartDrawer {...props} open={false} />);
    rerender(<CartDrawer {...props} open total={60} />);

    expect(screen.getByTestId("fair-amount")).toHaveValue("60");
  });

  it("un monto de cero se acepta: registra la venta sin cobro", async () => {
    const { props } = renderDrawer();

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "0");
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    expect(props.onRegister).toHaveBeenCalledWith(0, "cash");
  });

  it("un monto ilegible no deja registrar", async () => {
    renderDrawer();

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "abc");

    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeDisabled();
  });

  it("permite elegir el método de cobro", async () => {
    const { props } = renderDrawer();

    await userEvent.click(screen.getByRole("radio", { name: "Transferencia" }));
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    expect(props.onRegister).toHaveBeenCalledWith(115, "transfer");
  });

  // Escenario: Cobrar con el carrito vacío (panel abierto tras quitar la última línea)
  it("sin líneas lo dice y no deja registrar, sin cerrarse solo", () => {
    const { props } = renderDrawer({ lines: [], units: 0, total: 0 });

    expect(screen.getByText("El carrito está vacío.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeDisabled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("cerrado no muestra el cobro", () => {
    renderDrawer({ open: false });

    expect(screen.queryByTestId("fair-amount")).not.toBeInTheDocument();
  });
});
