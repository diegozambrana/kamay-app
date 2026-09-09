import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetsScreen, type AssetRowView } from "./assets-screen";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/actions/assets", () => ({
  linkExpenseToAsset: vi.fn(async () => undefined),
  saveAssetDetails: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const TRES_D = "33333333-3333-3333-3333-333333333333";

function asset(overrides: Partial<AssetRowView> & { itemId: string }): AssetRowView {
  return {
    organizationId: ORG,
    businessLineId: TRES_D,
    name: "Impresora 3D",
    acquiredOn: "2026-03-01",
    acquisitionCost: 7000,
    maintenanceCost: 500,
    totalCost: 7500,
    lineMarginSince: 3750,
    lineName: "Impresión 3D",
    lineColor: "violet",
    archivedAt: null,
    ...overrides,
  };
}

afterEach(cleanup);

/**
 * Escenarios del delta spec `assets`: "Pantalla de activos (V12)" → "Una
 * tarjeta por activo" y "Una columna en 390 px"; "Un activo sin línea propia
 * no muestra porcentaje" → "Activo compartido" y "Sin reparto inventado".
 */
describe("AssetsScreen", () => {
  it("una tarjeta por activo, con costo, fecha, mantenimiento y barra", () => {
    render(
      <AssetsScreen
        assets={[
          asset({ itemId: "a1" }),
          asset({ itemId: "a2", name: "Horno", acquisitionCost: 2000, totalCost: 2000 }),
        ]}
        detail={null}
        timezone="America/La_Paz"
        includeArchived={false}
      />,
    );

    const cards = screen.getAllByTestId("asset-card");
    expect(cards).toHaveLength(2);

    const first = within(cards[0]);
    expect(first.getByText("Impresora 3D")).toBeInTheDocument();
    expect(first.getByText("7000.00")).toBeInTheDocument();
    expect(first.getByText("01/03/2026")).toBeInTheDocument();
    expect(first.getByTestId("asset-maintenance")).toHaveTextContent("500.00");
    expect(first.getByTestId("recovery-bar")).toHaveAttribute("data-percent", "50");
  });

  it("se apila en una columna y solo se despliega en pantallas anchas", () => {
    render(
      <AssetsScreen
        assets={[asset({ itemId: "a1" })]}
        detail={null}
        timezone="America/La_Paz"
        includeArchived={false}
      />,
    );

    // A 390 px manda `grid-cols-1`: las tarjetas se apilan y nada obliga a
    // desplazarse en horizontal.
    expect(screen.getByTestId("assets-list").className).toContain("grid-cols-1");
  });

  it("un activo compartido declara que no es atribuible, en vez de un 0 %", () => {
    render(
      <AssetsScreen
        assets={[asset({ itemId: "a1", businessLineId: null, lineMarginSince: 0 })]}
        detail={null}
        timezone="America/La_Paz"
        includeArchived={false}
      />,
    );

    expect(screen.getByTestId("not-attributable")).toHaveTextContent(
      /no se puede atribuir a una sola línea/i,
    );
    expect(screen.queryByTestId("recovery-bar")).not.toBeInTheDocument();
  });

  it("y no se le inventa ninguna parte del margen de las demás líneas", () => {
    render(
      <AssetsScreen
        assets={[
          asset({ itemId: "a1", businessLineId: null, lineMarginSince: 0 }),
          asset({ itemId: "a2", name: "Horno" }),
        ]}
        detail={null}
        timezone="America/La_Paz"
        includeArchived={false}
      />,
    );

    // El que sí tiene línea conserva su barra; el compartido no toma nada de él.
    expect(screen.getAllByTestId("recovery-bar")).toHaveLength(1);
    expect(screen.getByTestId("not-attributable")).toBeInTheDocument();
  });

  it("sin activos lo dice y explica de dónde salen", () => {
    render(
      <AssetsScreen assets={[]} detail={null} timezone="America/La_Paz" includeArchived={false} />,
    );

    expect(screen.getByTestId("assets-empty")).toHaveTextContent(/Todavía no hay activos/);
  });
});
