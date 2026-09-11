import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchasePrice } from "@/features/inventory/price-history-section";
import type {
  AssetDetails,
  BusinessLine,
  InventoryMovement,
  Item,
  ItemBalance,
  ItemVariant,
  Role,
  Unit,
} from "@/types";

import type { RelatedTask } from "@/services/tasks/task-service";

import { ItemDetail } from "./item-detail";
import type { ItemPhoto } from "./item-photos";

import { setItemPhotoArchived } from "@/actions/catalog";

vi.mock("@/actions/assets", () => ({
  saveAssetDetails: vi.fn(async () => undefined),
  linkExpenseToAsset: vi.fn(async () => undefined),
}));

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
    uploadedBy: null,
    createdAt: "2026-08-26T12:00:00Z",
    archivedAt: null,
    url: "https://firmada/taza.png",
    ...overrides,
  };
}

type InventoryProps = Partial<{
  balance: ItemBalance | null;
  movements: InventoryMovement[];
  prices: PurchasePrice[];
  lastCost: number | null;
  assetDetails: AssetDetails | null;
  suppliers: { id: string; name: string }[];
}>;

function renderDetail(
  overrides: Partial<Item> = {},
  role: Role = "owner",
  variants: ItemVariant[] = [],
  photos: ItemPhoto[] = [],
  inventory: InventoryProps = {},
  relatedTasks: RelatedTask[] = [],
) {
  return render(
    <ItemDetail
      relatedTasks={relatedTasks}
      item={item(overrides)}
      variants={variants}
      photos={photos}
      lines={[LINE]}
      units={[UNIT]}
      history={{ items: [], activityHref: "/activity" }}
      role={role}
      timeZone="America/La_Paz"
      {...inventory}
    />,
  );
}

