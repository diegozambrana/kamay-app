import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";

import { useConfirmDialog } from "./confirm-dialog";
import { DataTable } from "./data-table";
import { FormDialog, useEntityDialog } from "./form-dialog";

afterEach(cleanup);

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: "a", name: "Sublimación" },
  { id: "b", name: "Alfarería" },
];

function Harness() {
  const edit = useEntityDialog<Row>();
  const { ask, dialog } = useConfirmDialog();

  return (
    <>
      <DataTable
        rows={rows}
        columns={[{ key: "name", header: "Nombre" }]}
        getRowKey={(row) => row.id}
        caption="Líneas"
        rowActionsLabel={(row) => `Acciones de ${row.name}`}
        rowActions={(row) => [
          { label: "Editar", onSelect: () => edit.openEdit(row) },
          {
            label: "Archivar",
            destructive: true,
            onSelect: () =>
              ask({
                title: `¿Archivar ${row.name}?`,
                description: "Deja de ofrecerse.",
                confirmLabel: "Archivar",
                action: async () => undefined,
              }),
          },
        ]}
      />
      <FormDialog
        open={edit.open}
        onOpenChange={edit.onOpenChange}
        title="Editar línea"
        submitLabel="Guardar cambios"
        onSubmit={() => {}}
      >
        <Input aria-label="Nombre" defaultValue={edit.target?.name} />
      </FormDialog>
      {dialog}
    </>
  );
}

// Spec `settings-interaction` → «Focus returns to the row menu».
describe("diálogos abiertos desde el menú de una fila", () => {
  it("al cerrar la edición con Escape, el foco vuelve al «⋯» de la fila", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const table = screen.getByRole("table", { name: "Líneas" });
    const trigger = within(table).getByRole("button", { name: "Acciones de Alfarería" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    await screen.findByRole("dialog", { name: "Editar línea" });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("al cancelar una confirmación, el foco vuelve al «⋯» de la fila", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const table = screen.getByRole("table", { name: "Líneas" });
    const trigger = within(table).getByRole("button", { name: "Acciones de Sublimación" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "Archivar" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });
});
