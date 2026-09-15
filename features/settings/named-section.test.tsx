import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  archiveConfigurationItem: vi.fn(async () => undefined),
  unarchiveConfigurationItem: vi.fn(async () => undefined),
}));

import { archiveConfigurationItem } from "@/actions/configuration";

import type { NamedItem } from "./named-item-dialog";
import { NamedSection } from "./named-section";

const createSalesChannel = vi.fn();
const updateSalesChannel = vi.fn();

const FERIA: NamedItem = { id: "c1", name: "Feria", archivedAt: null };
const TIENDA: NamedItem = { id: "c2", name: "Tienda", archivedAt: null };

function Channels({ items }: { items: NamedItem[] }) {
  return (
    <NamedSection
      title="Canales de venta"
      description="Por dónde llega cada venta."
      placeholder="Feria"
      entity="channel"
      items={items}
      onCreate={createSalesChannel}
      onUpdate={updateSalesChannel}
    />
  );
}

beforeEach(() => {
  createSalesChannel.mockReset().mockResolvedValue(undefined);
  updateSalesChannel.mockReset().mockResolvedValue(undefined);
  vi.mocked(archiveConfigurationItem).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("NamedSection · canales", () => {
  // Spec `settings-interaction` → «No inline creation form».
  it("muestra «Nuevo canal» y la tabla, sin ningún campo fuera del diálogo", () => {
    render(<Channels items={[FERIA]} />);

    expect(screen.getByRole("button", { name: "Nuevo canal" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(
      within(screen.getByRole("table", { name: "Canales de venta" })).getByText("Feria"),
    ).toBeInTheDocument();
  });

  it("crea desde el diálogo «Nuevo canal» con «Crear canal»", async () => {
    render(<Channels items={[FERIA]} />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo canal" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Tienda");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear canal" }));

    expect(createSalesChannel).toHaveBeenCalledWith({ name: "Tienda" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Spec `settings-interaction` → «Duplicate name».
  it("con nombre repetido, el diálogo sigue abierto con lo escrito y el error dentro", async () => {
    createSalesChannel.mockResolvedValue({ error: "Ya existe un canal con ese nombre." });
    render(<Channels items={[FERIA]} />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo canal" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Feria");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear canal" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ya existe un canal con ese nombre.",
    );
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Feria");
    expect(screen.getByRole("dialog", { name: "Nuevo canal" })).toBeInTheDocument();
  });

  // Spec `settings-interaction` → «An archived channel moves to the archived table».
  it("un canal archivado pasa a «Archivados», donde solo se ofrece «Restaurar»", async () => {
    const { rerender } = render(<Channels items={[FERIA, TIENDA]} />);

    const active = screen.getByRole("table", { name: "Canales de venta" });
    await userEvent.click(within(active).getByRole("button", { name: "Acciones de Tienda" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Archivar" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archivar" }),
    );
    expect(archiveConfigurationItem).toHaveBeenCalledWith({ entity: "channel", id: "c2" });

    // Lo que entregaría el servidor tras revalidar.
    rerender(<Channels items={[FERIA, { ...TIENDA, archivedAt: "2026-09-14T00:00:00Z" }]} />);

    expect(
      within(screen.getByRole("table", { name: "Canales de venta" })).queryByText("Tienda"),
    ).toBeNull();
    const archived = screen.getByRole("table", { name: "Archivados" });
    await userEvent.click(within(archived).getByRole("button", { name: "Acciones de Tienda" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Restaurar",
    ]);
  });
});

describe("NamedSection · categorías", () => {
  it("usa sus propios rótulos: «Nueva categoría» y «Crear categoría»", async () => {
    const createExpenseCategory = vi.fn(async () => undefined);
    render(
      <NamedSection
        title="Categorías de gasto"
        description="Cómo se agrupan los egresos."
        placeholder="Insumos"
        entity="category"
        items={[]}
        onCreate={createExpenseCategory}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Aún no hay categorías de gasto")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva categoría" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Insumos");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear categoría" }));

    expect(createExpenseCategory).toHaveBeenCalledWith({ name: "Insumos" });
  });
});