const BALANCE: ItemBalance = {
  itemId: "77777777-7777-4777-8777-777777777777",
  organizationId: "11111111-1111-4111-8111-111111111111",
  balance: 57,
  minStock: 12,
  belowMin: false,
};

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

  // Escenario "Sin secciones de inventario ni costos": un producto o un
  // activo no tiene saldo que explicar, así que la página no le pasa ninguna.
  it("un producto no muestra secciones de inventario ni de costos", () => {
    renderDetail({ kind: "product" }, "owner", [variant("11oz")]);

    // Por identificador de sección y no por texto: el bloque *Historial*, que
    // sí existe en un producto, habla de «movimientos» de la bitácora y no
    // tiene nada que ver con el inventario.
    expect(screen.queryByTestId("item-balance")).toBeNull();
    expect(screen.queryByTestId("item-movements")).toBeNull();
    expect(screen.queryByTestId("item-price-history")).toBeNull();
    expect(screen.queryByText(/evolución de precios/i)).toBeNull();
  });

  // Escenario "Sin proveedores habituales". KAM-21 levantó la mitad de esta
  // prohibición —las tareas relacionadas ya se muestran, y su escenario está
  // abajo—; los proveedores habituales siguen fuera.
  it("no muestra proveedores habituales", () => {
    renderDetail({}, "owner", [], [], { balance: BALANCE });

    expect(screen.queryByText(/proveedores habituales/i)).toBeNull();
  });

  // Escenarios "Tareas relacionadas en el detalle" e "Ítem sin tareas
  // relacionadas" (delta `catalog-directory` de KAM-21).
  it("muestra las tareas que apuntan al ítem, con su estado actual", () => {
    renderDetail({}, "owner", [], [], {}, [
      {
        id: "t1",
        title: "Set de 6 tazas artesanales",
        statusName: "En curso",
        dueAt: null,
        closedAt: null,
      },
      {
        id: "t2",
        title: "Revisar filamento",
        statusName: "Por hacer",
        dueAt: null,
        closedAt: null,
      },
    ]);

    expect(screen.getByText("Set de 6 tazas artesanales")).toBeInTheDocument();
    expect(screen.getByText("Revisar filamento")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("un ítem que ninguna tarea referencia rinde el bloque vacío", () => {
    renderDetail();

    expect(screen.getByText(/tareas relacionadas/i)).toBeInTheDocument();
    expect(screen.getByTestId("empty-related-tasks")).toBeInTheDocument();
  });

  // Escenario "Secciones de inventario en un insumo".
  it("un insumo muestra saldo, movimientos y evolución de precios", () => {
    renderDetail({}, "owner", [], [], {
      balance: BALANCE,
      movements: [
        {
          id: "88888888-8888-4888-8888-888888888888",
          organizationId: BALANCE.organizationId,
          itemId: BALANCE.itemId,
          variantId: null,
          kind: "out",
          quantity: -24,
          sourceType: "manual",
          sourceId: null,
          occurredAt: "2026-09-01T10:00:00.000Z",
          note: "Pedido #1",
          createdBy: null,
          createdAt: "2026-09-01T10:00:00.000Z",
        },
      ],
      lastCost: 8.5,
    });

    expect(screen.getByTestId("item-balance")).toBeInTheDocument();
    expect(screen.getByTestId("balance-value")).toHaveTextContent("57");
    expect(screen.getByTestId("item-movements")).toHaveTextContent("Consumo");
    expect(screen.getByTestId("item-price-history")).toBeInTheDocument();
    expect(screen.getByTestId("last-cost")).toHaveTextContent("8.50");
  });

  // Design D9: el recorte lo hace RLS en la fuente. El ayudante recibe la
  // lista de precios vacía, así que la sección no llega a existir — y este
  // componente no consulta el rol para decidirlo.
  it("sin precios no hay sección de precios, sin mirar el rol", () => {
    renderDetail({}, "assistant", [], [], { balance: BALANCE, lastCost: null });

    expect(screen.getByTestId("item-balance")).toBeInTheDocument();
    expect(screen.queryByTestId("item-price-history")).toBeNull();
  });

  // El saldo negativo se muestra tal cual: dice que faltan entradas por
  // registrar, y recortarlo a cero escondería justo eso.
  it("un saldo negativo se muestra y se explica", () => {
    renderDetail({}, "owner", [], [], {
      balance: { ...BALANCE, balance: -3, belowMin: true },
    });

    expect(screen.getByTestId("balance-value")).toHaveTextContent("-3");
    expect(screen.getByTestId("balance-below-min")).toBeInTheDocument();
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

/**
 * Escenarios del delta spec `assets`, requisito "Alta de un activo desde el
 * catálogo": "Alta desde el detalle del ítem", "No se ofrece donde no
 * corresponde", "El ayudante no ve la sección". Y del delta spec
 * `catalog-directory`, requisito "Pantalla de detalle de ítem (V11)": "Los
 * datos de activo en el detalle de un activo" y "El ayudante no ve los datos
 * de activo".
 */
describe("ItemDetail · datos de activo (KAM-19)", () => {
  it("un activo sin datos ofrece declararlos, sin salir del catálogo", () => {
    renderDetail({ kind: "asset" }, "owner");

    expect(screen.getByTestId("asset-details-section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Declarar activo" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /recuperación de inversión/i }),
    ).toHaveAttribute("href", "/assets");
  });

  it("un activo ya declarado muestra sus datos y permite corregirlos", () => {
    renderDetail({ kind: "asset" }, "owner", [], [], {
      assetDetails: {
        itemId: "77777777-7777-4777-8777-777777777777",
        organizationId: ORG,
        acquisitionCost: 7000,
        acquiredOn: "2026-03-01",
        supplierId: null,
        notes: null,
      },
    });

    const form = within(screen.getByTestId("asset-details-form"));
    expect(form.getByLabelText("Costo de adquisición")).toHaveValue(7000);
    expect(form.getByLabelText("Fecha de compra")).toHaveValue("2026-03-01");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("no se ofrece en un insumo ni en un producto", () => {
    renderDetail({ kind: "supply" }, "owner");
    expect(screen.queryByTestId("asset-details-section")).not.toBeInTheDocument();

    cleanup();

    renderDetail({ kind: "product" }, "owner");
    expect(screen.queryByTestId("asset-details-section")).not.toBeInTheDocument();
  });

  it("el ayudante no ve la sección: ni vacía ni rotulada", () => {
    renderDetail({ kind: "asset" }, "assistant");

    expect(screen.queryByTestId("asset-details-section")).not.toBeInTheDocument();
    expect(screen.queryByText(/Costo de adquisición/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Declarar activo/i)).not.toBeInTheDocument();
  });
});
