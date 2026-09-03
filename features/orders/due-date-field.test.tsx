import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DueDateField } from "./due-date-field";

afterEach(cleanup);

/** "Hoy" según la organización, no según el reloj de quien ejecuta la prueba. */
const TODAY = "2026-09-03";

function renderField(value: string | null = null) {
  const onChange = vi.fn();
  render(<DueDateField value={value} onChange={onChange} today={TODAY} />);
  return { onChange, user: userEvent.setup() };
}

describe("DueDateField", () => {
  it("«Hoy» fija la fecha que dio el servidor", async () => {
    const { onChange, user } = renderField();

    await user.click(screen.getByRole("button", { name: "Hoy" }));

    expect(onChange).toHaveBeenCalledWith(TODAY);
  });

  it("«Mañana» fija el día siguiente a ese hoy, no al del navegador", async () => {
    const { onChange, user } = renderField();

    await user.click(screen.getByRole("button", { name: "Mañana" }));

    expect(onChange).toHaveBeenCalledWith("2026-09-04");
  });

  it("los otros dos atajos suman tres días y una semana", async () => {
    const { onChange, user } = renderField();

    await user.click(screen.getByRole("button", { name: "En 3 días" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-06");

    await user.click(screen.getByRole("button", { name: "En una semana" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-10");
  });

  it("muestra la fecha que ya tiene el pedido", () => {
    renderField("2026-12-24");

    expect(screen.getByLabelText("Fecha comprometida")).toHaveValue("2026-12-24");
  });

  it("«Borrar» vacía el campo: sin fecha es un estado legítimo", async () => {
    const { onChange, user } = renderField("2026-12-24");

    await user.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("no ofrece «Borrar» cuando no hay fecha que borrar", () => {
    renderField(null);

    expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
  });

  it("muestra el error del campo cuando lo hay", () => {
    render(
      <DueDateField
        value={null}
        onChange={vi.fn()}
        today={TODAY}
        error="La fecha comprometida no tiene un formato válido"
      />,
    );

    expect(
      screen.getByText("La fecha comprometida no tiene un formato válido"),
    ).toBeInTheDocument();
  });
});
