import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  createUnit: vi.fn(async () => undefined),
  updateUnit: vi.fn(async () => undefined),
  archiveConfigurationItem: vi.fn(async () => undefined),
  unarchiveConfigurationItem: vi.fn(async () => undefined),
}));

import { createUnit, updateUnit } from "@/actions/configuration";
import type { Unit } from "@/types";

import { UnitsSection } from "./units-section";

const KG: Unit = { id: "u1", organizationId: "org", code: "kg", name: "Kilogramo", archivedAt: null };
const U: Unit = { id: "u2", organizationId: "org", code: "u", name: "Unidad", archivedAt: null };

const table = () => screen.getByRole("table", { name: "Unidades" });

beforeEach(() => {
  vi.mocked(createUnit).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateUnit).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("UnitsSection", () => {
  // Spec `settings-interaction` → «A unit row shows its code and name».
  it("cada unidad es una fila con su código, su nombre y su «⋯»", () => {
    render(<UnitsSection units={[KG, U]} />);

    expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Código",
      "Nombre",
      "Acciones",
    ]);
    const row = within(table()).getByRole("row", { name: /Kilogramo/ });
    expect(row).toHaveTextContent("kg");
    expect(within(row).getByRole("button", { name: "Acciones de kg · Kilogramo" })).toBeInTheDocument();
  });

  // Spec `settings-interaction` → «Owner renames a unit», nivel unitario.
  it("«Editar» abre el diálogo con sus valores y «Guardar cambios» renombra", async () => {
    render(<UnitsSection units={[KG, U]} />);

    await userEvent.click(within(table()).getByRole("button", { name: "Acciones de kg · Kilogramo" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar unidad" });
    expect(within(dialog).getByLabelText("Código")).toHaveValue("kg");
    const name = within(dialog).getByLabelText("Nombre");
    expect(name).toHaveValue("Kilogramo");

    await userEvent.clear(name);
    await userEvent.type(name, "Kilo");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(updateUnit).toHaveBeenCalledWith({ id: "u1", code: "kg", name: "Kilo" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("«Nueva unidad» crea con código y nombre", async () => {
    render(<UnitsSection units={[KG]} />);

    await userEvent.click(screen.getByRole("button", { name: "Nueva unidad" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva unidad" });
    await userEvent.type(within(dialog).getByLabelText("Código"), "m");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Metro");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear unidad" }));

    expect(createUnit).toHaveBeenCalledWith({ code: "m", name: "Metro" });
  });
});
