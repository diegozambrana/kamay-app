import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileDropzone } from "./file-dropzone";

function file(name: string, type: string, size: number): File {
  const made = new File(["x"], name, { type });
  // `File` no deja fijar el tamaño: se define para poder probar el límite.
  Object.defineProperty(made, "size", { value: size });
  return made;
}

const photo = file("taza.jpg", "image/jpeg", 120_000);
const pdf = file("factura.pdf", "application/pdf", 40_000);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom no implementa las URL de objeto que usa la vista previa.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("FileDropzone", () => {
  it("entrega los archivos soltados a quien lo usa", () => {
    const onChange = vi.fn();
    render(<FileDropzone value={[]} onChange={onChange} />);

    fireEvent.drop(screen.getByTestId("file-dropzone"), {
      dataTransfer: { files: [photo] },
    });

    expect(onChange).toHaveBeenCalledWith([photo]);
  });

  it("también se puede elegir desde el equipo", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FileDropzone value={[]} onChange={onChange} label="Foto del ítem" />);

    await user.upload(screen.getByLabelText("Foto del ítem"), photo);

    expect(onChange).toHaveBeenCalledWith([photo]);
  });

  it("una imagen muestra vista previa", () => {
    render(<FileDropzone value={[photo]} onChange={vi.fn()} />);

    const preview = screen.getByTestId("file-preview-image");
    expect(preview).toHaveAttribute("alt", "taza.jpg");
    // La vista previa apunta a una URL viva: si se revocara antes de que la
    // imagen cargue, quedaría rota (que es lo que pasaba al crearla en el
    // render y limpiarla en el efecto).
    expect(preview).toHaveAttribute("src", "blob:preview");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByTestId("file-preview-icon")).toBeNull();
  });

  it("al desmontar revoca la URL de la vista previa", () => {
    const { unmount } = render(<FileDropzone value={[photo]} onChange={vi.fn()} />);
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("otro tipo de archivo muestra el icono genérico", () => {
    render(<FileDropzone value={[pdf]} onChange={vi.fn()} />);

    expect(screen.getByTestId("file-preview-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("file-preview-image")).toBeNull();
  });

  it("indica el peso de cada archivo", () => {
    render(<FileDropzone value={[pdf]} onChange={vi.fn()} />);

    expect(screen.getByTestId("file-dropzone-list")).toHaveTextContent("39,1 KB");
  });

  it("rechaza lo que pasa del límite y lo dice con su peso", () => {
    const onChange = vi.fn();
    render(<FileDropzone value={[]} onChange={onChange} />);

    fireEvent.drop(screen.getByTestId("file-dropzone"), {
      dataTransfer: { files: [file("enorme.jpg", "image/jpeg", 6 * 1024 * 1024)] },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("6 MB");
  });

  it("con el cupo lleno ya no ofrece la zona de arrastre", () => {
    render(<FileDropzone value={[photo]} onChange={vi.fn()} maxFiles={1} />);

    expect(screen.queryByTestId("file-dropzone")).toBeNull();
  });

  it("se puede quitar un archivo elegido", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FileDropzone value={[photo]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Quitar taza.jpg" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
