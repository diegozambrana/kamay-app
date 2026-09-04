import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutSheet } from "./checkout-sheet";

afterEach(cleanup);

describe("CheckoutSheet", () => {
  // Escenario: Monto propuesto
  it("propone el total y se confirma sin escribir nada", async () => {
    const onConfirm = vi.fn();
    render(
      <CheckoutSheet open total={115} onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );

    expect(screen.getByTestId("fair-amount")).toHaveValue("115");

    await userEvent.click(screen.getByTestId("fair-confirm"));

    expect(onConfirm).toHaveBeenCalledWith(115, "cash");
  });

  // Escenario: Cobro parcial
  it("un monto editado es el que se cobra", async () => {
    const onConfirm = vi.fn();
    render(
      <CheckoutSheet open total={115} onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "80");
    await userEvent.click(screen.getByTestId("fair-confirm"));

    expect(onConfirm).toHaveBeenCalledWith(80, "cash");
  });

  // Escenario: Venta sin cobro
  it("un monto de cero se acepta: registra la venta sin cobro", async () => {
    const onConfirm = vi.fn();
    render(
      <CheckoutSheet open total={115} onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "0");
    await userEvent.click(screen.getByTestId("fair-confirm"));

    expect(onConfirm).toHaveBeenCalledWith(0, "cash");
  });

  it("un monto ilegible no deja confirmar", async () => {
    render(<CheckoutSheet open total={115} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);

    const monto = screen.getByTestId("fair-amount");
    await userEvent.clear(monto);
    await userEvent.type(monto, "abc");

    expect(screen.getByTestId("fair-confirm")).toBeDisabled();
  });

  it("permite elegir el método de cobro", async () => {
    const onConfirm = vi.fn();
    render(
      <CheckoutSheet open total={50} onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Transferencia" }));
    await userEvent.click(screen.getByTestId("fair-confirm"));

    expect(onConfirm).toHaveBeenCalledWith(50, "transfer");
  });

  it("cerrada no muestra el formulario", () => {
    render(
      <CheckoutSheet open={false} total={115} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.queryByTestId("fair-amount")).not.toBeInTheDocument();
  });

  // El `key`: cada apertura propone el total vigente, no el de la venta anterior
  it("reabrir con otro total vuelve a proponer el total vigente", () => {
    const { rerender } = render(
      <CheckoutSheet open total={115} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByTestId("fair-amount")).toHaveValue("115");

    rerender(<CheckoutSheet open total={60} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByTestId("fair-amount")).toHaveValue("60");
  });
});
