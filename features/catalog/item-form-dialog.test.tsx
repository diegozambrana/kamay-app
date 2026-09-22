import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Item, ItemCategory, ItemCategoryAttribute, ItemKind } from "@/types";

import { ItemFormDialog } from "./item-form-dialog";

vi.mock("@/actions/catalog", () => ({
  createItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
  uploadItemPhoto: vi.fn(async () => undefined),
}));

import { createItem, updateItem } from "@/actions/catalog";

const ORG = "11111111-1111-1111-1111-111111111111";

function item(kind: ItemKind): Item {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    organizationId: ORG,
    businessLineId: null,
    kind,
    name: "Taza personalizada",
    description: null,
    unitId: null,
    categoryId: null,
    attributes: {},
    salePrice: kind === "product" ? 45 : null,
    minStock: kind === "supply" ? 12 : null,
    archivedAt: null,
  };
}

function renderDialog(kind: ItemKind, editing?: Item) {
  render(
    <ItemFormDialog
      open
      onOpenChange={() => {}}
      item={editing}
      lines={[]}
      units={[]}
      kind={kind}
    />,
  );
  return screen.getByRole("dialog");
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

/**
 * Escenarios del delta spec `catalog-directory`: "Los campos de un ítem
 * dependen de su tipo" (los tres primeros) y "El tipo de un ítem se fija al
 * crearlo" ("El formulario no ofrece elegir el tipo").
 */
describe("ItemFormDialog", () => {
  it("un insumo pide el mínimo y no el precio de venta", () => {
    const dialog = renderDialog("supply");

    expect(within(dialog).getByLabelText("Mínimo")).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Precio de venta referencial"),
    ).toBeNull();
  });

  it("un producto pide el precio de venta y no el mínimo", () => {
    const dialog = renderDialog("product");

    expect(
      within(dialog).getByLabelText("Precio de venta referencial"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Mínimo")).toBeNull();
  });

  it("un activo no pide precio de venta ni mínimo", () => {
    const dialog = renderDialog("asset");

    expect(
      within(dialog).queryByLabelText("Precio de venta referencial"),
    ).toBeNull();
    expect(within(dialog).queryByLabelText("Mínimo")).toBeNull();
  });

  it.each(["supply", "product", "asset"] as const)(
    "no hay selector de tipo en un %s, ni al crear ni al editar",
    (kind) => {
      const nuevo = renderDialog(kind);
      expect(within(nuevo).queryByRole("combobox", { name: "Tipo" })).toBeNull();
      expect(within(nuevo).queryByLabelText("Tipo")).toBeNull();
      cleanup();

      const edicion = renderDialog(kind, item(kind));
      expect(
        within(edicion).queryByRole("combobox", { name: "Tipo" }),
      ).toBeNull();
      expect(within(edicion).queryByLabelText("Tipo")).toBeNull();
    },
  );

  it("el alta y la edición nombran el tipo", () => {
    const nuevo = renderDialog("supply");
    expect(
      within(nuevo).getByRole("heading", { name: "Nuevo insumo" }),
    ).toBeInTheDocument();
    expect(
      within(nuevo).getByRole("button", { name: "Crear insumo" }),
    ).toBeInTheDocument();
    cleanup();

    const edicion = renderDialog("product", item("product"));
    expect(
      within(edicion).getByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();
    expect(
      within(edicion).getByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();
  });

  it("el alta de un insumo se envía como insumo, sin precio de venta", async () => {
    const user = userEvent.setup();
    const dialog = renderDialog("supply");

    await user.type(within(dialog).getByLabelText("Nombre"), "Tinta cian");
    await user.type(within(dialog).getByLabelText("Mínimo"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Crear insumo" }));

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Tinta cian",
        kind: "supply",
        salePrice: null,
        minStock: 3,
      }),
    );
  });
});

/**
 * Cambio `item-categories`, requisito "Un ítem se clasifica con una categoría
 * de su tipo", a nivel de formulario.
 */
describe("ItemFormDialog · categoría", () => {
  function categoria(
    id: string,
    name: string,
    kind: ItemKind = "supply",
    archivedAt: string | null = null,
  ): ItemCategory {
    return { id, organizationId: ORG, kind, name, archivedAt };
  }

  const SUSTRATOS = categoria("55555555-5555-4555-8555-000000000001", "Sustratos");
  const EMBALAJE = categoria("55555555-5555-4555-8555-000000000002", "Embalaje");
  const ARCHIVADA = categoria(
    "55555555-5555-4555-8555-000000000003",
    "Tintas",
    "supply",
    "2026-09-01T00:00:00Z",
  );

  function renderWith(
    props: Partial<React.ComponentProps<typeof ItemFormDialog>> = {},
  ) {
    render(
      <ItemFormDialog
        open
        onOpenChange={() => {}}
        lines={[]}
        units={[]}
        kind="supply"
        {...props}
      />,
    );
    return screen.getByRole("dialog");
  }

  async function opciones(dialog: HTMLElement) {
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Categoría" }));
    const listbox = await screen.findByRole("listbox");
    return within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent);
  }

  it("ofrece «Sin categoría» y solo las categorías que recibe, por nombre", async () => {
    // La página entrega las vigentes del tipo, ya ordenadas: el formulario no
    // añade ninguna de otro tipo ni archivada.
    const dialog = renderWith({ categories: [EMBALAJE, SUSTRATOS] });

    expect(await opciones(dialog)).toEqual(["Sin categoría", "Embalaje", "Sustratos"]);
  });

  it("guardar con «Sin categoría» envía la categoría vacía", async () => {
    const dialog = renderWith({ categories: [SUSTRATOS] });

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Tinta cian");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear insumo" }));

    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ categoryId: null }));
  });

  it("elegir una categoría la envía", async () => {
    const dialog = renderWith({ categories: [SUSTRATOS] });

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Tinta cian");
    await opciones(dialog);
    await userEvent.click(screen.getByRole("option", { name: "Sustratos" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear insumo" }));

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: SUSTRATOS.id }),
    );
  });

  it("una archivada que no es la del ítem no se ofrece", async () => {
    const dialog = renderWith({ categories: [SUSTRATOS], currentCategory: null });

    expect(await opciones(dialog)).not.toContain("Tintas (archivada)");
  });

  it("un ítem con su categoría archivada la muestra rotulada y la conserva al guardar", async () => {
    const editing = { ...item("supply"), categoryId: ARCHIVADA.id };
    const dialog = renderWith({
      item: editing,
      categories: [SUSTRATOS],
      currentCategory: ARCHIVADA,
    });

    expect(within(dialog).getByRole("combobox", { name: "Categoría" })).toHaveTextContent(
      "Tintas (archivada)",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(updateItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: editing.id, categoryId: ARCHIVADA.id }),
    );
  });

  it("sin categorías del tipo, la dueña ve el enlace a Configuración", () => {
    const dialog = renderWith({ kind: "asset", categories: [], canManageCategories: true });

    const aviso = within(dialog).getByTestId("item-category-empty");
    expect(aviso).toHaveTextContent("Aún no hay categorías de activo.");
    expect(within(aviso).getByRole("link")).toHaveAttribute(
      "href",
      "/settings/item-categories?kind=asset",
    );
  });

  it("sin categorías del tipo, el ayudante ve el aviso sin enlace", () => {
    const dialog = renderWith({ kind: "asset", categories: [], canManageCategories: false });

    const aviso = within(dialog).getByTestId("item-category-empty");
    expect(aviso).toHaveTextContent("La persona dueña las define en Configuración.");
    expect(within(aviso).queryByRole("link")).toBeNull();
  });
});

