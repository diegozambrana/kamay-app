import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentPanel, type TaskAttachment } from "./attachment-panel";
import { useTaskUploadStore } from "./upload-store";

const enqueued: { taskId: string; files: File[] }[] = [];

vi.mock("./upload-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./upload-store")>();
  return {
    ...actual,
    useTaskUploadStore: Object.assign(
      (selector: (state: unknown) => unknown) =>
        selector({
          uploads: actual.useTaskUploadStore.getState().uploads,
          enqueue: async (taskId: string, files: File[]) => {
            enqueued.push({ taskId, files });
          },
          dismiss: actual.useTaskUploadStore.getState().dismiss,
        }),
      { getState: actual.useTaskUploadStore.getState, setState: actual.useTaskUploadStore.setState },
    ),
  };
});

afterEach(cleanup);

const TASK = "22222222-2222-4222-8222-222222222222";

function adjunto(overrides: Partial<TaskAttachment> = {}): TaskAttachment {
  return {
    id: crypto.randomUUID(),
    fileName: "foto.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 120_000,
    uploadedByName: "Julio Terán",
    url: "https://firmada/foto.jpg",
    ...overrides,
  };
}

function llenar(cantidad: number): TaskAttachment[] {
  return Array.from({ length: cantidad }, (_, i) =>
    adjunto({ fileName: `foto-${i}.jpg` }),
  );
}

function imagen(name = "taza.jpg"): File {
  return new File(["x"], name, { type: "image/jpeg" });
}

function renderPanel(
  attachments: TaskAttachment[] = [],
  {
    onDetach = vi.fn().mockResolvedValue(undefined),
    readOnly = false,
  } = {},
) {
  render(
    <AttachmentPanel
      taskId={TASK}
      attachments={attachments}
      onDetach={onDetach}
      readOnly={readOnly}
    />,
  );
  return onDetach;
}

/** Suelta archivos sobre la zona de arrastre. */
async function soltar(files: File[]) {
  const zona = screen.getByTestId("file-dropzone");
  const dataTransfer = { files, items: [], types: ["Files"] };
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.drop(zona, { dataTransfer });
}

beforeEach(() => {
  enqueued.length = 0;
  useTaskUploadStore.setState({ uploads: [] });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

describe("panel de adjuntos", () => {
  it("arrastrar una imagen la encola para subir", async () => {
    renderPanel();

    await soltar([imagen()]);

    await waitFor(() => expect(enqueued).toHaveLength(1));
    expect(enqueued[0].taskId).toBe(TASK);
    expect(enqueued[0].files[0].name).toBe("taza.jpg");
  });

  it("ofrece elegir del equipo además de arrastrar", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: /elegir/i })).toBeInTheDocument();
  });

  it("un archivo que no es imagen se muestra sin miniatura", () => {
    renderPanel([
      adjunto({
        fileName: "ficha-esmalte.pdf",
        mimeType: "application/pdf",
        sizeBytes: 248_000,
        url: "https://firmada/ficha.pdf",
      }),
    ]);

    expect(screen.getByText("ficha-esmalte.pdf")).toBeInTheDocument();
    expect(screen.queryByTestId("attachment-thumbnail")).toBeNull();
    expect(screen.getByText(/subido por Julio Terán/)).toBeInTheDocument();
  });

  it("una imagen sí muestra miniatura", () => {
    renderPanel([adjunto()]);

    expect(screen.getByTestId("attachment-thumbnail")).toBeInTheDocument();
  });

  it("sin conexión avisa y no encola nada", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderPanel();

    await soltar([imagen()]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    expect(enqueued).toHaveLength(0);
  });

  it("el decimosexto no entra", async () => {
    renderPanel(llenar(15));

    await soltar([imagen()]);

    expect(await screen.findByRole("alert")).toHaveTextContent("ya tiene 15 adjuntos");
    expect(enqueued).toHaveLength(0);
  });

  it("un lote que desborda el límite se rechaza entero", async () => {
    renderPanel(llenar(13));

    await soltar([imagen("a.jpg"), imagen("b.jpg"), imagen("c.jpg"), imagen("d.jpg"), imagen("e.jpg")]);

    // Ni dos sí y tres no: el lote entero se rechaza, para no dejar la tarea
    // en quince con tres errores.
    expect(await screen.findByRole("alert")).toHaveTextContent("Solo caben 2 adjuntos más");
    expect(enqueued).toHaveLength(0);
  });

  it("un lote que cabe justo sí entra", async () => {
    renderPanel(llenar(13));

    await soltar([imagen("a.jpg"), imagen("b.jpg")]);

    await waitFor(() => expect(enqueued).toHaveLength(1));
    expect(enqueued[0].files).toHaveLength(2);
  });

  it("quitar un adjunto lo pide por su identificador", async () => {
    const uno = adjunto({ fileName: "foto.jpg" });
    const onDetach = renderPanel([uno]);

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Quitar foto.jpg" }),
    );

    expect(onDetach).toHaveBeenCalledExactlyOnceWith(uno.id);
  });

  it("una tarea sin adjuntos lo dice", () => {
    renderPanel();

    expect(screen.getByTestId("empty-attachments")).toBeInTheDocument();
  });

  it("una tarea archivada conserva sus adjuntos y no ofrece agregar ni quitar", () => {
    renderPanel([adjunto()], { readOnly: true });

    expect(screen.getByTestId("attachment")).toBeInTheDocument();
    expect(screen.queryByTestId("file-dropzone")).toBeNull();
    expect(screen.queryByRole("button", { name: /Quitar/ })).toBeNull();
  });
});
