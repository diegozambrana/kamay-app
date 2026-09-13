import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KanbanBoard, type KanbanColumn } from "./kanban-board";

afterEach(cleanup);

type Item = { id: string; title: string };

function renderBoard(onMove = vi.fn()) {
  const columns: KanbanColumn<Item>[] = [
    { id: "todo", label: "Por hacer", header: <h2>Por hacer</h2>, items: [{ id: "t1", title: "Esmaltar" }] },
    { id: "doing", label: "Haciendo", header: <h2>Haciendo</h2>, items: [] },
    { id: "done", label: "Hecho", header: <h2>Hecho</h2>, items: [] },
  ];
  render(
    <KanbanBoard
      id="test-board"
      testId="test-board"
      columns={columns}
      onMove={onMove}
      itemLabel={(item) => `la tarea «${item.title}»`}
      renderCard={(item) => <a href={`/tasks/${item.id}`}>{item.title}</a>}
      renderOverlay={(item) => <span>{item.title}</span>}
    />,
  );
  return onMove;
}

/**
 * Spec `accessibility` → *Board cards can be moved without a pointer*.
 */
describe("KanbanBoard · alternativa de teclado al arrastre", () => {
  // «The keyboard alternative is announced»
  it("el botón de mover nombra la tarjeta que mueve", () => {
    renderBoard();

    expect(
      screen.getByRole("button", { name: "Mover la tarea «Esmaltar» a otra columna" }),
    ).toBeInTheDocument();
  });

  // «Keyboard moves a card between columns»
  it("con el teclado se elige la columna destino y se mueve igual que al arrastrar", async () => {
    const user = userEvent.setup();
    const onMove = renderBoard();

    // Tabulador: primero el enlace de la tarjeta, después su menú.
    await user.tab();
    expect(screen.getByRole("link", { name: "Esmaltar" })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: /Mover la tarea «Esmaltar»/ }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    const destinos = await screen.findAllByRole("menuitem");
    // La columna actual no se ofrece como destino.
    expect(destinos.map((item) => item.textContent)).toEqual(["Haciendo", "Hecho"]);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onMove).toHaveBeenCalledWith("t1", "done");
  });

  it("el contenedor arrastrable no es un control: no hay controles anidados", () => {
    renderBoard();

    const card = screen.getByRole("link", { name: "Esmaltar" });
    expect(card.parentElement).not.toHaveAttribute("role");
    expect(card.parentElement).not.toHaveAttribute("tabindex");
  });
});
