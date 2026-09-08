import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "./markdown-editor";

afterEach(cleanup);

const TASK = "22222222-2222-4222-8222-222222222222";

function renderEditor(
  value = "",
  {
    onSave = vi.fn().mockResolvedValue(undefined),
    onToggle = vi.fn().mockResolvedValue(undefined),
    readOnly = false,
  } = {},
) {
  render(
    <MarkdownEditor
      taskId={TASK}
      value={value}
      onSave={onSave}
      onToggleChecklistItem={onToggle}
      readOnly={readOnly}
    />,
  );
  return { onSave, onToggle };
}

describe("editor del cuerpo", () => {
  it("aplica negrita desde la barra sin saber Markdown", async () => {
    renderEditor("Set de 6 tazas de gres");
    const user = userEvent.setup();

    const area = screen.getByLabelText("Descripción") as HTMLTextAreaElement;
    area.setSelectionRange(7, 14);
    await user.click(screen.getByRole("button", { name: "Negrita" }));

    expect(area).toHaveValue("Set de **6 tazas** de gres");
  });

  it("crea una lista de verificación desde la barra", async () => {
    renderEditor("");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Lista de verificación" }));

    expect(screen.getByLabelText("Descripción")).toHaveValue("- [ ] Paso");
  });

  it("la sintaxis escrita a mano funciona igual", async () => {
    renderEditor("");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Descripción"), "Una **taza** de gres");
    await user.click(screen.getByRole("radio", { name: "Vista previa" }));

    expect(screen.getByText("taza").tagName).toBe("STRONG");
  });

  it("guarda el cuerpo tal como se escribió", async () => {
    const { onSave } = renderEditor("");
    const user = userEvent.setup();

    const texto = "## Hornada 07\n\n- [ ] Modelado";
    // Se pega en vez de teclear: `user.type` lee `[` y `{` como descriptores
    // de tecla, no como texto.
    await user.click(screen.getByLabelText("Descripción"));
    await user.paste(texto);
    await user.click(screen.getByRole("button", { name: "Guardar descripción" }));

    // Ni una transformación: lo que se escribió es lo que viaja.
    expect(onSave).toHaveBeenCalledWith(texto);
  });

  it("guarda también al salir del campo, sin pulsar el botón", async () => {
    const { onSave } = renderEditor("");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Descripción"), "Notas");
    await user.tab();

    expect(onSave).toHaveBeenCalledWith("Notas");
  });

  it("no guarda si el cuerpo no cambió", async () => {
    const { onSave } = renderEditor("Notas");
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Descripción"));
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("una tarea sin cuerpo se abre vacía y es válida", async () => {
    renderEditor("");

    expect(screen.getByLabelText("Descripción")).toHaveValue("");

    await userEvent.setup().click(screen.getByRole("radio", { name: "Vista previa" }));
    expect(screen.getByTestId("empty-body")).toBeInTheDocument();
  });

  it("cuenta el error del servidor sin perder lo escrito", async () => {
    const onSave = vi.fn().mockResolvedValue({ error: "No se pudo guardar." });
    renderEditor("", { onSave });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Descripción"), "Notas");
    await user.click(screen.getByRole("button", { name: "Guardar descripción" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar.");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Notas");
  });

  it("una tarea archivada se abre en vista previa y sin barra ni guardado", () => {
    renderEditor("Notas de la hornada", { readOnly: true });

    expect(screen.queryByLabelText("Descripción")).toBeNull();
    expect(screen.queryByRole("button", { name: "Negrita" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar descripción" })).toBeNull();
    expect(screen.getByText("Notas de la hornada")).toBeInTheDocument();
  });
});
