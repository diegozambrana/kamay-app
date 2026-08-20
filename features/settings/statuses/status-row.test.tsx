import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Status } from "@/types";

import { StatusRow } from "./status-row";

vi.mock("@/actions/statuses", () => ({
  archiveStatus: vi.fn(async () => undefined),
  updateStatus: vi.fn(async () => undefined),
}));

import { archiveStatus, updateStatus } from "@/actions/statuses";

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

function renderRow(row: Status, siblings: Status[]) {
  return render(
    <DndContext>
      <SortableContext items={[row.id, ...siblings.map((s) => s.id)]}>
        <ul>
          <StatusRow status={row} siblings={siblings} />
        </ul>
      </SortableContext>
    </DndContext>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("StatusRow · archivar con reasignación", () => {
  it("archivar el único estado inicial se bloquea antes de llegar a la base", async () => {
    const user = userEvent.setup();
    const initial = status({ name: "Registrado", kind: "initial" });
    renderRow(initial, [
      status({ name: "En cola", kind: "waiting" }),
      status({ name: "Entregado", kind: "final" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Archivar" }));
    await user.click(screen.getByRole("button", { name: "Archivar estado" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /al menos un estado inicial y uno final/,
    );
    expect(archiveStatus).not.toHaveBeenCalled();
  });

  it("archivar pide a dónde mover y envía el estado de destino elegido", async () => {
    const user = userEvent.setup();
    const waiting = status({ name: "En espera", kind: "waiting" });
    const destination = status({ name: "Registrado", kind: "initial" });
    renderRow(waiting, [
      destination,
      status({ name: "Entregado", kind: "final" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Archivar" }));
    await user.selectOptions(
      screen.getByLabelText("Mover los registros que lo usaban a"),
      destination.id,
    );
    await user.click(screen.getByRole("button", { name: "Archivar estado" }));

    expect(archiveStatus).toHaveBeenCalledWith({
      id: waiting.id,
      moveToId: destination.id,
    });
  });
});

describe("StatusRow · edición en el sitio", () => {
  it("cambiar el tipo dejando el juego sin final se bloquea antes de enviar", async () => {
    const user = userEvent.setup();
    const finalStatus = status({ name: "Entregado", kind: "final" });
    renderRow(finalStatus, [status({ name: "Registrado", kind: "initial" })]);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "waiting");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /al menos un estado inicial y uno final/,
    );
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("la marca de cola sobre un estado que no es de espera se rechaza", async () => {
    const user = userEvent.setup();
    const inProgress = status({ name: "Sublimando", kind: "in_progress" });
    renderRow(inProgress, [
      status({ name: "Registrado", kind: "initial" }),
      status({ name: "Entregado", kind: "final" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("checkbox", { name: "Columna en cola" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/En espera/);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("una edición válida envía los valores del formulario", async () => {
    const user = userEvent.setup();
    const waiting = status({ name: "En cola", kind: "waiting" });
    renderRow(waiting, [
      status({ name: "Registrado", kind: "initial" }),
      status({ name: "Entregado", kind: "final" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "En cola de impresión");
    await user.click(screen.getByRole("checkbox", { name: "Columna en cola" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateStatus).toHaveBeenCalledWith({
      id: waiting.id,
      name: "En cola de impresión",
      kind: "waiting",
      color: "zinc",
      isQueue: true,
    });
  });
});
