import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Role, Unit } from "@/types";

import { CatalogScreen, type CatalogRow } from "./catalog-screen";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/actions/catalog", () => ({
  setItemArchived: vi.fn(async () => undefined),
  createItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
  uploadItemPhoto: vi.fn(async () => undefined),
}));

import { setItemArchived } from "@/actions/catalog";

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

function item(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    businessLineId: LINE.id,
    kind: "supply",
    name: "Taza para sublimación",
    description: null,
    unitId: UNIT.id,
    category: null,
    salePrice: 45,
    minStock: null,
    archivedAt: null,
    photoUrl: null,
    ...overrides,
  };
}

function renderScreen(
  items: CatalogRow[],
  role: Role = "owner",
  includeArchived = false,
) {
  return render(
    <CatalogScreen
      items={items}
      lines={[LINE]}
      units={[UNIT]}
      kind="supply"
      lineFilter="all"
      search=""
      includeArchived={includeArchived}
      role={role}
      activeLineId={null}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CatalogScreen", () => {
  it("la pestaña elegida navega al tipo pedido", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    // ToggleGroup de selección única: sus opciones son radios, no pestañas.
    await user.click(screen.getByRole("radio", { name: "Productos" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("kind=product"));
  });

  it("«Ver archivados» viaja en la dirección, no filtra en memoria", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    await user.click(screen.getByTestId("catalog-archived"));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("archived=1"));
  });

  it("un ítem sin línea se muestra como Compartido", () => {
    renderScreen([item({ businessLineId: null })]);

    // "Compartido" también es una opción del filtro: se busca en la fila.
    expect(screen.getByTestId("catalog-row").textContent).toContain(
      "Compartido",
    );
  });

  // Escenario "Sin columnas de inventario ni costo": el inventario llegó con
  // KAM-18 y la prohibición sigue en pie. Lo que se añadió es un distintivo,
  // no una cifra.
  it("no muestra saldo ni último costo, tampoco con el inventario construido", () => {
    renderScreen([item({ belowMin: true })]);

    expect(screen.queryByText(/saldo/i)).toBeNull();
    expect(screen.queryByText(/último costo/i)).toBeNull();
  });

  // Escenario "Distintivo de insumo bajo mínimo".
  it("marca el insumo bajo mínimo sin enseñar la cifra", () => {
    const bajo = item({ belowMin: true, minStock: 100 });
    renderScreen([bajo]);

    const distintivo = screen.getByTestId(`below-min-${bajo.id}`);
    expect(distintivo).toHaveTextContent("Bajo mínimo");
    // El número vive en el detalle, que está a un toque.
    expect(distintivo.textContent).not.toMatch(/\d/);
  });

  // Escenario "Insumo sin mínimo declarado": sin mínimo no hay alerta posible.
  it("un insumo sin mínimo declarado no lleva distintivo", () => {
    const sano = item({ minStock: null });
    renderScreen([sano]);

    expect(screen.queryByTestId(`below-min-${sano.id}`)).toBeNull();
  });

  it("el dueño ve archivar en el menú; el ayudante no lo ve ni deshabilitado", async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen([item()], "owner");

    await user.click(screen.getByRole("button", { name: "Acciones" }));
    expect(
      await screen.findByRole("menuitem", { name: "Archivar" }),
    ).toBeInTheDocument();
    unmount();

    renderScreen([item()], "assistant");
    await user.click(screen.getByRole("button", { name: "Acciones" }));
    expect(await screen.findByRole("menuitem", { name: "Ver" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Archivar" })).toBeNull();
  });

  it("archivar desde el menú pide confirmación antes de tocar nada", async () => {
    const user = userEvent.setup();
    renderScreen([item()], "owner");

    await user.click(screen.getByRole("button", { name: "Acciones" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archivar" }));

    expect(setItemArchived).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "¿Archivar este ítem?",
    );

    await user.click(screen.getByRole("button", { name: "Archivar" }));
    expect(setItemArchived).toHaveBeenCalledWith({
      id: expect.any(String),
      archived: true,
    });
  });

  it("la miniatura de la foto abre la fila", () => {
    renderScreen([item({ photoUrl: "https://firmada/taza.jpg" })]);

    expect(screen.getByTestId("item-thumbnail")).toBeInTheDocument();
  });

  it("«Nuevo ítem» abre un diálogo, no un formulario incrustado", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    expect(screen.queryByTestId("item-form")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nuevo ítem" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Nuevo ítem");
    expect(screen.getByTestId("item-form")).toBeInTheDocument();
  });

  it("el tipo elegido en las pestañas llega al diálogo", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    await user.click(screen.getByRole("button", { name: "Nuevo ítem" }));

    // El desplegable de shadcn no es un <select>: muestra el valor en su
    // disparador, y es lo que el formulario enviará.
    expect(screen.getByLabelText("Tipo")).toHaveTextContent("Insumo");
  });

  it("un archivado se distingue y solo ofrece verlo o devolverlo", async () => {
    const user = userEvent.setup();
    renderScreen([item({ archivedAt: "2026-08-26T12:00:00Z" })], "owner", true);

    expect(screen.getByTestId("catalog-row")).toHaveAttribute(
      "data-archived",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Acciones" }));
    expect(
      await screen.findByRole("menuitem", { name: "Desarchivar" }),
    ).toBeInTheDocument();
    // Editar un archivado exige desarchivarlo primero.
    expect(screen.queryByRole("menuitem", { name: "Editar" })).toBeNull();
  });
});

/**
 * Escenario del delta spec `catalog-directory`, requisito "Un ítem declara su
 * tipo, su unidad y su alcance de línea": "Un activo sin datos declarados
 * sigue siendo un ítem válido".
 */
describe("CatalogScreen · un activo sin datos declarados", () => {
  it("se lista con normalidad, sin marca de incompleto", () => {
    renderScreen([
      item({ kind: "asset", name: "Impresora 3D", salePrice: null, unitId: null }),
    ]);

    const row = screen.getByText("Impresora 3D").closest("tr")!;
    expect(row).toBeInTheDocument();
    // El costo y la fecha son datos de la capacidad de activos y llegan
    // aparte: su ausencia no descalifica al ítem en el catálogo.
    expect(row).not.toHaveAttribute("data-incomplete");
    expect(within(row).queryByText(/incompleto/i)).toBeNull();
  });
});
