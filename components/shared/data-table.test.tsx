import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "./data-table";

type Row = { id: string; name: string; members: number };

const rows: Row[] = [
  { id: "a", name: "Geeko Store", members: 2 },
  { id: "b", name: "Taller Kamay", members: 0 },
];

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Nombre" },
  { key: "members", header: "Miembros", cell: (row) => `${row.members} miembros` },
];

afterEach(cleanup);

describe("DataTable", () => {
  it("rinde una fila por registro con sus columnas", () => {
    render(<DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} caption="Talleres" />);

    const table = screen.getByRole("table", { name: "Talleres" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Nombre",
      "Miembros",
    ]);
    const [, first] = within(table).getAllByRole("row");
    expect(first).toHaveTextContent("Geeko Store");
    expect(first).toHaveTextContent("2 miembros");
  });

  it("repite la información en tarjetas para el celular, con la primera columna de título", () => {
    render(<DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} rowTestId="fila" />);

    // Tabla y tarjetas: dos por registro; el CSS decide cuál se ve.
    const cards = screen.getAllByTestId("fila").filter((el) => el.tagName === "LI");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Geeko Store");
    expect(cards[0]).toHaveTextContent("Miembros2 miembros");
  });

  it("sin filas muestra el vacío que le den", () => {
    render(
      <DataTable rows={[]} columns={columns} getRowKey={(r) => r.id} empty={<p>Nada aún</p>} />,
    );
    expect(screen.getByText("Nada aún")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("el menú de cada fila ofrece sus acciones", async () => {
    const onSelect = vi.fn();
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        rowActionsLabel={(r) => `Acciones de ${r.name}`}
        rowActions={(r) => [
          { label: "Ver detalle", href: `/x/${r.id}` },
          { label: "Quitar", destructive: true, onSelect: () => onSelect(r.id) },
        ]}
      />,
    );

    const table = screen.getByRole("table");
    await userEvent.click(within(table).getByRole("button", { name: "Acciones de Taller Kamay" }));
    expect(screen.getByRole("menuitem", { name: "Ver detalle" })).toHaveAttribute("href", "/x/b");
    await userEvent.click(screen.getByRole("menuitem", { name: "Quitar" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("una columna marcada no se repite en la tarjeta, y otra va sin rótulo", () => {
    render(
      <DataTable
        rows={rows}
        columns={[
          ...columns,
          { key: "oculta", header: "Oculta", hideOnCard: true, cell: () => "solo tabla" },
          { key: "boton", header: "Botón", bareOnCard: true, cell: () => "[entrar]" },
        ]}
        getRowKey={(r) => r.id}
        rowTestId="fila"
      />,
    );
    const [card] = screen.getAllByTestId("fila").filter((el) => el.tagName === "LI");
    expect(card).not.toHaveTextContent("solo tabla");
    expect(card).toHaveTextContent("[entrar]");
    expect(card).not.toHaveTextContent("Botón");
  });
});
