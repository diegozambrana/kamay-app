import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemCategoryAttribute, ItemVariant } from "@/types";

import { VariantFormDialog } from "./variant-form-dialog";

vi.mock("@/actions/catalog", () => ({
  createItemVariant: vi.fn(async () => undefined),
  updateItemVariant: vi.fn(async () => undefined),
}));

import { createItemVariant, updateItemVariant } from "@/actions/catalog";

const ORG = "11111111-1111-1111-1111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";

const COLOR: ItemCategoryAttribute = {
  id: "color",
  organizationId: ORG,
  categoryId: "cat-filamento",
  name: "Color",
  type: "list",
  unit: null,
  options: ["Negro", "Rojo"],
  required: true,
  scope: "variant",
  position: 5,
  archivedAt: null,
};

function renderDialog(props: Partial<React.ComponentProps<typeof VariantFormDialog>> = {}) {
  render(
    <VariantFormDialog
      open
      onOpenChange={() => {}}
      itemId={ITEM}
      itemKind="supply"
      attributeFields={[COLOR]}
      {...props}
    />,
  );
  return screen.getByRole("dialog");
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

/** Escenarios del delta `catalog-directory` del cambio `catalog-custom-attributes`. */
describe("VariantFormDialog · atributos", () => {
  it("ofrece el nombre y el color, y ningún otro campo", () => {
    // «El formulario de variante ofrece los atributos de su categoría».
    const dialog = renderDialog();

    expect(within(dialog).getAllByRole("textbox").map((input) => input.getAttribute("name"))).toEqual([
      "name",
    ]);
    expect(within(dialog).getByRole("combobox", { name: "Color" })).toBeInTheDocument();
  });

  it("sin atributos declarados es el formulario de siempre", () => {
    const dialog = renderDialog({ attributeFields: [] });
    expect(within(dialog).queryByTestId("attribute-fields")).toBeNull();
  });

  it("sin el color obligatorio no se envía y lo dice", async () => {
    // «Un atributo obligatorio sin valor no se guarda».
    const dialog = renderDialog();

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Negro");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar variante" }));

    expect(createItemVariant).not.toHaveBeenCalled();
    expect(await within(dialog).findByText("«Color» es obligatorio.")).toBeInTheDocument();
  });

  it("con el color elegido lo envía por id de atributo", async () => {
    const dialog = renderDialog();

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Negro");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Color" }));
    await userEvent.click(await screen.findByRole("option", { name: "Negro" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar variante" }));

    expect(createItemVariant).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: ITEM, name: "Negro", attributes: { color: "Negro" } }),
    );
  });

  it("una opción retirada aparece rotulada y se envía igual si no se toca", async () => {
    // «Una opción retirada se conserva si no se toca», nivel de formulario.
    const azul: ItemVariant = {
      id: "33333333-3333-4333-8333-333333333333",
      organizationId: ORG,
      itemId: ITEM,
      name: "Azul",
      attributes: { color: "Azul" },
      salePrice: null,
      archivedAt: null,
    };
    const dialog = renderDialog({ variant: azul });

    expect(within(dialog).getByRole("combobox", { name: "Color" })).toHaveTextContent(
      "Azul (opción retirada)",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(updateItemVariant).toHaveBeenCalledWith(
      expect.objectContaining({ id: azul.id, attributes: { color: "Azul" } }),
    );
  });
});

/** Tipo `color` (design D11): selector nativo y hex escrito, sincronizados. */
describe("VariantFormDialog · color", () => {
  const TONO: ItemCategoryAttribute = { ...COLOR, id: "tono", name: "Color de rollo", type: "color", options: [], required: false };

  it("escribir el hex mueve el selector y se envía normalizado", async () => {
    // «Un color se elige con el selector o se escribe en hex», nivel de formulario.
    const dialog = renderDialog({ attributeFields: [TONO] });

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Rojo");
    await userEvent.type(within(dialog).getByLabelText("Color de rollo"), "c62828");
    expect(within(dialog).getByLabelText("Elegir Color de rollo")).toHaveValue("#c62828");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar variante" }));

    expect(createItemVariant).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: { tono: "c62828" } }),
    );
  });

  it("elegir con el selector llena el campo de hex", () => {
    const dialog = renderDialog({ attributeFields: [TONO] });

    fireEvent.input(within(dialog).getByLabelText("Elegir Color de rollo"), {
      target: { value: "#1a1a1a" },
    });

    expect(within(dialog).getByLabelText("Color de rollo")).toHaveValue("#1A1A1A");
  });

  it("un hex mal escrito no se envía", async () => {
    // «Un hex mal escrito se rechaza», nivel de formulario.
    const dialog = renderDialog({ attributeFields: [TONO] });

    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Rojo");
    await userEvent.type(within(dialog).getByLabelText("Color de rollo"), "rojizo");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar variante" }));

    expect(createItemVariant).not.toHaveBeenCalled();
    expect(
      await within(dialog).findByText("«Color de rollo» tiene que ser un color en hex, como #1A1A1A."),
    ).toBeInTheDocument();
  });
});
