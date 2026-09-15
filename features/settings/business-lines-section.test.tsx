import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  createBusinessLine: vi.fn(async () => undefined),
  updateBusinessLine: vi.fn(async () => undefined),
  archiveConfigurationItem: vi.fn(async () => undefined),
  unarchiveConfigurationItem: vi.fn(async () => undefined),
}));

import { createBusinessLine, updateBusinessLine } from "@/actions/configuration";
import type { BusinessLine } from "@/types";

import { BusinessLinesSection } from "./business-lines-section";

function line(id: string, name: string, extra: Partial<BusinessLine> = {}): BusinessLine {
  return {
    id,
    organizationId: "org",
    name,
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
    ...extra,
  };
}

const LINES = [
  line("l0", "General", { isShared: true, color: "zinc" }),
  line("l1", "Sublimación", { color: "violet" }),
];

const table = () => screen.getByRole("table", { name: "Líneas de negocio" });

beforeEach(() => {
  vi.mocked(createBusinessLine).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateBusinessLine).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("BusinessLinesSection", () => {
  // Spec `settings-interaction` → «No inline creation form».
  it("no pinta ningún campo fuera del diálogo: solo el botón y la tabla", () => {
    render(<BusinessLinesSection lines={LINES} />);

    expect(screen.getByRole("button", { name: "Crear línea" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(within(table()).getByText("Sublimación")).toBeInTheDocument();
  });

  // Spec `settings-interaction` → «Owner creates a line from the dialog», nivel unitario.
  it("«Crear línea» abre el diálogo con Nombre y Color, y crea con el color elegido", async () => {
    const user = userEvent.setup();
    render(<BusinessLinesSection lines={LINES} />);

    await user.click(screen.getByRole("button", { name: "Crear línea" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva línea" });
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Nombre"), "Serigrafía");
    await user.click(within(dialog).getByLabelText("Color"));
    await user.click(await screen.findByRole("option", { name: "Verde" }));
    await user.click(within(dialog).getByRole("button", { name: "Crear línea" }));

    expect(createBusinessLine).toHaveBeenCalledWith({ name: "Serigrafía", color: "green" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Spec `settings-interaction` → «The edit dialog opens prefilled».
  it("«Editar» abre el diálogo con el nombre y el color de la línea", async () => {
    const user = userEvent.setup();
    render(<BusinessLinesSection lines={LINES} />);

    await user.click(within(table()).getByRole("button", { name: "Acciones de Sublimación" }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar línea" });
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Sublimación");
    expect(within(dialog).getByLabelText("Color")).toHaveTextContent("Violeta");

    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    expect(updateBusinessLine).toHaveBeenCalledWith({
      id: "l1",
      name: "Sublimación",
      color: "violet",
    });
  });
});
