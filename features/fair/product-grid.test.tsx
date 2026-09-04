import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductGrid } from "./product-grid";
import type { FairProduct } from "@/services/fair/fair-sale-service";

const producto = (over: Partial<FairProduct> = {}): FairProduct => ({
  id: "taza",
  name: "Taza de barro",
  salePrice: 35,
  quantitySold: 30,
  businessLineId: "line-a",
  ...over,
});

afterEach(cleanup);

describe("ProductGrid", () => {
  it("muestra nombre y precio de cada producto", () => {
    render(<ProductGrid products={[producto()]} onPick={vi.fn()} ageLabel={null} />);

    expect(screen.getByText("Taza de barro")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
  });

  // Escenario: Producto sin foto — se reconoce por su nombre igualmente
  it("un producto sin foto aparece y se reconoce por su nombre", () => {
    render(
      <ProductGrid products={[producto({ name: "Plato hondo" })]} onPick={vi.fn()} ageLabel={null} />,
    );

    expect(screen.getByRole("button", { name: /Plato hondo/ })).toBeInTheDocument();
  });

  it("un toque agrega al carrito sin abrir ningún diálogo", async () => {
    const onPick = vi.fn();
    render(<ProductGrid products={[producto()]} onPick={onPick} ageLabel={null} />);

    await userEvent.click(screen.getByTestId("fair-product"));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Escenario: Tocar dos veces el mismo producto (parte de interfaz)
  it("dos toques llaman dos veces, sin pasos intermedios", async () => {
    const onPick = vi.fn();
    render(<ProductGrid products={[producto()]} onPick={onPick} ageLabel={null} />);

    const boton = screen.getByTestId("fair-product");
    await userEvent.click(boton);
    await userEvent.click(boton);

    expect(onPick).toHaveBeenCalledTimes(2);
  });

  // Escenario: La antigüedad del catálogo está a la vista
  it("muestra de cuándo es el catálogo cuando se lo dan", () => {
    render(
      <ProductGrid
        products={[producto()]}
        onPick={vi.fn()}
        ageLabel="Catálogo cargado hace 6 h"
      />,
    );

    expect(screen.getByTestId("snapshot-age")).toHaveTextContent("hace 6 h");
  });

  it("sin etiqueta de antigüedad no muestra el rótulo", () => {
    render(<ProductGrid products={[producto()]} onPick={vi.fn()} ageLabel={null} />);

    expect(screen.queryByTestId("snapshot-age")).not.toBeInTheDocument();
  });

  it("una cuadrícula sin productos explica qué falta, no queda en blanco", () => {
    render(<ProductGrid products={[]} onPick={vi.fn()} ageLabel={null} />);

    expect(screen.getByText(/precio de venta/i)).toBeInTheDocument();
  });

  // Escenario: Sin desplazamiento horizontal — el contenedor lo impide
  it("el contenedor no permite desplazamiento horizontal", () => {
    const { container } = render(
      <ProductGrid products={[producto()]} onPick={vi.fn()} ageLabel={null} />,
    );

    expect(container.firstElementChild).toHaveClass("overflow-x-hidden");
  });

  it("respeta el orden en que llegan los productos", () => {
    render(
      <ProductGrid
        products={[producto(), producto({ id: "maceta", name: "Maceta", quantitySold: 4 })]}
        onPick={vi.fn()}
        ageLabel={null}
      />,
    );

    const nombres = screen.getAllByTestId("fair-product").map((b) => b.textContent);
    expect(nombres[0]).toContain("Taza de barro");
    expect(nombres[1]).toContain("Maceta");
  });
});
