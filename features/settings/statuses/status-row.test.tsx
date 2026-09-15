import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Status } from "@/types";

import { StatusRow } from "./status-row";

const ORG = "11111111-1111-1111-1111-111111111111";

function status(overrides: Partial<Status>): Status {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    businessLineId: null,
    flow: "order",
    name: "Estado",
    kind: "waiting",
    color: "zinc",
    position: 1,
    isQueue: false,
    archivedAt: null,
    ...overrides,
  };
}

function renderRow(row: Status) {
  const onEdit = vi.fn();
  const onArchive = vi.fn();
  render(
    <DndContext>
      <SortableContext items={[row.id]}>
        <ul>
          <StatusRow status={row} onEdit={onEdit} onArchive={onArchive} />
        </ul>
      </SortableContext>
    </DndContext>,
  );
  return { onEdit, onArchive };
}

afterEach(cleanup);

// Spec `configurable-statuses` → «Las acciones de un estado están en su menú».
describe("StatusRow", () => {
  it("la fila solo tiene el asa y el «⋯»: ningún botón de acción suelto", () => {
    renderRow(status({ name: "En cola", isQueue: true }));

    const row = screen.getByTestId("status-row");
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Reordenar En cola",
      "Acciones de En cola",
    ]);
    expect(row).toHaveTextContent("En espera");
    expect(row).toHaveTextContent("Columna en cola");
    expect(within(row).queryByRole("textbox")).toBeNull();
  });

  it("el menú ofrece «Editar» y «Archivar» y avisa a la sección", async () => {
    const row = status({ name: "Sublimando", kind: "in_progress" });
    const { onEdit, onArchive } = renderRow(row);

    await userEvent.click(screen.getByRole("button", { name: "Acciones de Sublimando" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Editar",
      "Archivar",
    ]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(row);

    await userEvent.click(screen.getByRole("button", { name: "Acciones de Sublimando" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Archivar" }));
    expect(onArchive).toHaveBeenCalledWith(row);
  });
});
