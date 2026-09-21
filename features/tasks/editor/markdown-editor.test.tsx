import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "./markdown-editor";

// La guardia de descarte se apoya en el router de la aplicación; aquí basta
// con que exista.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

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

/** Abre el editor: desde KAM-29 el cuerpo se lee por omisión. */
async function abrirEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("edit-body"));
}

describe("el cuerpo se lee por omisión", () => {
  it("se abre rendido, sin editor (Abrir una tarea muestra el cuerpo rendido)", () => {
    renderEditor("Set de **6 tazas** de gres");

    expect(screen.getByText("6 tazas").tagName).toBe("STRONG");
    expect(screen.queryByLabelText("Descripción")).toBeNull();
    expect(screen.queryByRole("button", { name: "Negrita" })).toBeNull();
  });

  it("activar el cuerpo no abre el editor (Activar el cuerpo no abre el editor)", async () => {
    renderEditor("Notas de la hornada");
    const user = userEvent.setup();

    await user.click(screen.getByText("Notas de la hornada"));

    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });

  it("una tarea sin cuerpo invita a escribirlo (Una tarea puede no tener cuerpo)", async () => {
    renderEditor("");
    const user = userEvent.setup();

    const invitacion = screen.getByTestId("write-body");
    expect(screen.queryByLabelText("Descripción")).toBeNull();

    await user.click(invitacion);
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
  });

  it("una tarea archivada se lee y no ofrece editar (Una tarea archivada se lee y no se edita)", () => {
    renderEditor("Notas de la hornada", { readOnly: true });

    expect(screen.getByText("Notas de la hornada")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-body")).toBeNull();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
    expect(screen.queryByRole("button", { name: "Negrita" })).toBeNull();
  });
});

describe("editor del cuerpo", () => {
  it("aplica negrita desde la barra sin saber Markdown (Aplicar formato sin saber Markdown)", async () => {
    renderEditor("Set de 6 tazas de gres");
    const user = userEvent.setup();
    await abrirEditor(user);

    const area = screen.getByLabelText("Descripción") as HTMLTextAreaElement;
    area.setSelectionRange(7, 14);
    await user.click(screen.getByRole("button", { name: "Negrita" }));

    expect(area).toHaveValue("Set de **6 tazas** de gres");
  });

  it("crea una lista de verificación desde la barra (Crear una lista de verificación desde la barra)", async () => {
    renderEditor("");
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.click(screen.getByRole("button", { name: "Lista de verificación" }));

    expect(screen.getByLabelText("Descripción")).toHaveValue("- [ ] Paso");
  });

  it("la sintaxis escrita a mano funciona igual (La sintaxis escrita a mano funciona igual)", async () => {
    renderEditor("");
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.type(screen.getByLabelText("Descripción"), "Una **taza** de gres");
    await user.click(screen.getByRole("radio", { name: "Vista previa" }));

    expect(screen.getByText("taza").tagName).toBe("STRONG");
  });

  it("guarda el cuerpo tal como se escribió (El cuerpo se guarda tal cual)", async () => {
    const { onSave } = renderEditor("");
    const user = userEvent.setup();
    await abrirEditor(user);

    const texto = "## Hornada 07\n\n- [ ] Modelado";
    // Se pega en vez de teclear: `user.type` lee `[` y `{` como descriptores
    // de tecla, no como texto.
    await user.click(screen.getByLabelText("Descripción"));
    await user.paste(texto);
    await user.click(screen.getByTestId("save-body"));

    // Ni una transformación: lo que se escribió es lo que viaja.
    expect(onSave).toHaveBeenCalledWith(texto);
  });

  it("guardar cierra el editor y vuelve a la lectura (Guardar vuelve a la lectura)", async () => {
    const { onSave } = renderEditor("");
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.type(screen.getByLabelText("Descripción"), "Notas");
    await user.click(screen.getByTestId("save-body"));

    expect(onSave).toHaveBeenCalledWith("Notas");
    expect(await screen.findByTestId("edit-body")).toBeInTheDocument();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });

  it("salir del campo ya no guarda: el único guardado es el botón", async () => {
    // Con *Guardar* y *Cancelar* explícitos, guardar al desenfocar convertiría
    // «pulsé Cancelar» en «ya se había guardado al salir del campo».
    const { onSave } = renderEditor("");
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.type(screen.getByLabelText("Descripción"), "Notas");
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancelar con cambios pregunta y descarta (Cancelar descarta lo escrito)", async () => {
    const { onSave } = renderEditor("Lo guardado");
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.clear(screen.getByLabelText("Descripción"));
    await user.type(screen.getByLabelText("Descripción"), "Borrador");
    await user.click(screen.getByTestId("cancel-body"));

    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-discard"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Lo guardado")).toBeInTheDocument();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });

  it("cancelar sin cambios no pregunta nada (Cancelar sin cambios no pregunta nada)", async () => {
    renderEditor("Lo guardado");
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.click(screen.getByTestId("cancel-body"));

    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
    expect(screen.getByText("Lo guardado")).toBeInTheDocument();
  });

  it("cuenta el error del servidor sin perder lo escrito ni cerrar", async () => {
    const onSave = vi.fn().mockResolvedValue({ error: "No se pudo guardar." });
    renderEditor("", { onSave });
    const user = userEvent.setup();
    await abrirEditor(user);

    await user.type(screen.getByLabelText("Descripción"), "Notas");
    await user.click(screen.getByTestId("save-body"));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar.");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Notas");
  });

  it("el editor parte siempre del cuerpo guardado", async () => {
    // El cuerpo puede haber cambiado por detrás —marcar una casilla lo
    // reescribe en el servidor—, así que el borrador nace al entrar.
    const { onSave } = renderEditor("Cuerpo guardado");
    const user = userEvent.setup();
    await abrirEditor(user);

    expect(screen.getByLabelText("Descripción")).toHaveValue("Cuerpo guardado");

    await user.click(screen.getByTestId("cancel-body"));
    await abrirEditor(user);

    expect(screen.getByLabelText("Descripción")).toHaveValue("Cuerpo guardado");
    expect(onSave).not.toHaveBeenCalled();
  });
});
