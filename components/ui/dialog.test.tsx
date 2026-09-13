import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

afterEach(cleanup);

/** El patrón de la aplicación: un botón suelto que abre un diálogo controlado. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nuevo ítem</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Nuevo ítem</DialogTitle>
          <DialogDescription>Nombre y unidad.</DialogDescription>
          <input aria-label="Nombre" />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Spec `accessibility` → «A dialog traps and returns focus».
describe("Dialog · el foco vuelve a quien lo abrió", () => {
  it("sin DialogTrigger, cerrar con Escape devuelve el foco al botón", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Nuevo ítem" });
    opener.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("el botón de cerrar se anuncia en español", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Nuevo ítem" }));

    expect(await screen.findByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
