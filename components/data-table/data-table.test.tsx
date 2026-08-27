import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Badge } from "@/components/ui/badge";

import { DataTable, type DataTableColumn } from "./data-table";

type Row = { id: string; name: string; unit: string | null; archived: boolean };

const rows: Row[] = [
  { id: "1", name: "Taza", unit: "Unidad", archived: false },
  { id: "2", name: "Arcilla", unit: null, archived: true },
];

const columns: DataTableColumn<Row>[] = [
  { id: "name", label: "Nombre", value: "name" },
  { id: "unit", label: "Unidad", value: "unit" },
  {
    id: "estado",
    label: "Estado",
    value: (row) => (row.archived ? <Badge>Archivado</Badge> : "Vigente"),
  },
];

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      onAction={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("DataTable", () => {
  it("una columna con clave muestra el dato tal cual", () => {
    renderTable();

    expect(screen.getByRole("cell", { name: "Taza" })).toBeInTheDocument();
  });

  it("una columna con función compone lo que quiera", () => {
    renderTable();

    expect(screen.getByText("Archivado")).toBeInTheDocument();
    expect(screen.getByText("Vigente")).toBeInTheDocument();
  });

  it("un valor ausente se muestra como raya, no como celda vacía", () => {
    renderTable();

    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("por defecto ofrece Ver, Editar y Archivar", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getAllByRole("button", { name: "Acciones" })[0]);

    expect(await screen.findByRole("menuitem", { name: "Ver" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Archivar" })).toBeInTheDocument();
  });

  it("una acción sin confirmación se ejecuta al elegirla", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderTable({ onAction });

    await user.click(screen.getAllByRole("button", { name: "Acciones" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Ver" }));

    expect(onAction).toHaveBeenCalledWith("view", rows[0]);
  });

  it("archivar pide confirmación antes de ejecutarse", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderTable({ onAction });

    await user.click(screen.getAllByRole("button", { name: "Acciones" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Archivar" }));

    // Todavía no pasó nada: primero se pregunta.
    expect(onAction).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Archivar este registro?");

    await user.click(screen.getByRole("button", { name: "Archivar" }));
    expect(onAction).toHaveBeenCalledWith("archive", rows[0]);
  });

  it("cancelar la confirmación no ejecuta nada", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderTable({ onAction });

    await user.click(screen.getAllByRole("button", { name: "Acciones" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Archivar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onAction).not.toHaveBeenCalled();
  });

  it("una acción oculta para esa fila no aparece", async () => {
    const user = userEvent.setup();
    renderTable({
      actions: [
        { id: "view", label: "Ver" },
        { id: "archive", label: "Archivar", hidden: (row) => row.archived },
      ],
    });

    // La segunda fila está archivada: ahí no se ofrece archivar.
    await user.click(screen.getAllByRole("button", { name: "Acciones" })[1]);

    expect(await screen.findByRole("menuitem", { name: "Ver" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Archivar" })).toBeNull();
  });

  it("sin `onAction` no dibuja el menú de tres puntos", () => {
    renderTable({ onAction: undefined });

    expect(screen.queryByRole("button", { name: "Acciones" })).toBeNull();
  });

  it("una lista vacía muestra el estado vacío en vez de una tabla pelada", () => {
    renderTable({
      rows: [],
      empty: { title: "Nada por aquí", description: "Prueba con otros filtros." },
    });

    expect(screen.getByText("Nada por aquí")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("cada fila puede llevar sus propios atributos", () => {
    renderTable({
      rowProps: (row) => ({ "data-archived": row.archived } as never),
    });

    expect(screen.getAllByRole("row")[2]).toHaveAttribute("data-archived", "true");
  });
});
