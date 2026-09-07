import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Tag } from "@/types";

import { TagPicker } from "./tag-picker";

const ORG = "11111111-1111-4111-8111-111111111111";

const available: Tag[] = [
  { id: "t1", organizationId: ORG, name: "Hornada-07" },
  { id: "t2", organizationId: ORG, name: "Sublimación" },
];

afterEach(cleanup);

/**
 * KAM-15 · Escenarios del delta spec `tasks` — requisito "Etiquetas por
 * organización creadas al vuelo": «Etiqueta nueva desde la tarea», «Búsqueda
 * tolerante a tildes», «La misma etiqueta no se duplica».
 */
describe("TagPicker", () => {
  it("buscar sin tilde encuentra la etiqueta con tilde", () => {
    render(<TagPicker available={available} value={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "sublimacion" },
    });

    expect(screen.getByRole("button", { name: "Sublimación" })).toBeInTheDocument();
  });

  it("ofrece la existente antes que crear una nueva", () => {
    render(<TagPicker available={available} value={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "hornada-07" },
    });

    // Coincidencia exacta ya normalizada: no se ofrece crear una segunda.
    expect(screen.queryByTestId("create-tag")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hornada-07" })).toBeInTheDocument();
  });

  it("ofrece crear cuando no existe ninguna parecida", () => {
    render(<TagPicker available={available} value={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "feria-agosto" },
    });

    expect(screen.getByTestId("create-tag")).toBeInTheDocument();
  });

  it("crear una etiqueta la añade con el nombre tal como se escribió", () => {
    const onChange = vi.fn();
    render(<TagPicker available={available} value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "Feria de Agosto" },
    });
    screen.getByTestId("create-tag").click();

    expect(onChange).toHaveBeenCalledWith(["Feria de Agosto"]);
  });

  it("elegir una existente la añade con su nombre guardado", () => {
    const onChange = vi.fn();
    render(<TagPicker available={available} value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "hornada" },
    });
    screen.getByRole("button", { name: "Hornada-07" }).click();

    expect(onChange).toHaveBeenCalledWith(["Hornada-07"]);
  });

  it("una etiqueta ya elegida no vuelve a ofrecerse como sugerencia", () => {
    render(
      <TagPicker available={available} value={["Hornada-07"]} onChange={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "hornada" },
    });

    // La sugerencia desaparece porque ya está puesta. Crear «hornada» sí sigue
    // ofreciéndose: es otro nombre, no un duplicado de «Hornada-07».
    expect(screen.queryByRole("button", { name: "Hornada-07" })).not.toBeInTheDocument();
  });

  it("escribir exactamente una etiqueta ya elegida no ofrece crearla otra vez", () => {
    render(
      <TagPicker available={available} value={["Hornada-07"]} onChange={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Etiquetas"), {
      target: { value: "HORNADA-07" },
    });

    expect(screen.queryByTestId("create-tag")).not.toBeInTheDocument();
  });

  it("quitar una etiqueta la saca de la selección", () => {
    const onChange = vi.fn();
    render(
      <TagPicker available={available} value={["Hornada-07"]} onChange={onChange} />,
    );

    screen.getByLabelText("Quitar Hornada-07").click();

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
