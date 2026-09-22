import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InventoryMovement, Item, ItemBalance, ItemVariant, VariantBalance } from "@/types";

vi.mock("@/stores/organization-store", () => ({
  useOrganizationStore: (selector: (state: unknown) => unknown) =>
    selector({ organization: { id: "org" } }),
}));
vi.mock("@/stores/user-store", () => ({
  useUserStore: (selector: (state: unknown) => unknown) => selector({ user: { id: "user" } }),
}));
vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => ({ isOnline: true, browserOnline: true, reportSendResult: vi.fn() }),
}));
vi.mock("./sync/capture-movement", () => ({
  captureConsumption: async () => ({ status: "sent" }),
  captureAdjustment: async () => ({ status: "sent" }),
}));

const { BalanceSection } = await import("./balance-section");
const { MovementsSection } = await import("./movements-section");

const ITEM = "22222222-2222-4222-8222-222222222222";
const item: Item = {
  id: ITEM,
  organizationId: "org",
  businessLineId: null,
  kind: "supply",
  name: "PLA Sunlu",
  description: null,
  unitId: null,
  categoryId: null,
  attributes: {},
  salePrice: null,
  minStock: 1,
  archivedAt: null,
};
const balance: ItemBalance = { itemId: ITEM, organizationId: "org", balance: 2.3, minStock: 1, belowMin: false };

function variante(id: string, name: string, archivedAt: string | null = null): ItemVariant {
  return { id, organizationId: "org", itemId: ITEM, name, attributes: {}, salePrice: null, archivedAt };
}
const negro = variante("v-negro", "Negro");
const rojo = variante("v-rojo", "Rojo");

function fila(variant: ItemVariant | null, value: number): VariantBalance {
  return {
    itemId: ITEM,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    variantArchivedAt: variant?.archivedAt ?? null,
    balance: value,
  };
}

afterEach(cleanup);

/** Escenarios del delta `inventory` del cambio `catalog-custom-attributes`. */
describe("BalanceSection · disponibilidad por variante", () => {
  it("muestra el total y una fila por variante con sus acciones", () => {
    // «Disponibilidad por variante en el detalle», nivel unitario.
    render(
      <BalanceSection
        item={item}
        balance={balance}
        variants={[negro, rojo]}
        variantBalances={[fila(negro, 1.5), fila(rojo, 0.8)]}
      />,
    );

    expect(screen.getByTestId("balance-value")).toHaveTextContent("2.3");
    const rows = screen.getAllByTestId("variant-balance-row");
    expect(rows.map((row) => row.textContent?.replace(/Registrar consumo|Ajustar/g, ""))).toEqual([
      "Negro1.5",
      "Rojo0.8",
    ]);
    expect(within(rows[0]).getByRole("button", { name: "Registrar consumo" })).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: "Ajustar" })).toBeInTheDocument();
  });

  it("con variantes no ofrece el ajuste del ítem entero", () => {
    // «Un insumo con variantes no se cuenta entero».
    render(
      <BalanceSection
        item={item}
        balance={balance}
        variants={[negro]}
        variantBalances={[fila(negro, 2.3)]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ajuste por conteo" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Registrar consumo" })).toHaveLength(2);
  });

  it("sin variantes se ve como antes", () => {
    render(<BalanceSection item={item} balance={balance} variantBalances={[fila(null, 2.3)]} />);

    expect(screen.queryByTestId("variant-balances")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajuste por conteo" })).toBeInTheDocument();
  });

  it("la fila «Sin variante» solo se ajusta, y una archivada con saldo se muestra sin acciones", () => {
    const verde = variante("v-verde", "Verde", "2026-09-01T00:00:00Z");
    render(
      <BalanceSection
        item={item}
        balance={balance}
        variants={[negro, verde]}
        variantBalances={[fila(negro, 2), fila(verde, 0.7), fila(null, -0.4)]}
      />,
    );

    const [, archivada, sinVariante] = screen.getAllByTestId("variant-balance-row");
    expect(archivada).toHaveTextContent("Archivada");
    expect(within(archivada).queryByRole("button")).toBeNull();
    expect(sinVariante).toHaveTextContent("Sin variante");
    expect(within(sinVariante).getByRole("button", { name: "Ajustar" })).toBeInTheDocument();
    expect(within(sinVariante).queryByRole("button", { name: "Registrar consumo" })).toBeNull();
  });

  it("«Ajustar» en una fila abre el conteo de esa variante con su saldo", async () => {
    render(
      <BalanceSection
        item={item}
        balance={balance}
        variants={[negro, rojo]}
        variantBalances={[fila(negro, 1.5), fila(rojo, 0.8)]}
      />,
    );

    const [negroRow] = screen.getAllByTestId("variant-balance-row");
    await userEvent.click(within(negroRow).getByRole("button", { name: "Ajustar" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("PLA Sunlu · Negro");
    expect(dialog).toHaveTextContent("El saldo actual es 1.5");
  });
});

describe("MovementsSection · variante", () => {
  const movimiento = (id: string, variantId: string | null): InventoryMovement => ({
    id,
    organizationId: "org",
    itemId: ITEM,
    variantId,
    kind: "out",
    quantity: -0.3,
    sourceType: "manual",
    sourceId: null,
    occurredAt: "2026-09-21T10:00:00Z",
    note: null,
    createdBy: null,
    createdAt: "2026-09-21T10:00:00Z",
  });

  it("muestra la variante de cada movimiento cuando el ítem las tiene", () => {
    // «El historial explica un número que no cuadra», con su variante.
    render(
      <MovementsSection
        movements={[movimiento("m1", "v-negro"), movimiento("m2", null)]}
        timeZone="America/La_Paz"
        variantNames={{ "v-negro": "Negro" }}
      />,
    );

    expect(screen.getAllByTestId("movement-variant").map((cell) => cell.textContent)).toEqual([
      "Negro",
      "Sin variante",
    ]);
  });

  it("sin variantes no hay columna de variante", () => {
    render(<MovementsSection movements={[movimiento("m1", null)]} timeZone="America/La_Paz" />);
    expect(screen.queryByTestId("movement-variant")).toBeNull();
  });
});
