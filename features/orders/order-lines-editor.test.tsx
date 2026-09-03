import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PickableItem } from "@/lib/orders/lines";

import { OrderLinesEditor, type EditorLine } from "./order-lines-editor";

afterEach(cleanup);

const SUBLIMACION = "30000000-0000-0000-0000-000000000001";
const ALFARERIA = "30000000-0000-0000-0000-000000000003";

function product(overrides: Partial<PickableItem> & { name: string }): PickableItem {
  return {
    id: `item-${overrides.name}`,
    organizationId: "org",
    businessLineId: SUBLIMACION,
    kind: "product",
    description: null,
    unitId: null,
    category: null,
    salePrice: 45,
    minStock: null,
    archivedAt: null,
    variants: [],
    ...overrides,
  };
}

const TAZA = product({ name: "Taza para sublimación" });

const TAZA_CON_VARIANTES = product({
  name: "Taza con variantes",
  salePrice: 45,
  variants: [
    {
      id: "v-11",
      organizationId: "org",
      itemId: "item-Taza con variantes",
      name: "11oz",
      attributes: {},
      salePrice: null,
      archivedAt: null,
    },
    {
      id: "v-15",
      organizationId: "org",
      itemId: "item-Taza con variantes",
      name: "15oz",
      attributes: {},
      salePrice: 55,
      archivedAt: null,
    },
  ],
});

const CATALOGO = [
  TAZA,
  TAZA_CON_VARIANTES,
  product({ name: "Macetero de greda", businessLineId: ALFARERIA }),
  product({ name: "Caja de cartón", businessLineId: null }),
  product({ name: "Taza descatalogada", archivedAt: "2026-01-01T00:00:00Z" }),
];

function line(overrides: Partial<EditorLine> = {}): EditorLine {
  return {
    id: "linea-1",
    itemId: TAZA.id,
    variantId: null,
    description: "",
    quantity: 3,
    unitPrice: 45,
    ...overrides,
  };
}

function renderEditor(props: Partial<Parameters<typeof OrderLinesEditor>[0]> = {}) {
  const onAdd = vi.fn();
  const onUpdate = vi.fn();
  const onRemove = vi.fn();

  render(
    <OrderLinesEditor
      lines={[]}
      names={{}}
      items={CATALOGO}
      businessLineId={SUBLIMACION}
      onAdd={onAdd}
      onUpdate={onUpdate}
      onRemove={onRemove}
      {...props}
    />,
  );

  return { onAdd, onUpdate, onRemove, user: userEvent.setup() };
}

describe("OrderLinesEditor · buscador del catálogo", () => {
  it("elegir un producto sin variantes agrega la línea con cantidad 1 y su precio", async () => {
    const { onAdd, user } = renderEditor();

    await user.type(screen.getByLabelText("Agregar del catálogo"), "sublimación");
    await user.click(screen.getByRole("button", { name: /Taza para sublimación/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [added, names] = onAdd.mock.calls[0];
    expect(added).toMatchObject({
      itemId: TAZA.id,
      variantId: null,
      quantity: 1,
      unitPrice: 45,
    });
    expect(names).toEqual({ item: "Taza para sublimación", variant: null });
  });

  it("un producto con variantes exige elegir una antes de agregar", async () => {
    const { onAdd, user } = renderEditor();

    await user.type(screen.getByLabelText("Agregar del catálogo"), "variantes");
    await user.click(screen.getByRole("button", { name: /Taza con variantes/ }));

    // Todavía no se agregó nada: primero hay que decir cuál.
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/Elige una variante/)).toBeInTheDocument();
    expect(screen.getAllByTestId("variant-option")).toHaveLength(2);
  });

  it("el precio se prellena desde la variante, no desde el producto", async () => {
    const { onAdd, user } = renderEditor();

    await user.type(screen.getByLabelText("Agregar del catálogo"), "variantes");
    await user.click(screen.getByRole("button", { name: /Taza con variantes/ }));
    await user.click(screen.getByRole("button", { name: /15oz/ }));

    const [added, names] = onAdd.mock.calls[0];
    expect(added).toMatchObject({ variantId: "v-15", unitPrice: 55 });
    expect(names).toEqual({ item: "Taza con variantes", variant: "15oz" });
  });

  it("una variante sin precio propio cae al del producto", async () => {
    const { onAdd, user } = renderEditor();

    await user.type(screen.getByLabelText("Agregar del catálogo"), "variantes");
    await user.click(screen.getByRole("button", { name: /Taza con variantes/ }));
    await user.click(screen.getByRole("button", { name: /11oz/ }));

    expect(onAdd.mock.calls[0][0]).toMatchObject({ variantId: "v-11", unitPrice: 45 });
  });

  it("no ofrece archivados ni productos de otra línea, y sí los compartidos", async () => {
    const { user } = renderEditor();

    await user.type(screen.getByLabelText("Agregar del catálogo"), "a");

    const opciones = screen.getByTestId("catalog-options").textContent ?? "";
    expect(opciones).toContain("Taza para sublimación");
    expect(opciones).toContain("Caja de cartón");
    expect(opciones).not.toContain("Macetero de greda");
    expect(opciones).not.toContain("Taza descatalogada");
  });

  it("«Línea libre» agrega una fila sin producto", async () => {
    const { onAdd, user } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Línea libre/ }));

    expect(onAdd.mock.calls[0][0]).toMatchObject({
      itemId: null,
      variantId: null,
      quantity: 1,
      unitPrice: 0,
    });
  });
});

