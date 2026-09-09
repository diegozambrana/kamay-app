import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LowStockRow } from "@/services/reports/report-service";

import { LowStockReport } from "./low-stock-report";

const PAPEL = "item-papel";

const ROWS: LowStockRow[] = [
  {
    itemId: PAPEL,
    balance: 3,
    minStock: 10,
    missing: 7,
    lastCost: 12.5,
    lastSupplierId: "contacto-1",
  },
];

function renderReport(rows = ROWS) {
  return render(
    <LowStockReport
      rows={rows}
      itemNames={new Map([[PAPEL, "Papel transfer"]])}
      supplierNames={new Map([["contacto-1", "Distribuidora Sur"]])}
    />,
  );
}

afterEach(cleanup);

describe("LowStockReport", () => {
  // Escenario «Un informe sin reparto no lleva leyenda». Una leyenda donde no
  // hubo reparto engaña tanto como su ausencia donde sí lo hubo.
  it("no lleva leyenda de reparto: este informe no reparte nada", () => {
    renderReport();

    expect(screen.queryByTestId("allocation-legend")).not.toBeInTheDocument();
  });

  it("advierte de que muestra el saldo de hoy, no el del periodo", () => {
    renderReport();

    expect(screen.getByText(/Muestra el saldo de hoy/)).toBeInTheDocument();
  });

  it("muestra saldo, mínimo y faltante", () => {
    renderReport();

    const row = screen.getByRole("row", { name: /Papel transfer/ });
    expect(row).toHaveTextContent("3");
    expect(row).toHaveTextContent("10");
    expect(row).toHaveTextContent("7");
    expect(row).toHaveTextContent("Distribuidora Sur");
  });

  it("ofrece crear la tarea de reposición prellenada", () => {
    renderReport();

    const link = screen.getByRole("link", { name: "Crear tarea" });
    expect(link).toHaveAttribute("href", expect.stringContaining(`item=${PAPEL}`));
    expect(link).toHaveAttribute("href", expect.stringContaining("missing=7"));
  });

  it("un insumo sin último costo conocido no inventa uno", () => {
    renderReport([{ ...ROWS[0], lastCost: null, lastSupplierId: null }]);

    const row = screen.getByRole("row", { name: /Papel transfer/ });
    expect(row).toHaveTextContent("—");
  });

  it("sin insumos bajo mínimo lo dice y recuerda la regla del mínimo", () => {
    renderReport([]);

    expect(
      screen.getByText(/Los insumos sin mínimo declarado no se vigilan/),
    ).toBeInTheDocument();
  });
});
