import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { PickableItem } from "@/lib/orders/lines";

import {
  PurchaseLinesTable,
  type LastCostHint,
  type PurchaseEditorLine,
  type PurchaseLineNames,
} from "./purchase-lines-table";

const ORG = "11111111-1111-1111-1111-111111111111";
const TAZA = "90000000-0000-0000-0000-000000000001";
const ARCILLA = "90000000-0000-0000-0000-000000000003";

function supply(id: string, name: string): PickableItem {
  return {
    id,
    organizationId: ORG,
    businessLineId: null,
    kind: "supply",
    name,
    description: null,
    unitId: null,
    category: null,
    salePrice: null,
    minStock: null,
    archivedAt: null,
    variants: [],
  };
}

const SUPPLIES = [supply(TAZA, "Taza para sublimación"), supply(ARCILLA, "Arcilla roja")];

/** La taza ya se compró antes; la arcilla, nunca. */
const HINTS: Record<string, LastCostHint> = {
  [TAZA]: {
    lastCost: 12,
    lastPurchaseAt: "2026-08-31T14:00:00.000Z",
    supplierName: "Distribuidora Andina",
  },
};

/** El formulario en miniatura: guarda las filas y las nombra como haría V8. */
function Harness({ initial = [] }: { initial?: PurchaseEditorLine[] }) {
  const [lines, setLines] = useState<PurchaseEditorLine[]>(initial);
  const [names, setNames] = useState<Record<string, PurchaseLineNames>>({});

  return (
    <PurchaseLinesTable
      lines={lines}
      names={names}
      supplies={SUPPLIES}
      businessLineId={null}
      hints={HINTS}
      timezone="America/La_Paz"
      onAdd={(line, displayNames) => {
        setLines((previous) => [...previous, line]);
        setNames((previous) => ({ ...previous, [line.id]: displayNames }));
      }}
      onUpdate={(index, patch) =>
        setLines((previous) =>
          previous.map((line, i) => (i === index ? { ...line, ...patch } : line)),
        )
      }
      onRemove={(index) =>
        setLines((previous) => previous.filter((_, i) => i !== index))
      }
    />
  );
}

async function addSupply(name: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Agregar insumo"), name.slice(0, 4));
  await user.click(within(screen.getByTestId("supply-options")).getByText(name));
  return user;
}

afterEach(cleanup);

describe("PurchaseLinesTable", () => {
  it("un insumo comprado antes muestra la pista y el precio sigue vacío", async () => {
    render(<Harness />);
    await addSupply("Taza para sublimación");

    const row = screen.getByTestId("purchase-line-row");
    expect(within(row).getByTestId("last-cost-hint")).toHaveTextContent(
      "Último: 12.00 · 31/08/2026 · Distribuidora Andina",
    );
    // La pista se muestra, no se copia (criterio 4 del backlog).
    expect(within(row).getByLabelText("Precio unitario")).toHaveValue(null);
  });

  it("un insumo nunca comprado no muestra pista y el precio está vacío", async () => {
    render(<Harness />);
    await addSupply("Arcilla roja");

    const row = screen.getByTestId("purchase-line-row");
    expect(within(row).queryByTestId("last-cost-hint")).toBeNull();
    expect(within(row).getByLabelText("Precio unitario")).toHaveValue(null);
  });

  it("escribir 9.50 conserva la pista en 12", async () => {
    render(<Harness />);
    const user = await addSupply("Taza para sublimación");

    const row = screen.getByTestId("purchase-line-row");
    await user.type(within(row).getByLabelText("Precio unitario"), "9.50");

    expect(within(row).getByLabelText("Precio unitario")).toHaveValue(9.5);
    expect(within(row).getByTestId("last-cost-hint")).toHaveTextContent("Último: 12.00");
  });

  it("el total sigue a las filas: cambiar 2 por 5 lo actualiza sin recargar", async () => {
    render(
      <Harness
        initial={[{ id: "l1", itemId: TAZA, variantId: null, quantity: 2, unitPrice: 10 }]}
      />,
    );
    const user = userEvent.setup();
    expect(screen.getByTestId("purchase-form-total")).toHaveTextContent("20.00");

    const quantity = screen.getByLabelText("Cantidad");
    await user.clear(quantity);
    await user.type(quantity, "5");

    expect(screen.getByTestId("purchase-form-total")).toHaveTextContent("50.00");
  });

  it("quitar una fila recalcula el total", async () => {
    render(
      <Harness
        initial={[
          { id: "l1", itemId: TAZA, variantId: null, quantity: 3, unitPrice: 25 },
          { id: "l2", itemId: ARCILLA, variantId: null, quantity: 1, unitPrice: 40 },
          { id: "l3", itemId: TAZA, variantId: null, quantity: 1, unitPrice: 5 },
        ]}
      />,
    );
    const user = userEvent.setup();
    expect(screen.getByTestId("purchase-form-total")).toHaveTextContent("120.00");

    await user.click(screen.getAllByRole("button", { name: /Quitar/ })[2]);

    expect(screen.getAllByTestId("purchase-line-row")).toHaveLength(2);
    expect(screen.getByTestId("purchase-form-total")).toHaveTextContent("115.00");
  });

  it("sin filas muestra el vacío y total 0", () => {
    render(<Harness />);
    expect(screen.getByText("Sin insumos todavía")).toBeInTheDocument();
    expect(screen.getByTestId("purchase-form-total")).toHaveTextContent("0.00");
  });
});
