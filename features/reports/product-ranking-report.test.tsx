import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { ProductRankingRow } from "@/services/reports/report-service";

import { ProductRankingReport } from "./product-ranking-report";

const MUCHO = "item-vende-mucho";
const POCO = "item-vende-poco";

// El caso que da sentido al informe: uno lidera en unidades y va último en
// margen; el otro, al revés.
const ROWS: ProductRankingRow[] = [
  {
    itemId: MUCHO,
    unitsSold: 200,
    revenue: 2000,
    attributedCost: 1900,
    topChannelId: "canal-feria",
  },
  {
    itemId: POCO,
    unitsSold: 5,
    revenue: 1500,
    attributedCost: 200,
    topChannelId: null,
  },
];

const itemNames = new Map([
  [MUCHO, "Llavero"],
  [POCO, "Cuadro grande"],
]);
const channelNames = new Map([["canal-feria", "Feria"]]);

function renderReport(rows = ROWS) {
  return render(
    <ProductRankingReport
      rows={rows}
      itemNames={itemNames}
      channelNames={channelNames}
    />,
  );
}

function rowNames(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
}

afterEach(cleanup);

describe("ProductRankingReport", () => {
  // Escenario «Ordenar por unidades».
  it("ordena por unidades y el margen sigue visible en la fila", () => {
    renderReport();

    expect(rowNames()).toEqual(["Llavero", "Cuadro grande"]);
    expect(screen.getByRole("button", { name: "Unidades" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // 2000 − 1900 = 100, en la misma fila que sus 200 unidades.
    expect(screen.getByText("100.00")).toBeInTheDocument();
  });

  // Escenario «Ordenar por margen».
  it("ordena por margen y las unidades siguen visibles", async () => {
    renderReport();

    await userEvent.click(screen.getByRole("button", { name: "Margen" }));

    expect(rowNames()).toEqual(["Cuadro grande", "Llavero"]);
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  // Escenario «El que vende mucho y deja poco».
  it("las dos columnas están presentes en las dos ordenaciones", async () => {
    renderReport();

    const columns = () =>
      screen.getAllByRole("columnheader").map((th) => th.textContent);

    expect(columns()).toContain("Unidades");
    expect(columns()).toContain("Margen");

    await userEvent.click(screen.getByRole("button", { name: "Margen" }));

    expect(columns()).toContain("Unidades");
    expect(columns()).toContain("Margen");
  });

  it("cada fila abre el detalle de su ítem", () => {
    renderReport();

    expect(screen.getByRole("link", { name: "Llavero" })).toHaveAttribute(
      "href",
      `/catalog/${MUCHO}`,
    );
  });

  it("un producto sin canal predominante no inventa uno", () => {
    renderReport();

    const row = screen.getByRole("row", { name: /Cuadro grande/ });
    expect(within(row).getAllByRole("cell").at(-1)).toHaveTextContent("—");
  });

  it("un periodo sin ventas lo dice en vez de dejar el hueco", () => {
    renderReport([]);

    expect(
      screen.getByText(/No se vendió ningún producto en este periodo/),
    ).toBeInTheDocument();
  });
});
