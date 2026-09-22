import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemCategory, ItemCategoryAttribute } from "@/types";

vi.mock("@/actions/configuration", () => ({
  archiveConfigurationItem: vi.fn(async () => undefined),
  unarchiveConfigurationItem: vi.fn(async () => undefined),
  createItemCategoryAttribute: vi.fn(async () => undefined),
  updateItemCategoryAttribute: vi.fn(async () => undefined),
}));

import {
  archiveConfigurationItem,
  createItemCategoryAttribute,
  unarchiveConfigurationItem,
  updateItemCategoryAttribute,
} from "@/actions/configuration";

import { CategoryAttributesSection } from "./category-attributes-section";

const ORG = "11111111-1111-1111-1111-111111111111";
const FILAMENTO: ItemCategory = {
  id: "cat-filamento",
  organizationId: ORG,
  kind: "supply",
  name: "Filamento",
  archivedAt: null,
};

function attribute(
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

const TMIN = attribute({ id: "tmin", name: "Temperatura mínima", type: "number", unit: "°C", position: 1 });
const COLOR = attribute({
  id: "color",
  name: "Color",
  type: "list",
  options: ["Negro", "Blanco", "Rojo", "Azul"],
  required: true,
  scope: "variant",
  position: 2,
});
const VELOCIDAD = attribute({
  id: "vel",
  name: "Velocidad recomendada",
  type: "number",
  unit: "mm/s",
  position: 3,
  archivedAt: "2026-09-21T00:00:00Z",
});

function renderSection(attributes: ItemCategoryAttribute[] = [TMIN, COLOR]) {
  render(<CategoryAttributesSection category={FILAMENTO} attributes={attributes} />);
}

function rowOf(name: string) {
  const table = screen.getByRole("table", { name: "Atributos de Filamento" });
  return within(table).getByText(name).closest("tr")!;
}

async function choose(dialog: HTMLElement, field: string, option: string) {
  await userEvent.click(within(dialog).getByRole("combobox", { name: field }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createItemCategoryAttribute).mockResolvedValue(undefined);
});
afterEach(cleanup);

/**
 * Escenarios del delta `settings-interaction` del cambio
 * `catalog-custom-attributes`: la gestión de atributos de una categoría.
 */
describe("CategoryAttributesSection", () => {
  it("la tabla muestra cada definición, con su menú y sin botones sueltos", async () => {
    // «The attributes table shows each definition».
    renderSection();

    const table = screen.getByRole("table", { name: "Atributos de Filamento" });
    const tmin = within(table).getByText("Temperatura mínima").closest("tr")!;
    const color = within(table).getByText("Color").closest("tr")!;
    expect(tmin).toHaveTextContent("Número (°C)");
    expect(tmin).toHaveTextContent("Ítem");
    expect(color).toHaveTextContent("Lista (4 opciones)");
    expect(color).toHaveTextContent("Obligatorio");
    expect(color).toHaveTextContent("Variante");
    expect(
      within(color)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Acciones de Color"]);

    await userEvent.click(within(color).getByRole("button", { name: "Acciones de Color" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Editar",
      "Archivar",
    ]);
  });

  it("sin atributos muestra su vacío y ninguna tabla", () => {
    // «A category without attributes shows its empty state».
    renderSection([]);

    expect(screen.getByText("Aún no hay atributos en esta categoría")).toBeInTheDocument();
    expect(screen.getByText("Usa «Nuevo atributo» para agregar el primero.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("la vuelta lleva a la pestaña del tipo de la categoría", () => {
    // «Back to the categories».
    renderSection();

    expect(screen.getByRole("link", { name: "Categorías de ítem" })).toHaveAttribute(
      "href",
      "/settings/item-categories?kind=supply",
    );
    expect(screen.getByRole("heading", { name: "Atributos de «Filamento»" })).toBeInTheDocument();
  });

  it("crear una lista obligatoria de variante llama a la acción y cierra", async () => {
    // «Owner creates a list attribute» y «Owner declares the attributes of a
    // category», nivel de interfaz.
    renderSection([TMIN]);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo atributo" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo atributo" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Color");
    await choose(dialog, "Tipo", "Lista");
    await userEvent.type(within(dialog).getByLabelText("Opciones"), "Negro{enter}Blanco{enter}Rojo{enter}Azul");
    await userEvent.click(within(dialog).getByLabelText("Obligatorio"));
    await choose(dialog, "Aplica a", "Variante");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear atributo" }));

    expect(createItemCategoryAttribute).toHaveBeenCalledWith({
      categoryId: FILAMENTO.id,
      name: "Color",
      type: "list",
      scope: "variant",
      required: true,
      unit: null,
      options: ["Negro", "Blanco", "Rojo", "Azul"],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("con un nombre repetido, el diálogo sigue abierto con lo escrito", async () => {
    // «Duplicate attribute name in the same category is rejected», nivel de interfaz.
    vi.mocked(createItemCategoryAttribute).mockResolvedValue({
      error: "Ya existe un atributo con ese nombre en esta categoría.",
    });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo atributo" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo atributo" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "color ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear atributo" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ya existe un atributo con ese nombre en esta categoría.",
    );
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("color ");
  });

  it("archivar avisa que los valores se conservan y llama a la acción", async () => {
    // «Archiving warns that values are kept».
    renderSection();

    await userEvent.click(within(rowOf("Temperatura mínima")).getByRole("button", { name: "Acciones de Temperatura mínima" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Los valores que ya se guardaron se conservan");
    await userEvent.click(within(confirm).getByRole("button", { name: "Archivar" }));

    expect(archiveConfigurationItem).toHaveBeenCalledWith({
      entity: "itemCategoryAttribute",
      id: "tmin",
    });
  });

  it("un archivado va a su tabla y ofrece solo «Restaurar»", async () => {
    // «Restoring an attribute offers it again», nivel de interfaz.
    renderSection([TMIN, VELOCIDAD]);

    const archived = screen.getByRole("table", { name: "Archivados" });
    await userEvent.click(
      within(archived).getByRole("button", { name: "Acciones de Velocidad recomendada" }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Restaurar",
    ]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Restaurar" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    );

    expect(unarchiveConfigurationItem).toHaveBeenCalledWith({
      entity: "itemCategoryAttribute",
      id: "vel",
    });
  });
});

describe("AttributeDialog", () => {
  it("Unidad aparece solo para números y Opciones solo para listas", async () => {
    // «Unit appears only for numbers».
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Nuevo atributo" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo atributo" });

    expect(within(dialog).queryByLabelText("Unidad")).toBeNull();
    expect(within(dialog).queryByLabelText("Opciones")).toBeNull();

    await choose(dialog, "Tipo", "Número");
    expect(within(dialog).getByLabelText("Unidad")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Opciones")).toBeNull();

    await choose(dialog, "Tipo", "Lista");
    expect(within(dialog).queryByLabelText("Unidad")).toBeNull();
    expect(within(dialog).getByLabelText("Opciones")).toBeInTheDocument();
  });

  it("editar no ofrece Tipo ni Aplica a, y viene con lo guardado", async () => {
    // «Editing does not offer type or scope».
    renderSection();

    await userEvent.click(within(rowOf("Temperatura mínima")).getByRole("button", { name: "Acciones de Temperatura mínima" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar atributo" });

    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Temperatura mínima");
    expect(within(dialog).getByLabelText("Unidad")).toHaveValue("°C");
    expect(within(dialog).getByLabelText("Obligatorio")).not.toBeChecked();
    expect(within(dialog).queryByRole("combobox", { name: "Tipo" })).toBeNull();
    expect(within(dialog).queryByRole("combobox", { name: "Aplica a" })).toBeNull();

    await userEvent.clear(within(dialog).getByLabelText("Nombre"));
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Temperatura de boquilla");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(updateItemCategoryAttribute).toHaveBeenCalledWith({
      id: "tmin",
      name: "Temperatura de boquilla",
      unit: "°C",
      options: [],
      required: false,
    });
  });

  it("editar una lista trae sus opciones, una por línea", async () => {
    renderSection();

    await userEvent.click(within(rowOf("Color")).getByRole("button", { name: "Acciones de Color" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar atributo" });

    expect(within(dialog).getByLabelText("Opciones")).toHaveValue("Negro\nBlanco\nRojo\nAzul");
    expect(within(dialog).getByLabelText("Obligatorio")).toBeChecked();
  });
});

describe("AttributeDialog · tipo color", () => {
  it("Color no pide unidad ni opciones, y se crea con su tipo", async () => {
    // «A color attribute asks for neither unit nor options».
    renderSection([]);
    await userEvent.click(screen.getByRole("button", { name: "Nuevo atributo" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo atributo" });

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Color de rollo");
    await choose(dialog, "Tipo", "Color");
    expect(within(dialog).queryByLabelText("Unidad")).toBeNull();
    expect(within(dialog).queryByLabelText("Opciones")).toBeNull();
    await choose(dialog, "Aplica a", "Variante");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear atributo" }));

    expect(createItemCategoryAttribute).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Color de rollo", type: "color", scope: "variant", unit: null, options: [] }),
    );
  });

  it("la tabla rotula el tipo como «Color»", () => {
    renderSection([{ ...TMIN, id: "tono", name: "Color de rollo", type: "color", unit: null }]);
    expect(rowOf("Color de rollo")).toHaveTextContent("Color");
  });
});
