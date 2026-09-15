import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  updateRetentionPolicy: vi.fn(async () => undefined),
}));

import { updateRetentionPolicy } from "@/actions/configuration";

import { RetentionForm } from "./retention-form";

afterEach(cleanup);

// Spec `settings-interaction` → «Saving retention does not ask for confirmation».
describe("RetentionForm", () => {
  it("guardar los meses los guarda en la página, sin ningún diálogo", async () => {
    render(<RetentionForm months={12} />);

    const months = screen.getByLabelText("Meses de detalle completo");
    await userEvent.clear(months);
    await userEvent.type(months, "24");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateRetentionPolicy).toHaveBeenCalledWith({ months: 24 });
    expect(await screen.findByRole("status")).toHaveTextContent("Retención guardada");
  });
});
