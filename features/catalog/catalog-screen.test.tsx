import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, ItemCategory, ItemKind, Role, Unit } from "@/types";

import { CatalogScreen, type CatalogRow } from "./catalog-screen";

const push = vi.fn();
const direccion = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/catalog",
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(direccion.query),
}));

vi.mock("@/actions/catalog", () => ({
  setItemArchived: vi.fn(async () => undefined),
  createItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
  uploadItemPhoto: vi.fn(async () => undefined),
}));

import { createItem, setItemArchived } from "@/actions/catalog";

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
    categoryId: null,
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
  kind: ItemKind = "supply",
) {
  return render(
    <CatalogScreen
      items={items}
      lines={[LINE]}
      units={[UNIT]}
      kind={kind}
      lineFilter="all"
      search=""
      includeArchived={includeArchived}
      role={role}
      activeLineId={null}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  direccion.query = "";
});
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

  it("«Nuevo insumo» abre un diálogo, no un formulario incrustado", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    expect(screen.queryByTestId("item-form")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nuevo insumo" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("item-form")).toBeInTheDocument();
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

/**
 * Escenarios del delta spec `catalog-directory`, requisito "Pantalla de
 * catálogo (V10)", y "El alta toma el tipo de la pestaña" del requisito "El
 * tipo de un ítem se fija al crearlo", a nivel de pantalla.
 */
describe("CatalogScreen · lo que muestra cada pestaña", () => {
  const priceHeader = () =>
    screen.queryByRole("columnheader", { name: "Precio de venta" });

  it("en productos, la fila muestra su precio de venta", () => {
    renderScreen(
      [item({ kind: "product", name: "Taza personalizada", salePrice: 45 })],
      "owner",
      false,
      "product",
    );

    expect(priceHeader()).toBeInTheDocument();
    expect(screen.getByTestId("catalog-row")).toHaveTextContent("45.00");
  });

  it.each(["supply", "asset"] as const)(
    "en la pestaña %s no hay columna de precio de venta",
    (kind) => {
      // Aunque la fila arrastre un precio de antes, la columna no existe.
      renderScreen([item({ kind, salePrice: 30 })], "owner", false, kind);

      expect(priceHeader()).toBeNull();
      expect(screen.getByTestId("catalog-row")).not.toHaveTextContent("30.00");
    },
  );

  it.each([
    ["supply", "Nuevo insumo"],
    ["product", "Nuevo producto"],
    ["asset", "Nuevo activo"],
  ] as const)("en la pestaña %s el botón de alta dice «%s»", (kind, label) => {
    renderScreen([item({ kind })], "owner", false, kind);

    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo ítem" })).toBeNull();
  });

  it("«Nuevo insumo» abre el alta de insumo, sin tipo ni precio de venta", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    await user.click(screen.getByRole("button", { name: "Nuevo insumo" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Nuevo insumo" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox", { name: "Tipo" })).toBeNull();
    expect(
      within(dialog).queryByLabelText("Precio de venta referencial"),
    ).toBeNull();
  });

  it("el alta desde la pestaña de insumos se crea como insumo", async () => {
    const user = userEvent.setup();
    renderScreen([item()]);

    await user.click(screen.getByRole("button", { name: "Nuevo insumo" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Tinta cian");
    await user.click(within(dialog).getByRole("button", { name: "Crear insumo" }));

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tinta cian", kind: "supply" }),
    );
  });

  it("el vacío inicial de activos ofrece crear el primer activo", async () => {
    const user = userEvent.setup();
    renderScreen([], "owner", false, "asset");

    await user.click(
      screen.getByRole("button", { name: "Crear el primer activo" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Nuevo activo" }),
    ).toBeInTheDocument();
  });

  it("«Editar» en un producto abre «Editar producto» con sus datos", async () => {
    const user = userEvent.setup();
    renderScreen(
      [item({ kind: "product", name: "Taza personalizada", salePrice: 45 })],
      "owner",
      false,
      "product",
    );

    await user.click(screen.getByRole("button", { name: "Acciones" }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Editar producto" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue(
      "Taza personalizada",
    );
    expect(
      within(dialog).getByLabelText("Precio de venta referencial"),
    ).toHaveValue("45");
  });
});

/**
 * Cambio `item-categories`, requisito "Pantalla de catálogo (V10)": el filtro
 * por categoría.
 */
describe("CatalogScreen · filtro por categoría", () => {
  function categoria(id: string, name: string, kind: ItemKind, archivedAt: string | null = null): ItemCategory {
    return { id, organizationId: ORG, kind, name, archivedAt };
  }

  const SUSTRATOS = categoria("92000000-0000-4000-8000-000000000001", "Sustratos", "supply");
  const EMBALAJE = categoria("92000000-0000-4000-8000-000000000003", "Embalaje", "supply");
  const ARCHIVADA = categoria(
    "92000000-0000-4000-8000-000000000009",
    "Tintas",
    "supply",
    "2026-09-01T00:00:00Z",
  );
  const VAJILLA = categoria("92000000-0000-4000-8000-000000000013", "Vajilla", "product");

  function renderFiltered(
    props: { kind?: ItemKind; categories?: ItemCategory[]; categoryFilter?: string; items?: CatalogRow[] } = {},
  ) {
    return render(
      <CatalogScreen
        items={props.items ?? [item()]}
        lines={[LINE]}
        units={[UNIT]}
        kind={props.kind ?? "supply"}
        lineFilter="all"
        categoryFilter={props.categoryFilter ?? "all"}
        categories={props.categories ?? [EMBALAJE, SUSTRATOS, ARCHIVADA]}
        search=""
        includeArchived={false}
        role="owner"
        activeLineId={null}
      />,
    );
  }

  async function opciones() {
    await userEvent.click(screen.getByTestId("catalog-category"));
    const listbox = await screen.findByRole("listbox");
    return within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent);
  }

  it("elegir una categoría la lleva a la dirección", async () => {
    renderFiltered();

    await opciones();
    await userEvent.click(screen.getByRole("option", { name: "Sustratos" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining(`category=${SUSTRATOS.id}`));
  });

  it("«Sin categoría» pide los ítems que no tienen", async () => {
    renderFiltered();

    await opciones();
    await userEvent.click(screen.getByRole("option", { name: "Sin categoría" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("category=none"));
  });

  it("ofrece «Todas», «Sin categoría» y las vigentes que recibe, sin archivadas", async () => {
    renderFiltered({ kind: "product", categories: [VAJILLA] });

    expect(await opciones()).toEqual(["Todas las categorías", "Sin categoría", "Vajilla"]);
  });

  it("no ofrece una categoría archivada", async () => {
    renderFiltered();

    expect(await opciones()).toEqual([
      "Todas las categorías",
      "Sin categoría",
      "Embalaje",
      "Sustratos",
    ]);
  });

  it("cambiar de pestaña descarta la categoría elegida", async () => {
    direccion.query = `kind=supply&category=${SUSTRATOS.id}`;
    renderFiltered({ categoryFilter: SUSTRATOS.id });

    await userEvent.click(screen.getByRole("radio", { name: "Productos" }));

    const destino = push.mock.calls.at(-1)?.[0] as string;
    expect(destino).toContain("kind=product");
    expect(destino).not.toContain("category=");
  });

  it("«Quitar filtros» también limpia la categoría", async () => {
    direccion.query = `kind=supply&category=${SUSTRATOS.id}&q=zzz&line=${LINE.id}`;
    renderFiltered({ categoryFilter: SUSTRATOS.id, items: [] });

    await userEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));

    const destino = push.mock.calls.at(-1)?.[0] as string;
    expect(destino).toBe("/catalog?kind=supply");
  });

  it("editar un ítem con su categoría archivada la muestra como valor actual", async () => {
    renderFiltered({ items: [item({ name: "Tinta cian", categoryId: ARCHIVADA.id })] });

    await userEvent.click(screen.getByRole("button", { name: "Acciones" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("combobox", { name: "Categoría" })).toHaveTextContent(
      "Tintas (archivada)",
    );
  });
});
