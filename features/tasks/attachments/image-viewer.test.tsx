import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskAttachment } from "./attachment-panel";
import { ImageViewer } from "./image-viewer";

afterEach(cleanup);

function imagen(name: string): TaskAttachment {
  return {
    id: `id-${name}`,
    fileName: name,
    mimeType: "image/jpeg",
    sizeBytes: 120_000,
    uploadedByName: "Julio Terán",
    url: `https://firmada/${name}`,
  };
}

const TRES = [imagen("una.jpg"), imagen("dos.jpg"), imagen("tres.jpg")];

/**
 * El visor es **controlado**: el índice lo lleva el panel. Esta cáscara hace
 * de panel para que las pruebas ejerciten la navegación de verdad.
 */
function Host({
  images,
  openAt,
  onClose,
  onDetach,
}: {
  images: TaskAttachment[];
  openAt: number | null;
  onClose: () => void;
  onDetach?: (id: string) => Promise<{ error: string } | undefined>;
}) {
  const [index, setIndex] = useState<number | null>(openAt);

  return (
    <ImageViewer
      images={images}
      index={index}
      onIndexChange={setIndex}
      onClose={() => {
        setIndex(null);
        onClose();
      }}
      onDetach={onDetach}
    />
  );
}

function renderViewer(
  images: TaskAttachment[] = TRES,
  {
    openAt = 0 as number | null,
    onClose = vi.fn(),
    onDetach = vi.fn().mockResolvedValue(undefined) as
      | ((id: string) => Promise<{ error: string } | undefined>)
      | undefined,
  } = {},
) {
  render(
    <Host images={images} openAt={openAt} onClose={onClose} onDetach={onDetach} />,
  );
  return { onClose, onDetach };
}

/**
 * KAM-29 · Escenarios del delta spec `task-detail`, requisito «Los adjuntos se
 * agregan arrastrando o eligiendo del equipo».
 */
describe("visor de imágenes", () => {
  it("muestra la imagen y su nombre (Una imagen se ve dentro de la pantalla)", () => {
    renderViewer();

    expect(screen.getByTestId("viewer-image")).toHaveAttribute(
      "src",
      "https://firmada/una.jpg",
    );
    expect(screen.getByText("una.jpg")).toBeInTheDocument();
    expect(screen.getByText("Imagen 1 de 3")).toBeInTheDocument();
  });

  it("cerrado no rinde nada", () => {
    renderViewer(TRES, { openAt: null });

    expect(screen.queryByTestId("image-viewer")).toBeNull();
  });

  it("pasa a la siguiente con el botón (El visor pasa de una imagen a otra)", async () => {
    renderViewer();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Imagen siguiente" }),
    );

    expect(screen.getByTestId("viewer-image")).toHaveAttribute(
      "src",
      "https://firmada/dos.jpg",
    );
    // Sin cerrarse.
    expect(screen.getByTestId("image-viewer")).toBeInTheDocument();
  });

  it("pasa a la siguiente y a la anterior con las flechas", async () => {
    renderViewer();
    const user = userEvent.setup();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("viewer-image")).toHaveAttribute(
      "src",
      "https://firmada/dos.jpg",
    );

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("viewer-image")).toHaveAttribute(
      "src",
      "https://firmada/una.jpg",
    );
  });

  it("da la vuelta al llegar al final", async () => {
    renderViewer(TRES, { openAt: 2 });

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Imagen siguiente" }),
    );

    expect(screen.getByTestId("viewer-image")).toHaveAttribute(
      "src",
      "https://firmada/una.jpg",
    );
  });

  it("con una sola imagen no ofrece navegación", () => {
    renderViewer([imagen("sola.jpg")]);

    expect(screen.queryByRole("button", { name: "Imagen siguiente" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Imagen anterior" })).toBeNull();
  });

  it("quitar la última cierra el visor", async () => {
    const { onClose, onDetach } = renderViewer([imagen("sola.jpg")]);

    await userEvent.setup().click(screen.getByTestId("viewer-detach"));

    expect(onDetach).toHaveBeenCalledWith("id-sola.jpg");
    // Dejar abierto un visor sobre una imagen que ya no existe sería mentir.
    expect(onClose).toHaveBeenCalled();
  });

  it("quitar una de varias no cierra el visor", async () => {
    const { onClose, onDetach } = renderViewer();

    await userEvent.setup().click(screen.getByTestId("viewer-detach"));

    expect(onDetach).toHaveBeenCalledWith("id-una.jpg");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("un fallo al quitar se cuenta y no cierra", async () => {
    const onDetach = vi.fn().mockResolvedValue({ error: "No se pudo quitar." });
    const { onClose } = renderViewer(TRES, { onDetach });

    await userEvent.setup().click(screen.getByTestId("viewer-detach"));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo quitar.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sin poder quitar —tarea archivada— no ofrece la acción", () => {
    // Sin `onDetach`: el valor por omisión de `renderViewer` pisaría un
    // `undefined` explícito, así que se rinde el anfitrión a mano.
    render(<Host images={TRES} openAt={0} onClose={vi.fn()} />);

    expect(screen.queryByTestId("viewer-detach")).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir original" })).toHaveAttribute(
      "href",
      "https://firmada/una.jpg",
    );
  });

  it("Esc lo cierra sin cambiar nada", async () => {
    const { onClose, onDetach } = renderViewer();

    await userEvent.setup().keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(onDetach).not.toHaveBeenCalled();
  });
});
