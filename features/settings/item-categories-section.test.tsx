import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemCategory, ItemKind } from "@/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/item-categories",
  useRouter: () => ({ push }),
}));

vi.mock("@/actions/configuration", () => ({
  archiveConfigurationItem: vi.fn(async () => undefined),
  unarchiveConfigurationItem: vi.fn(async () => undefined),
  createItemCategory: vi.fn(async () => undefined),
  updateItemCategory: vi.fn(async () => undefined),
}));

import {
  createItemCategory,
  unarchiveConfigurationItem,
} from "@/actions/configuration";

import { ItemCategoriesSection } from "./item-categories-section";

const ORG = "11111111-1111-1111-1111-111111111111";

function category(
  name: string,
  kind: ItemKind = "supply",
  archivedAt: string | null = null,
): ItemCategory {
  return { id: `id-${name}`, organizationId: ORG, kind, name, archivedAt };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createItemCategory).mockResolvedValue(undefined);
});
afterEach(cleanup);

/**
 * Escenarios de los deltas `settings-interaction` y `org-configuration` para
 * la sección «Categorías de ítem».
 */
describe("ItemCategoriesSection", () => {
  // «An item category row offers its actions from the menu» y, del cambio
  // `catalog-custom-attributes`, «A category row offers its attributes».
  it("la fila ofrece «Editar», «Atributos» y «Archivar» en su menú y ningún otro botón", async () => {
    render(<ItemCategoriesSection kind="supply" categories={[category("Sustratos")]} />);

    const table = screen.getByRole("table", { name: "Categorías de insumos" });
    const row = within(table).getByText("Sustratos").closest("tr")!;
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Acciones de Sustratos"]);

    await userEvent.click(within(row).getByRole("button", { name: "Acciones de Sustratos" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Editar",
      "Atributos",
      "Archivar",
    ]);
    expect(within(menu).getByRole("menuitem", { name: "Atributos" })).toHaveAttribute(
      "href",
      "/settings/item-categories/id-Sustratos",
    );
  });

  it("un tipo sin categorías muestra su vacío con el nombre del tipo", () => {
    render(<ItemCategoriesSection kind="asset" categories={[]} />);

    expect(screen.getByText("Aún no hay categorías de activo")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("«Nueva categoría» en Productos crea una categoría de producto", async () => {
    render(<ItemCategoriesSection kind="product" categories={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Nueva categoría de producto",
    });
    // Solo el nombre: el tipo lo fija la pestaña.
    expect(within(dialog).getAllByRole("textbox")).toHaveLength(1);
    expect(within(dialog).queryByRole("combobox")).toBeNull();

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Vajilla");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear categoría" }));

    expect(createItemCategory).toHaveBeenCalledWith({ name: "Vajilla", kind: "product" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("con un nombre repetido, el diálogo sigue abierto con lo escrito", async () => {
    vi.mocked(createItemCategory).mockResolvedValue({
      error: "Ya existe un registro con ese nombre.",
    });
    render(<ItemCategoriesSection kind="supply" categories={[category("Sustratos")]} />);

    await userEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva categoría de insumo" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "sustratos ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear categoría" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ya existe un registro con ese nombre.",
    );
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("sustratos ");
  });

  it("«Editar» abre el diálogo con el título del tipo y el nombre actual", async () => {
    render(<ItemCategoriesSection kind="supply" categories={[category("Sustratos")]} />);

    const table = screen.getByRole("table", { name: "Categorías de insumos" });
    await userEvent.click(within(table).getByRole("button", { name: "Acciones de Sustratos" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar categoría de insumo" });
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Sustratos");
  });

  it("«Restaurar» en una archivada pide confirmación y la restaura", async () => {
    render(
      <ItemCategoriesSection
        kind="supply"
        categories={[category("Sustratos"), category("Embalaje", "supply", "2026-09-01T00:00:00Z")]}
      />,
    );

    const archived = screen.getByRole("table", { name: "Archivados" });
    await userEvent.click(within(archived).getByRole("button", { name: "Acciones de Embalaje" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Restaurar" }));

    expect(unarchiveConfigurationItem).not.toHaveBeenCalled();
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    );
    expect(unarchiveConfigurationItem).toHaveBeenCalledWith({
      entity: "itemCategory",
      id: "id-Embalaje",
    });
  });

  it("elegir otra pestaña navega con su tipo", async () => {
    render(<ItemCategoriesSection kind="supply" categories={[]} />);

    await userEvent.click(screen.getByRole("radio", { name: "Activos" }));

    expect(push).toHaveBeenCalledWith("/settings/item-categories?kind=asset");
  });
});
