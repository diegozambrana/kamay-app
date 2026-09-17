import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityPickerField } from "./entity-picker-field";

afterEach(cleanup);

function renderField(value: string | null) {
  const onOpen = vi.fn();
  const onClear = vi.fn();
  render(
    <EntityPickerField
      id="customer-trigger"
      value={value}
      selectLabel="Seleccionar cliente"
      changeLabel="Cambiar cliente"
      clearLabel="Quitar cliente"
      onOpen={onOpen}
      onClear={onClear}
    />,
  );
  return { onOpen, onClear };
}

describe("EntityPickerField", () => {
  it("sin valor ofrece seleccionar, con el id en el botón", async () => {
    const { onOpen } = renderField(null);

    const button = screen.getByRole("button", { name: "Seleccionar cliente" });
    expect(button).toHaveAttribute("id", "customer-trigger");
    expect(screen.queryByRole("button", { name: "Quitar cliente" })).toBeNull();

    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("con valor muestra el nombre y los botones de cambiar y quitar", async () => {
    const { onOpen, onClear } = renderField("Colegio San Andrés");

    expect(screen.getByText("Colegio San Andrés")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Seleccionar cliente" })).toBeNull();

    const change = screen.getByRole("button", { name: "Cambiar cliente" });
    expect(change).toHaveAttribute("id", "customer-trigger");
    await userEvent.click(change);
    expect(onOpen).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Quitar cliente" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
