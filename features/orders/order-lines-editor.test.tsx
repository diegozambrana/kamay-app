import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PickableItem } from "@/lib/orders/lines";

import {
  OrderLinesEditor,
  type AddedLine,
  type EditorLine,
} from "./order-lines-editor";

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
    categoryId: null,
    attributes: {},
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
  product({ name: "Caja de cartón", businessLineId: null, salePrice: null }),
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

/** Abre el diálogo de catálogo y devuelve su contenedor. */
async function abrirCatalogo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Agregar del catálogo" }));
  return screen.findByRole("dialog", { name: "Agregar del catálogo" });
}

const opcion = (dialog: HTMLElement, name: RegExp) =>
  within(dialog).getByRole("option", { name });

/** Lo que recibió `onAdd` en su única llamada, aplanado. */
function agregadas(onAdd: ReturnType<typeof vi.fn>): AddedLine[] {
  expect(onAdd).toHaveBeenCalledTimes(1);
  return onAdd.mock.calls[0][0] as AddedLine[];
}

describe("OrderLinesEditor · diálogo de catálogo", () => {
  it("Elegir un producto prellena el precio: cantidad 1 y el referencial", async () => {
    const { onAdd, user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    await user.click(opcion(dialog, /Taza para sublimación/));
    await user.click(within(dialog).getByRole("button", { name: "Agregar (1)" }));

    const [{ line: added, names }] = agregadas(onAdd);
    expect(added).toMatchObject({
      itemId: TAZA.id,
      variantId: null,
      quantity: 1,
      unitPrice: 45,
    });
    expect(names).toEqual({ item: "Taza para sublimación", variant: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Selección múltiple: tres opciones son tres líneas, en el orden de la lista", async () => {
    const { onAdd, user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    await user.click(opcion(dialog, /Caja de cartón/));
    await user.click(opcion(dialog, /Taza para sublimación/));
    await user.click(opcion(dialog, /15oz/));
    await user.click(within(dialog).getByRole("button", { name: "Agregar (3)" }));

    const lines = agregadas(onAdd);
    expect(lines.map(({ names }) => [names.item, names.variant])).toEqual([
      ["Taza para sublimación", null],
      ["Taza con variantes", "15oz"],
      ["Caja de cartón", null],
    ]);
    expect(lines.map(({ line: l }) => [l.quantity, l.unitPrice])).toEqual([
      [1, 45],
      [1, 55],
      [1, 0],
    ]);
    // Cada línea con su propio identificador.
    expect(new Set(lines.map(({ line: l }) => l.id)).size).toBe(3);
  });

  it("Agregar deshabilitado sin selección", async () => {
    const { user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    expect(within(dialog).getByRole("button", { name: "Agregar" })).toBeDisabled();
  });

  it("Cancelar descarta la selección y al reabrir no hay nada marcado", async () => {
    const { onAdd, user } = renderEditor();
    let dialog = await abrirCatalogo(user);

    await user.click(opcion(dialog, /Taza para sublimación/));
    await user.click(opcion(dialog, /Caja de cartón/));
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onAdd).not.toHaveBeenCalled();

    dialog = await abrirCatalogo(user);
    expect(
      within(dialog)
        .getAllByRole("option")
        .filter((option) => option.getAttribute("aria-checked") === "true"),
    ).toHaveLength(0);
  });

  it("El filtro conserva lo marcado", async () => {
    const { onAdd, user } = renderEditor();
    const dialog = await abrirCatalogo(user);
    const filtro = within(dialog).getByRole("combobox", { name: "Buscar un producto" });

    await user.click(opcion(dialog, /Taza para sublimación/));
    await user.type(filtro, "carton");
    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    await user.click(opcion(dialog, /Caja de cartón/));
    await user.click(within(dialog).getByRole("button", { name: "Agregar (2)" }));

    expect(agregadas(onAdd).map(({ names }) => names.item)).toEqual([
      "Taza para sublimación",
      "Caja de cartón",
    ]);
  });

  it("El filtro ignora acentos y mayúsculas", async () => {
    const { user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    await user.type(
      within(dialog).getByRole("combobox", { name: "Buscar un producto" }),
      "SUBLIMACION",
    );

    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    expect(opcion(dialog, /Taza para sublimación/)).toBeInTheDocument();
  });

  it("Producto con variantes: una opción por variante, con su precio o el del producto", async () => {
    const { onAdd, user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    const variantes = within(dialog)
      .getAllByRole("option")
      .filter((option) => option.textContent?.includes("Taza con variantes"));
    expect(variantes.map((option) => option.textContent)).toEqual([
      "Taza con variantes · 11oz45.00",
      "Taza con variantes · 15oz55.00",
    ]);

    await user.click(opcion(dialog, /11oz/));
    await user.click(opcion(dialog, /15oz/));
    await user.click(within(dialog).getByRole("button", { name: "Agregar (2)" }));

    expect(agregadas(onAdd).map(({ line: l }) => [l.variantId, l.unitPrice])).toEqual([
      ["v-11", 45],
      ["v-15", 55],
    ]);
  });

  it("Producto sin precio referencial: nace con precio 0", async () => {
    const { onAdd, user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    await user.click(opcion(dialog, /Caja de cartón/));
    await user.click(within(dialog).getByRole("button", { name: "Agregar (1)" }));

    expect(agregadas(onAdd)[0].line).toMatchObject({ quantity: 1, unitPrice: 0 });
  });

  it("Producto ya presente en el pedido: se agrega otra línea", async () => {
    const { onAdd, user } = renderEditor({
      lines: [line()],
      names: { "linea-1": { item: "Taza para sublimación", variant: null } },
    });
    const dialog = await abrirCatalogo(user);

    await user.click(opcion(dialog, /Taza para sublimación/));
    await user.click(within(dialog).getByRole("button", { name: "Agregar (1)" }));

    const [{ line: added }] = agregadas(onAdd);
    expect(added.itemId).toBe(TAZA.id);
    expect(added.id).not.toBe("linea-1");
  });

  it("Productos fuera de alcance no se ofrecen: ni archivados ni de otra línea", async () => {
    const { user } = renderEditor();
    const dialog = await abrirCatalogo(user);

    const opciones = within(dialog)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(opciones.some((text) => text.includes("Taza para sublimación"))).toBe(true);
    expect(opciones.some((text) => text.includes("Caja de cartón"))).toBe(true);
    expect(opciones.some((text) => text.includes("Macetero de greda"))).toBe(false);
    expect(opciones.some((text) => text.includes("Taza descatalogada"))).toBe(false);
  });

  it("Acciones al final de las líneas: los dos botones van después de la última fila", () => {
    renderEditor({
      lines: [line(), line({ id: "linea-2" })],
      names: {},
    });

    const rows = screen.getAllByTestId("order-line-row");
    const actions = screen.getByTestId("order-lines-actions");
    expect(
      rows[rows.length - 1].compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(actions).getByRole("button", { name: "Agregar del catálogo" }),
    ).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: /Línea libre/ })).toBeInTheDocument();
  });

  it("Línea libre: agrega una fila sin producto", async () => {
    const { onAdd, user } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Línea libre/ }));

    expect(agregadas(onAdd)[0].line).toMatchObject({
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
