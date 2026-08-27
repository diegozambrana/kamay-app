import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Item, ItemVariant, Role, Unit } from "@/types";

import { ItemDetail } from "./item-detail";
import type { ItemPhoto } from "./item-photos";

import { setItemPhotoArchived } from "@/actions/catalog";

vi.mock("@/actions/catalog", () => ({
  setItemArchived: vi.fn(async () => undefined),
  setItemPhotoArchived: vi.fn(async () => undefined),
  uploadItemPhoto: vi.fn(async () => undefined),
  createItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
  createItemVariant: vi.fn(async () => ({
    error: "Ese ítem ya tiene una variante con ese nombre.",
  })),
  updateItemVariant: vi.fn(async () => undefined),
  setItemVariantArchived: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE: BusinessLine = {
  id: "22222222-2222-2222-2222-222222222222",
  organizationId: ORG,
  name: "Sublimación",
  color: "blue",
  icon: null,
  isShared: false,
  position: 1,
  archivedAt: null,
};
const UNIT: Unit = {
  id: "33333333-3333-3333-3333-333333333333",
  organizationId: ORG,
  code: "u",
  name: "Unidad",
  archivedAt: null,
};

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    organizationId: ORG,
    businessLineId: LINE.id,
    kind: "supply",
    name: "Taza para sublimación",
    description: null,
    unitId: UNIT.id,
    category: null,
    salePrice: null,
    minStock: null,
    archivedAt: null,
    ...overrides,
  };
}

function variant(name: string): ItemVariant {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    itemId: "44444444-4444-4444-4444-444444444444",
    name,
    attributes: {},
    salePrice: null,
    archivedAt: null,
  };
}

function photo(overrides: Partial<ItemPhoto> = {}): ItemPhoto {
  return {
    id: "77777777-7777-7777-7777-777777777777",
    organizationId: ORG,
    entityType: "item",
    entityId: "44444444-4444-4444-4444-444444444444",
    bucket: "item-photos",
    storagePath: `${ORG}/item/x/y.png`,
    fileName: "taza.png",
    mimeType: "image/png",
    sizeBytes: 120_000,
    createdAt: "2026-08-26T12:00:00Z",
    archivedAt: null,
    url: "https://firmada/taza.png",
    ...overrides,
  };
}

function renderDetail(
  overrides: Partial<Item> = {},
  role: Role = "owner",
  variants: ItemVariant[] = [],
  photos: ItemPhoto[] = [],
) {
  return render(
    <ItemDetail
      item={item(overrides)}
      variants={variants}
      photos={photos}
      lines={[LINE]}
      units={[UNIT]}
      history={[]}
      role={role}
      timeZone="America/La_Paz"
    />,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("ItemDetail", () => {
  it("un ítem sin línea se muestra como Compartido", () => {
    renderDetail({ businessLineId: null });

    expect(screen.getByTestId("item-line")).toHaveTextContent("Compartido");
  });

  it("un ítem archivado no ofrece edición, solo desarchivar", () => {
    renderDetail({ archivedAt: "2026-08-26T12:00:00Z" });

    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Desarchivar" }),
    ).toBeInTheDocument();
  });

  it("no muestra secciones de inventario ni de costos", () => {
    renderDetail({}, "owner", [variant("11oz")]);

    for (const forbidden of [
      /saldo/i,
      /último costo/i,
      /evolución de precios/i,
      /proveedores habituales/i,
      /tareas relacionadas/i,
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("el historial no se renderiza para el ayudante", () => {
    const { unmount } = renderDetail({}, "owner");
    expect(screen.getByText("Historial")).toBeInTheDocument();
    unmount();

    renderDetail({}, "assistant");
    expect(screen.queryByText("Historial")).toBeNull();
  });

  it("muestra la fotografía subida, con su nombre y su peso", () => {
    renderDetail({}, "owner", [], [photo()]);

    expect(screen.getByRole("img", { name: /taza\.png/ })).toHaveAttribute(
      "src",
      "https://firmada/taza.png",
    );
    expect(screen.getByTestId("item-photo")).toHaveTextContent("117 KB");
  });

  it("sin fotografía lo dice y señala dónde adjuntarla", () => {
    renderDetail();

    expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
    expect(screen.getByText(/desde «Editar»/)).toBeInTheDocument();
  });

  it("una firma caducada deja la tarjeta sin imagen, no sin datos", () => {
    renderDetail({}, "owner", [], [photo({ url: null })]);

    expect(screen.queryByRole("img", { name: /taza\.png/ })).toBeNull();
    expect(screen.getByTestId("item-photo")).toHaveTextContent("taza.png");
  });

  it("quitar la foto es del dueño y pide confirmación", async () => {
    const user = userEvent.setup();
    const { unmount } = renderDetail({}, "assistant", [], [photo()]);
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    unmount();

    renderDetail({}, "owner", [], [photo()]);
    await user.click(screen.getByRole("button", { name: "Quitar" }));

    expect(setItemPhotoArchived).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "¿Quitar esta fotografía?",
    );

    // El botón de la tarjeta y el del diálogo se llaman igual: se toma el
    // del diálogo, que es el que confirma.
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Quitar",
      }),
    );
    expect(setItemPhotoArchived).toHaveBeenCalledWith({
      id: photo().id,
      itemId: "44444444-4444-4444-4444-444444444444",
      archived: true,
    });
  });

  it("un ítem archivado no ofrece quitar la foto", () => {
    renderDetail({ archivedAt: "2026-08-26T12:00:00Z" }, "owner", [], [photo()]);

    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
  });

  it("una variante duplicada muestra el error que devuelve el servidor", async () => {
    const user = userEvent.setup();
    renderDetail({}, "owner", [variant("11oz")]);

    await user.click(screen.getByRole("button", { name: "Agregar variante" }));
    await user.type(screen.getByLabelText("Nombre"), "11oz");
    await user.click(screen.getByRole("button", { name: "Agregar variante" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ese ítem ya tiene una variante con ese nombre.",
    );
  });
});