describe("OrderLinesEditor · filas y total", () => {
  it("el total sigue a las cantidades: 3 × 45 son 135", () => {
    renderEditor({
      lines: [line()],
      names: { "linea-1": { item: "Taza para sublimación", variant: null } },
    });

    expect(screen.getByTestId("line-subtotal")).toHaveTextContent("135.00");
    expect(screen.getByTestId("order-form-total")).toHaveTextContent("135.00");
  });

  it("al pasar la cantidad a 4 el total es 180", () => {
    renderEditor({
      lines: [line({ quantity: 4 })],
      names: { "linea-1": { item: "Taza para sublimación", variant: null } },
    });

    expect(screen.getByTestId("order-form-total")).toHaveTextContent("180.00");
  });

  /**
   * Con un envoltorio que sí aplica los cambios: es como se comporta dentro
   * del formulario, y es la única forma de ver el total recalcularse.
   */
  function Envoltorio({ inicial }: { inicial: EditorLine[] }) {
    const [lineas, setLineas] = useState(inicial);

    return (
      <OrderLinesEditor
        lines={lineas}
        names={{ "linea-1": { item: "Taza", variant: null } }}
        items={CATALOGO}
        businessLineId={SUBLIMACION}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onUpdate={(index, patch) =>
          setLineas((previas) =>
            previas.map((l, i) => (i === index ? { ...l, ...patch } : l)),
          )
        }
      />
    );
  }

  it("cambiar la cantidad de 3 a 4 lleva el total de 135 a 180", async () => {
    const user = userEvent.setup();
    render(<Envoltorio inicial={[line()]} />);

    expect(screen.getByTestId("order-form-total")).toHaveTextContent("135.00");

    const cantidad = screen.getByLabelText("Cantidad");
    await user.clear(cantidad);
    await user.type(cantidad, "4");

    expect(cantidad).toHaveValue(4);
    expect(screen.getByTestId("order-form-total")).toHaveTextContent("180.00");
  });

  it("el precio editado es el que queda en la línea, no el del catálogo", async () => {
    const user = userEvent.setup();
    render(<Envoltorio inicial={[line()]} />);

    const precio = screen.getByLabelText("Precio");
    await user.clear(precio);
    await user.type(precio, "40");

    // 3 × 40: el catálogo dice 45 y la línea ya no le hace caso.
    expect(precio).toHaveValue(40);
    expect(screen.getByTestId("order-form-total")).toHaveTextContent("120.00");
  });

  it("«Quitar» avisa con la posición de la fila", async () => {
    const { onRemove, user } = renderEditor({
      lines: [line(), line({ id: "linea-2", itemId: null, description: "Libre" })],
      names: { "linea-1": { item: "Taza", variant: null } },
    });

    await user.click(screen.getByRole("button", { name: "Quitar línea libre" }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("una línea libre pide descripción; una de catálogo la ofrece como opcional", () => {
    renderEditor({
      lines: [line({ itemId: null })],
      names: {},
    });

    expect(screen.getByLabelText("Descripción")).toBeInTheDocument();

    cleanup();
    renderEditor({
      lines: [line()],
      names: { "linea-1": { item: "Taza", variant: null } },
    });

    expect(
      screen.getByLabelText("Personalización (opcional)"),
    ).toBeInTheDocument();
  });

  it("muestra el error de la sección cuando no hay ninguna línea", () => {
    renderEditor({ error: "Agrega al menos una línea" });

    expect(screen.getByTestId("lines-error")).toHaveTextContent(
      "Agrega al menos una línea",
    );
    expect(screen.getByText("Sin líneas todavía")).toBeInTheDocument();
  });

  it("muestra el error de cada línea junto a su campo", () => {
    renderEditor({
      lines: [line({ quantity: 0 })],
      names: { "linea-1": { item: "Taza", variant: null } },
      lineErrors: [{ quantity: "La cantidad tiene que ser mayor que cero" }],
    });

    expect(
      screen.getByText("La cantidad tiene que ser mayor que cero"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
