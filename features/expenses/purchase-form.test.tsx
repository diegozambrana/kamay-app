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

const ORG = "11111111-1111-1111-1111-111111111111";
const SUBLI = "30000000-0000-0000-0000-000000000001";
const ANDINA = "80000000-0000-0000-0000-000000000001";
const TAZA = "90000000-0000-0000-0000-000000000001";

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
];

function renderForm() {
  return render(
    <PurchaseForm
      defaultLineId={SUBLI}
      lines={LINES}
      suppliers={SUPPLIERS}
      supplies={SUPPLIES}
      hints={{}}
      today="2026-09-03"
      timezone="America/La_Paz"
    />,
  );
}

async function addTaza(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Agregar insumo"), "Taza");
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