/**
 * Cambio `catalog-custom-attributes`: los campos de atributo de la categoría
 * elegida, validados como en el servidor.
 */
describe("ItemFormDialog · atributos de la categoría", () => {
  const FILAMENTO: ItemCategory = {
    id: "66666666-6666-4666-8666-000000000001",
    organizationId: ORG,
    kind: "supply",
    name: "Filamento",
    archivedAt: null,
  };
  const SUSTRATOS: ItemCategory = {
    id: "66666666-6666-4666-8666-000000000002",
    organizationId: ORG,
    kind: "supply",
    name: "Sustratos",
    archivedAt: null,
  };

  function atributo(
    overrides: Partial<ItemCategoryAttribute> & Pick<ItemCategoryAttribute, "id" | "name">,
  ): ItemCategoryAttribute {
    return {
      organizationId: ORG,
      categoryId: FILAMENTO.id,
      type: "text",
      unit: null,
      options: [],
      required: false,
      scope: "item",
      position: 1,
      archivedAt: null,
      ...overrides,
    };
  }

  const DEFINICIONES = [
    atributo({ id: "vel", name: "Velocidad recomendada", type: "number", unit: "mm/s", position: 4 }),
    atributo({ id: "marca", name: "Marca", type: "list", options: ["Sunlu", "eSun"], position: 1 }),
    atributo({ id: "tmin", name: "Temperatura mínima", type: "number", unit: "°C", position: 2 }),
    atributo({ id: "tmax", name: "Temperatura máxima", type: "number", unit: "°C", position: 3 }),
    atributo({ id: "color", name: "Color", type: "list", options: ["Negro"], scope: "variant", position: 5 }),
  ];

  function renderFilamento(editing?: Item) {
    render(
      <ItemFormDialog
        open
        onOpenChange={() => {}}
        lines={[]}
        units={[]}
        kind="supply"
        item={editing}
        categories={[FILAMENTO, SUSTRATOS]}
        currentCategory={editing?.categoryId === FILAMENTO.id ? FILAMENTO : null}
        attributeDefinitions={DEFINICIONES}
      />,
    );
    return screen.getByRole("dialog");
  }

  function etiquetas(dialog: HTMLElement) {
    const fields = within(dialog).queryByTestId("attribute-fields");
    return fields
      ? Array.from(fields.querySelectorAll("label")).map((label) => label.textContent)
      : [];
  }

  it("un filamento ofrece sus cuatro campos de ítem en orden, con su unidad, y no el color", () => {
    // «El formulario de ítem ofrece los atributos de ítem».
    const dialog = renderFilamento({ ...item("supply"), categoryId: FILAMENTO.id });

    expect(etiquetas(dialog)).toEqual([
      "Marca",
      "Temperatura mínima",
      "Temperatura máxima",
      "Velocidad recomendada",
    ]);
    expect(within(dialog).getAllByText("°C")).toHaveLength(2);
    expect(within(dialog).getByText("mm/s")).toBeInTheDocument();
    expect(within(dialog).queryByText("Color")).toBeNull();
  });

  it("sin categoría o con una sin atributos, el formulario es el de siempre", () => {
    // «Un ítem sin atributos declarados se ve como hoy» y «La definición de una
    // categoría no se aplica a otra».
    const sinCategoria = renderFilamento();
    expect(within(sinCategoria).queryByTestId("attribute-fields")).toBeNull();
    cleanup();

    const sustratos = renderFilamento({ ...item("supply"), categoryId: SUSTRATOS.id });
    expect(within(sustratos).queryByTestId("attribute-fields")).toBeNull();
  });

  it("cambiar la categoría muestra los campos de la nueva", async () => {
    // «Cambiar la categoría cambia los campos».
    const dialog = renderFilamento({ ...item("supply"), categoryId: SUSTRATOS.id });

    await userEvent.click(within(dialog).getByRole("combobox", { name: "Categoría" }));
    await userEvent.click(await screen.findByRole("option", { name: "Filamento" }));

    expect(etiquetas(dialog)).toContain("Temperatura mínima");
  });

  it("envía los valores escritos por id de atributo", async () => {
    const dialog = renderFilamento({ ...item("supply"), categoryId: FILAMENTO.id });

    await userEvent.type(within(dialog).getByLabelText("Temperatura mínima"), "190");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Marca" }));
    await userEvent.click(await screen.findByRole("option", { name: "Sunlu" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: { marca: "Sunlu", tmin: "190", tmax: "", vel: "" },
      }),
    );
  });

  it("un número mal escrito no se envía y se explica", async () => {
    // «Un valor no numérico se rechaza», nivel de formulario.
    const dialog = renderFilamento({ ...item("supply"), categoryId: FILAMENTO.id });

    await userEvent.type(within(dialog).getByLabelText("Temperatura mínima"), "caliente");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(updateItem).not.toHaveBeenCalled();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "«Temperatura mínima» tiene que ser un número.",
    );
  });

  it("los valores guardados llegan puestos", () => {
    const dialog = renderFilamento({
      ...item("supply"),
      categoryId: FILAMENTO.id,
      attributes: { tmin: 190, marca: "Sunlu" },
    });

    expect(within(dialog).getByLabelText("Temperatura mínima")).toHaveValue("190");
    expect(within(dialog).getByRole("combobox", { name: "Marca" })).toHaveTextContent("Sunlu");
  });
});
