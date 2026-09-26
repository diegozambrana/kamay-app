import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemCategoryAttribute } from "@/types";

import { VariantsList } from "./variants-list";

vi.mock("@/actions/catalog", () => ({
  createItemVariant: vi.fn(async () => undefined),
  updateItemVariant: vi.fn(async () => undefined),
  setItemVariantArchived: vi.fn(async () => undefined),
}));

import { createItemVariant } from "@/actions/catalog";

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
  required: false,
  scope: "variant",
  position: 1,
  archivedAt: null,
};

function renderList() {
  render(
    <VariantsList
      itemId={ITEM}
      itemKind="supply"
      variants={[]}
      role="owner"
      readOnly={false}
      attributeFields={[COLOR]}
    />,
  );
}

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Agregar variante" }));
  return screen.findByRole("dialog");
}

async function closed() {
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

/**
 * Escenario «El alta de variante empieza en blanco» del delta
 * `catalog-directory` del cambio `catalog-create-form-reset`.
 */
describe("VariantsList · el alta de variante se abre en blanco", () => {
  it("después de agregar una, el nombre y los atributos están vacíos", async () => {
    const user = userEvent.setup();
    renderList();

    let dialog = await openCreate(user);
    await user.type(within(dialog).getByLabelText("Nombre"), "Negro");
    await user.click(within(dialog).getByRole("combobox", { name: "Color" }));
    await user.click(await screen.findByRole("option", { name: "Negro" }));
    await user.click(within(dialog).getByRole("button", { name: "Agregar variante" }));
    await closed();
    expect(createItemVariant).toHaveBeenCalledTimes(1);

    dialog = await openCreate(user);
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("");
    expect(within(dialog).getByRole("combobox", { name: "Color" })).not.toHaveTextContent("Negro");
  });

  it("el error de la apertura anterior no reaparece", async () => {
    const user = userEvent.setup();
    vi.mocked(createItemVariant).mockResolvedValueOnce({ error: "Ya existe esa variante." });
    renderList();

    let dialog = await openCreate(user);
    await user.type(within(dialog).getByLabelText("Nombre"), "Negro");
    await user.click(within(dialog).getByRole("button", { name: "Agregar variante" }));
    expect(await within(dialog).findByText("Ya existe esa variante.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await closed();

    dialog = await openCreate(user);
    expect(within(dialog).queryByText("Ya existe esa variante.")).toBeNull();
  });
});
