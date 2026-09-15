import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  archiveConfigurationItem: vi.fn(async () => undefined),
  unarchiveConfigurationItem: vi.fn(async () => undefined),
}));

import {
  archiveConfigurationItem,
  unarchiveConfigurationItem,
} from "@/actions/configuration";

import { ConfigTables } from "./config-list";

type Row = { id: string; name: string; archivedAt: string | null; shared?: boolean };

const GENERAL: Row = { id: "l0", name: "General", archivedAt: null, shared: true };
const SUBLIMACION: Row = { id: "l1", name: "Sublimación", archivedAt: null };
const TEMPORAL: Row = { id: "l2", name: "Temporal", archivedAt: "2026-09-01T00:00:00Z" };

function renderLines(items: Row[], onEdit = vi.fn()) {
  render(
    <ConfigTables
      entity="line"
      items={items}
      caption="Líneas de negocio"
      labelOf={(item) => item.name}
      isProtected={(item) => Boolean(item.shared)}
      onEdit={onEdit}
      columns={[{ key: "name", header: "Nombre" }]}
    />,
  );
  return { onEdit };
}

/** La tabla de escritorio: en jsdom las tarjetas también están, sin CSS que las oculte. */
const activeTable = () => screen.getByRole("table", { name: "Líneas de negocio" });

async function openMenu(name: string, table = activeTable()) {
  await userEvent.click(within(table).getByRole("button", { name: `Acciones de ${name}` }));
  return screen.findByRole("menu");
}

beforeEach(() => {
  vi.mocked(archiveConfigurationItem).mockReset().mockResolvedValue(undefined);
  vi.mocked(unarchiveConfigurationItem).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("ConfigTables", () => {
  // Spec `settings-interaction` → «A line row offers its actions from the menu».
  it("las acciones de una fila están en su «⋯» y la fila no tiene botones sueltos", async () => {
    const { onEdit } = renderLines([GENERAL, SUBLIMACION]);

    const row = within(activeTable()).getByRole("row", { name: /Sublimación/ });
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Acciones de Sublimación",
    ]);

    const menu = await openMenu("Sublimación");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Editar",
      "Archivar",
    ]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(SUBLIMACION);
  });

  // Spec `org-configuration` → «The shared line is not offered for archiving in the interface».
  it("la línea compartida ofrece «Editar» y no «Archivar»", async () => {
    renderLines([GENERAL, SUBLIMACION]);

    const menu = await openMenu("General");
    expect(within(menu).getByRole("menuitem", { name: "Editar" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Archivar" })).toBeNull();
  });

  // Spec `settings-interaction` → «Archiving a line asks first», «Confirming archives».
  it("«Archivar» pide confirmación y solo confirmar llama a la acción", async () => {
    renderLines([GENERAL, SUBLIMACION]);

    await userEvent.click(
      within(await openMenu("Sublimación")).getByRole("menuitem", { name: "Archivar" }),
    );
    const dialog = await screen.findByRole("alertdialog", { name: "¿Archivar «Sublimación»?" });
    expect(dialog).toHaveTextContent("Los registros que ya la usan la siguen mostrando");
    expect(archiveConfigurationItem).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Archivar" }));
    expect(archiveConfigurationItem).toHaveBeenCalledWith({ entity: "line", id: "l1" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  // Spec `settings-interaction` → «Cancelling leaves the entry untouched».
  it("«Cancelar» cierra sin archivar", async () => {
    renderLines([GENERAL, SUBLIMACION]);

    await userEvent.click(
      within(await openMenu("Sublimación")).getByRole("menuitem", { name: "Archivar" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(archiveConfigurationItem).not.toHaveBeenCalled();
    expect(within(activeTable()).getByText("Sublimación")).toBeInTheDocument();
  });

  it("si la base rechaza el archivado, el motivo queda en el diálogo", async () => {
    vi.mocked(archiveConfigurationItem).mockResolvedValue({
      error: "No se pudo archivar. Intenta de nuevo.",
    });
    renderLines([GENERAL, SUBLIMACION]);

    await userEvent.click(
      within(await openMenu("Sublimación")).getByRole("menuitem", { name: "Archivar" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archivar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo archivar");
  });

  // Spec `settings-interaction` → «Restoring an archived entry asks first».
  it("los archivados van en su propia tabla, solo con «Restaurar», que pide confirmación", async () => {
    renderLines([GENERAL, TEMPORAL]);

    expect(within(activeTable()).queryByText("Temporal")).toBeNull();
    const archived = screen.getByRole("table", { name: "Archivados" });
    const menu = await openMenu("Temporal", archived);
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Restaurar",
    ]);

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Restaurar" }));
    const dialog = await screen.findByRole("alertdialog", { name: "¿Restaurar «Temporal»?" });
    expect(unarchiveConfigurationItem).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Restaurar" }));
    expect(unarchiveConfigurationItem).toHaveBeenCalledWith({ entity: "line", id: "l2" });
  });

  // Spec `settings-interaction` → «No archived entries, no archived table».
  it("sin archivados no hay tabla «Archivados»", () => {
    renderLines([GENERAL, SUBLIMACION]);
    expect(screen.queryByRole("table", { name: "Archivados" })).toBeNull();
    expect(screen.queryByText("Archivados")).toBeNull();
  });

  it("sin activos muestra el vacío que remite al botón de alta", () => {
    renderLines([]);
    expect(screen.getByText("Aún no hay líneas de negocio")).toBeInTheDocument();
    expect(screen.getByText("Usa «Crear línea» para agregar la primera.")).toBeInTheDocument();
  });

  // Spec `settings-interaction` → «The menu is reachable by keyboard».
  it("el «⋯» se abre con Enter y sus acciones se eligen con flechas y Enter", async () => {
    const user = userEvent.setup();
    renderLines([GENERAL, SUBLIMACION]);

    within(activeTable()).getByRole("button", { name: "Acciones de Sublimación" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Editar" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Archivar" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("alertdialog", { name: "¿Archivar «Sublimación»?" }),
    ).toBeInTheDocument();
  });
});
