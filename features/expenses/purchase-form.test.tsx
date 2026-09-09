import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PickableItem } from "@/lib/orders/lines";
import type { BusinessLine, Contact } from "@/types";

import { PurchaseForm } from "./purchase-form";

const push = vi.fn();
const createPurchase = vi.fn();
const createContactInline = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/actions/expenses", () => ({
  createPurchase: (input: unknown) => createPurchase(input),
  attachReceipt: vi.fn(async () => undefined),
}));

vi.mock("@/actions/contacts", () => ({
  createContactInline: (input: unknown) => createContactInline(input),
}));

const saveAssetDetails = vi.fn();

vi.mock("@/actions/assets", () => ({
  saveAssetDetails: (input: unknown) => saveAssetDetails(input),
  linkExpenseToAsset: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const SUBLI = "30000000-0000-0000-0000-000000000001";
const ANDINA = "80000000-0000-0000-0000-000000000001";
const TAZA = "90000000-0000-0000-0000-000000000001";
const IMPRESORA = "90000000-0000-0000-0000-000000000002";
const FIGURA = "90000000-0000-0000-0000-000000000003";

const LINES: BusinessLine[] = [
  {
    id: SUBLI,
    organizationId: ORG,
    name: "Sublimación",
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  },
];

const SUPPLIERS: Contact[] = [
  {
    id: ANDINA,
    organizationId: ORG,
    name: "Distribuidora Andina",
    phone: null,
    email: null,
    address: null,
    isSupplier: true,
    isCustomer: false,
    notes: null,
    archivedAt: null,
  },
];

const SUPPLIES: PickableItem[] = [
  {
    id: TAZA,
    organizationId: ORG,
    businessLineId: SUBLI,
    kind: "supply",
    name: "Taza para sublimación",
    description: null,
    unitId: null,
    category: null,
    salePrice: null,
    minStock: null,
    archivedAt: null,
    variants: [],
  },
  {
    id: IMPRESORA,
    organizationId: ORG,
    businessLineId: SUBLI,
    kind: "asset",
    name: "Impresora 3D",
    description: null,
    unitId: null,
    category: null,
    salePrice: null,
    minStock: null,
    archivedAt: null,
    variants: [],
  },
];

function renderForm(undeclaredAssets: Record<string, string> = {}) {
  return render(
    <PurchaseForm
      defaultLineId={SUBLI}
      lines={LINES}
      suppliers={SUPPLIERS}
      supplies={SUPPLIES}
      hints={{}}
      today="2026-09-03"
      timezone="America/La_Paz"
      undeclaredAssets={undeclaredAssets}
    />,
  );
}

async function addTaza(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Agregar insumo o activo"), "Taza");
  await user.click(
    within(screen.getByTestId("supply-options")).getByText("Taza para sublimación"),
  );
  const row = screen.getByTestId("purchase-line-row");
  await user.type(within(row).getByLabelText("Precio unitario"), "9.20");
}

beforeEach(() => {
  push.mockReset();
  createPurchase.mockReset();
  createPurchase.mockResolvedValue({ expenseId: "b0000000-0000-0000-0000-000000000099" });
  createContactInline.mockReset();
  saveAssetDetails.mockReset();
  saveAssetDetails.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("PurchaseForm (V8)", () => {
  it("sin proveedor se impide señalando el campo de proveedor", async () => {
    renderForm();
    const user = userEvent.setup();
    await addTaza(user);

    await user.click(screen.getByTestId("save-purchase"));

    expect(await screen.findByTestId("supplier-error")).toHaveTextContent(
      "Elige o crea un proveedor",
    );
    expect(createPurchase).not.toHaveBeenCalled();
  });

  it("sin líneas se impide señalando la tabla de insumos", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Proveedor"), "Distri");
    await user.click(screen.getByRole("button", { name: "Distribuidora Andina" }));
    await user.click(screen.getByTestId("save-purchase"));

    expect(await screen.findByTestId("lines-error")).toHaveTextContent(
      "Agrega al menos un insumo",
    );
    expect(createPurchase).not.toHaveBeenCalled();
  });

  it("un proveedor creado al vuelo queda seleccionado y las filas se conservan", async () => {
    createContactInline.mockImplementation(async (input: { id: string; name: string }) => ({
      contact: {
        id: input.id,
        organizationId: ORG,
        name: input.name,
        phone: null,
        email: null,
        address: null,
        isSupplier: true,
        isCustomer: false,
        notes: null,
        archivedAt: null,
      },
    }));

    renderForm();
    const user = userEvent.setup();
    await addTaza(user);

    await user.type(screen.getByLabelText("Proveedor"), "Ferretería Sur");
    await user.click(screen.getByRole("button", { name: /Crear «Ferretería Sur»/ }));
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createContactInline).toHaveBeenCalledTimes(1));
    expect(createContactInline.mock.calls[0][0]).toMatchObject({
      name: "Ferretería Sur",
      isSupplier: true,
    });
    // El proveedor recién creado queda puesto y la fila sigue ahí.
    expect(screen.getByLabelText("Proveedor")).toHaveAttribute("placeholder", "Ferretería Sur");
    expect(screen.getAllByTestId("purchase-line-row")).toHaveLength(1);
  });

  it("compra completa: proveedor, una fila con precio, guardar y volver a la bandeja", async () => {
    renderForm();
    const user = userEvent.setup();
    await addTaza(user);

    await user.type(screen.getByLabelText("Proveedor"), "Distri");
    await user.click(screen.getByRole("button", { name: "Distribuidora Andina" }));
    await user.click(screen.getByTestId("save-purchase"));

    await waitFor(() => expect(createPurchase).toHaveBeenCalledTimes(1));
    expect(createPurchase.mock.calls[0][0]).toMatchObject({
      businessLineId: SUBLI,
      contactId: ANDINA,
      items: [{ itemId: TAZA, quantity: 1, unitPrice: 9.2 }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/expenses"));
  });
});

async function addImpresora(user: ReturnType<typeof userEvent.setup>, price: string) {
  await user.type(screen.getByLabelText("Agregar insumo o activo"), "Impresora");
  await user.click(within(screen.getByTestId("supply-options")).getByText("Impresora 3D"));
  const row = screen.getAllByTestId("purchase-line-row").at(-1)!;
  await user.type(within(row).getByLabelText("Precio unitario"), price);
}

async function chooseSupplier(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Proveedor"), "Distri");
  await user.click(screen.getByRole("button", { name: "Distribuidora Andina" }));
}

/**
 * Escenarios del delta spec `expenses`, requisito "Formulario de compra (V8)":
 * "Comprar una máquina" y "Los productos no se compran"; y del delta spec
 * `assets`, requisito "Alta de un activo desde el registro de una compra":
 * sus cuatro escenarios.
 */
describe("PurchaseForm · comprar una máquina (KAM-19)", () => {
  it("un ítem de tipo activo aparece en el selector, marcado como activo", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Agregar insumo o activo"), "Impresora");

    const options = within(screen.getByTestId("supply-options"));
    expect(options.getByText("Impresora 3D")).toBeInTheDocument();
    expect(options.getByTestId("option-asset")).toHaveTextContent("Activo");
  });

  it("un producto no aparece: lo que se fabrica no se compra", async () => {
    const user = userEvent.setup();
    renderForm();

    // El servidor no envía productos al formulario, así que buscar uno no
    // devuelve nada — la lista de opciones ni siquiera se rinde.
    await user.type(screen.getByLabelText("Agregar insumo o activo"), "Figura");
    expect(
      within(screen.getByTestId("supply-options")).queryByText(/Figura/),
    ).not.toBeInTheDocument();
    expect(FIGURA).toBeTruthy();
  });

  it("tras guardar, ofrece declarar el activo con costo y fecha prellenados", async () => {
    const user = userEvent.setup();
    renderForm({ [IMPRESORA]: "Impresora 3D" });

    await chooseSupplier(user);
    await addImpresora(user, "7000");
    await user.click(screen.getByTestId("save-purchase"));

    const dialog = within(await screen.findByTestId("declare-asset-dialog"));
    expect(dialog.getByLabelText("Costo de adquisición")).toHaveValue(7000);
    expect(dialog.getByLabelText("Fecha de compra")).toHaveValue("2026-09-03");
  });

  it("las cifras prellenadas se pueden ajustar antes de aceptar", async () => {
    const user = userEvent.setup();
    renderForm({ [IMPRESORA]: "Impresora 3D" });

    await chooseSupplier(user);
    await addImpresora(user, "7000");
    await user.click(screen.getByTestId("save-purchase"));

    const dialog = within(await screen.findByTestId("declare-asset-dialog"));
    const cost = dialog.getByLabelText("Costo de adquisición");
    await user.clear(cost);
    await user.type(cost, "6500");
    await user.click(dialog.getByRole("button", { name: "Declarar activo" }));

    await waitFor(() => expect(saveAssetDetails).toHaveBeenCalledTimes(1));
    const [payload] = saveAssetDetails.mock.calls[0] as [Record<string, unknown>];
    expect(payload.acquisitionCost).toBe(6500);
    // Y el egreso queda marcado como la adquisición del activo.
    expect(payload.acquisitionExpenseId).toBe("b0000000-0000-0000-0000-000000000099");
  });

  it("declinar no deshace la compra: ya está guardada", async () => {
    const user = userEvent.setup();
    renderForm({ [IMPRESORA]: "Impresora 3D" });

    await chooseSupplier(user);
    await addImpresora(user, "7000");
    await user.click(screen.getByTestId("save-purchase"));

    const dialog = within(await screen.findByTestId("declare-asset-dialog"));
    await user.click(dialog.getByRole("button", { name: "Ahora no" }));

    expect(createPurchase).toHaveBeenCalledTimes(1);
    expect(saveAssetDetails).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/expenses"));
  });

  it("un activo ya declarado no se vuelve a ofrecer", async () => {
    const user = userEvent.setup();
    // El servidor no lo incluye entre los que faltan por declarar.
    renderForm({});

    await chooseSupplier(user);
    await addImpresora(user, "7000");
    await user.click(screen.getByTestId("save-purchase"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/expenses"));
    expect(screen.queryByTestId("declare-asset-dialog")).not.toBeInTheDocument();
  });
});
