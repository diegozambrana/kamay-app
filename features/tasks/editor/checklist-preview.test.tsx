import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toggleChecklistItem } from "@/lib/markdown/checklist";

import { ChecklistPreview } from "./checklist-preview";

afterEach(cleanup);

const TASK = "22222222-2222-4222-8222-222222222222";

const HORNADA = [
  "## Hornada 07",
  "",
  "- [ ] Modelado",
  "- [ ] Secado",
  "- [ ] Primera quema",
  "- [ ] Esmaltado",
  "- [ ] Segunda quema",
].join("\n");

function renderPreview(
  body = HORNADA,
  { onToggle = vi.fn().mockResolvedValue(undefined), readOnly = false } = {},
) {
  render(
    <ChecklistPreview
      taskId={TASK}
      body={body}
      onToggle={onToggle}
      readOnly={readOnly}
    />,
  );
  return onToggle;
}

describe("casillas de la vista previa", () => {
  it("rinde una casilla marcable por cada elemento", () => {
    renderPreview();

    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getAllByRole("checkbox")[0]).not.toBeDisabled();
  });

  it("refleja el estado guardado de cada casilla", () => {
    renderPreview("- [x] Modelado\n- [ ] Secado");

    const casillas = screen.getAllByRole("checkbox");
    expect(casillas[0]).toBeChecked();
    expect(casillas[1]).not.toBeChecked();
  });

  it("marcar una casilla solo escribe el cuerpo, sin otra fuente", async () => {
    const onToggle = renderPreview();

    await userEvent.setup().click(screen.getAllByRole("checkbox")[2]);

    // El único efecto es la reescritura del cuerpo: no hay segunda tabla, ni
    // store, ni columna donde el marcado viva aparte.
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(2, true);
  });

  it("el índice del clic es el que reescribe la línea correcta", async () => {
    const onToggle = renderPreview();

    await userEvent.setup().click(screen.getAllByRole("checkbox")[2]);

    // El mismo índice, pasado a la función pura, marca «Primera quema» y solo
    // esa: es la garantía de que el orden del renderizado y el del texto
    // coinciden (design D2).
    const [index, checked] = onToggle.mock.calls[0];
    const resultado = toggleChecklistItem(HORNADA, index as number, checked as boolean);

    expect(resultado).toContain("- [x] Primera quema");
    expect(resultado).toContain("- [ ] Esmaltado");
    expect(resultado).toContain("- [ ] Secado");
  });

  it("desmarcar una casilla ya marcada manda false", async () => {
    const onToggle = renderPreview("- [x] Modelado");

    await userEvent.setup().click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(0, false);
  });

  it("si el servidor rechaza, la casilla vuelve a su estado guardado", async () => {
    const onToggle = vi.fn().mockResolvedValue({ error: "No se pudo marcar." });
    renderPreview("- [ ] Modelado", { onToggle });

    await userEvent.setup().click(screen.getByRole("checkbox"));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo marcar.");
    // Una casilla no puede quedar diciendo algo que el cuerpo guardado no dice.
    // Se vuelve a consultar el nodo: `react-markdown` reemplaza el elemento al
    // re-renderizar, así que una referencia guardada antes del clic queda vieja.
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
  });

  it("una tarea archivada muestra las casillas y no responde", async () => {
    const onToggle = renderPreview("- [x] Modelado\n- [ ] Secado", {
      readOnly: true,
    });

    const casillas = screen.getAllByRole("checkbox");
    expect(casillas[0]).toBeChecked();
    expect(casillas[0]).toBeDisabled();

    await userEvent.setup().click(casillas[1]);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("un cuerpo vacío muestra su mensaje, no una lista fantasma", () => {
    renderPreview("");

    expect(screen.getByTestId("empty-body")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("no cuenta como casilla lo que está dentro de un bloque de código", async () => {
    const onToggle = renderPreview(
      ["```md", "- [ ] Ejemplo", "```", "", "- [ ] Real"].join("\n"),
    );

    const casillas = screen.getAllByRole("checkbox");
    expect(casillas).toHaveLength(1);

    await userEvent.setup().click(casillas[0]);
    // Índice 0, que es el que `toggleChecklistItem` asigna a «Real» al saltar
    // el bloque cercado.
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(0, true);
  });
});
