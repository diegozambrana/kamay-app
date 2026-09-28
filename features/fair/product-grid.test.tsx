import { cleanup, render, screen, within } from "@testing-library/react";
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
  photoUrl: null,
  photoAttachmentId: null,
  businessLineName: null,
  ...over,
});

function renderGrid(
  products: FairProduct[] = [producto()],
  {
    onAdd = vi.fn(),
    photoUrls = new Map<string, string | null>(),
    ageLabel = null as string | null,
    showLine = false,
  } = {},
) {
  return render(
    <ProductGrid
      products={products}
      photoUrls={photoUrls}
      onAdd={onAdd}
      ageLabel={ageLabel}
      showLine={showLine}
    />,
  );
}

afterEach(cleanup);

describe("ProductGrid", () => {
  it("muestra nombre y precio de cada producto", () => {
    renderGrid();

    expect(screen.getByText("Taza de barro")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
  });

  // Escenario: Producto con foto
  it("un producto con foto la muestra como miniatura a la izquierda", () => {
    renderGrid([producto()], { photoUrls: new Map([["taza", "blob:local/1"]]) });

    const card = screen.getByTestId("fair-product");
    const image = within(card).getByRole("img", { name: "Foto de Taza de barro" });
    expect(image).toHaveAttribute("src", "blob:local/1");
    // La miniatura va antes que el nombre en el orden del documento.
    expect(card.firstElementChild).toContainElement(image);
  });

  // Escenario: Producto sin foto
  it("un producto sin foto aparece con el sustituto y se reconoce por su nombre", () => {
    renderGrid([producto({ name: "Plato hondo" })]);

    const card = screen.getByTestId("fair-product");
    expect(within(card).queryByRole("img")).toBeNull();
    expect(within(card).getByTestId("fair-photo-placeholder")).toBeInTheDocument();
    expect(within(card).getByText("Plato hondo")).toBeInTheDocument();
  });

  // Escenario: Tocar la tarjeta no agrega
  it("tocar la tarjeta no agrega", async () => {
    const onAdd = vi.fn();
    renderGrid([producto()], { onAdd });

    await userEvent.click(screen.getByText("Taza de barro"));
    await userEvent.click(screen.getByTestId("fair-product"));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("Agregar suma una unidad sin abrir ningún diálogo", async () => {
    const onAdd = vi.fn();
    renderGrid([producto()], { onAdd });

    await userEvent.click(screen.getByRole("button", { name: "Agregar Taza de barro" }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "taza" }), 1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Escenario: Agregar varias unidades de una vez
  it("sube el selector a 3, agrega 3 y el selector vuelve a 1", async () => {
    const onAdd = vi.fn();
    renderGrid([producto()], { onAdd });

    const mas = screen.getByRole("button", { name: "Aumentar cantidad de Taza de barro" });
    await userEvent.click(mas);
    await userEvent.click(mas);
    expect(screen.getByTestId("fair-quantity")).toHaveTextContent("3");

    await userEvent.click(screen.getByRole("button", { name: "Agregar Taza de barro" }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "taza" }), 3);
    expect(screen.getByTestId("fair-quantity")).toHaveTextContent("1");
  });

  // Escenario: El selector no baja de 1
  it("el selector no baja de 1", async () => {
    renderGrid();

    const menos = screen.getByRole("button", { name: "Disminuir cantidad de Taza de barro" });
    expect(menos).toBeDisabled();
    await userEvent.click(menos);

    expect(screen.getByTestId("fair-quantity")).toHaveTextContent("1");
  });

  it("cada tarjeta lleva su propia cantidad", async () => {
    const onAdd = vi.fn();
    renderGrid([producto(), producto({ id: "maceta", name: "Maceta" })], { onAdd });

    await userEvent.click(screen.getByRole("button", { name: "Aumentar cantidad de Maceta" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar Taza de barro" }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "taza" }), 1);
    const [, maceta] = screen.getAllByTestId("fair-quantity");
    expect(maceta).toHaveTextContent("2");
  });

  // Escenario: La antigüedad del catálogo está a la vista
  it("muestra de cuándo es el catálogo cuando se lo dan", () => {
    renderGrid([producto()], { ageLabel: "Catálogo cargado hace 6 h" });

    expect(screen.getByTestId("snapshot-age")).toHaveTextContent("hace 6 h");
  });

  it("sin etiqueta de antigüedad no muestra el rótulo", () => {
    renderGrid();

    expect(screen.queryByTestId("snapshot-age")).not.toBeInTheDocument();
  });

  // Escenario: Línea sin productos que mostrar
  it("una cuadrícula sin productos explica qué falta, no queda en blanco", () => {
    renderGrid([]);

    expect(screen.getByText(/precio de venta/i)).toBeInTheDocument();
    expect(screen.getByText(/Mostrar en venta rápida/)).toBeInTheDocument();
  });

  // Escenario: Sin desplazamiento horizontal — el contenedor lo impide
  it("el contenedor no permite desplazamiento horizontal y en móvil va a una columna", () => {
    const { container } = renderGrid();

    expect(container.firstElementChild).toHaveClass("overflow-x-hidden");
    expect(screen.getByRole("list")).toHaveClass("grid-cols-1");
  });

  it("respeta el orden en que llegan los productos", () => {
    renderGrid([producto(), producto({ id: "maceta", name: "Maceta", quantitySold: 4 })]);

    const nombres = screen.getAllByTestId("fair-product").map((card) => card.textContent);
    expect(nombres[0]).toContain("Taza de barro");
    expect(nombres[1]).toContain("Maceta");
  });

  // `fair-all-lines` · Escenario «Con la bandera, productos de todas las líneas»
  it("con showLine, cada tarjeta dice su línea, o «Compartido»", () => {
    renderGrid(
      [
        producto({ businessLineName: "Sublimación" }),
        producto({ id: "bolsa", name: "Bolsa", businessLineName: null }),
      ],
      { showLine: true },
    );

    const [taza, bolsa] = screen.getAllByTestId("fair-product-line");
    expect(taza).toHaveTextContent("Sublimación");
    expect(bolsa).toHaveTextContent("Compartido");
  });

  // Escenario «Sin la bandera, nada cambia»
  it("sin showLine, las tarjetas no dicen la línea", () => {
    renderGrid([producto({ businessLineName: "Sublimación" })]);

    expect(screen.queryByTestId("fair-product-line")).toBeNull();
  });
});
