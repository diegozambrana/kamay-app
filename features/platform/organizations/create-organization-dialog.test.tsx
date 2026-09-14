import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateOrganizationDialog } from "./create-organization-dialog";

const createOrganization = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("@/actions/platform", () => ({ createOrganization }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  createOrganization.mockReset();
  push.mockReset();
});
afterEach(cleanup);

async function open() {
  render(<CreateOrganizationDialog />);
  await userEvent.click(screen.getByRole("button", { name: "Nueva organización" }));
}

describe("CreateOrganizationDialog", () => {
  it("un nombre vacío no se envía", async () => {
    // Escenario «An empty name is rejected» en la interfaz.
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(screen.getByRole("alert")).toHaveTextContent("La organización necesita un nombre");
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it("propone la moneda y la zona horaria del producto", async () => {
    await open();
    expect(screen.getByLabelText("Moneda")).toHaveValue("BOB");
    expect(screen.getByLabelText("Zona horaria")).toHaveValue("America/La_Paz");
  });

  it("al crear lleva al detalle de la organización nueva", async () => {
    createOrganization.mockResolvedValue({ organizationId: "o9" });
    await open();
    await userEvent.type(screen.getByLabelText("Nombre"), "Taller Norte");
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(createOrganization).toHaveBeenCalledWith({
      name: "Taller Norte",
      currency: "BOB",
      timezone: "America/La_Paz",
    });
    expect(push).toHaveBeenCalledWith("/admin/organizations/o9");
  });

  it("muestra el error de la acción", async () => {
    createOrganization.mockResolvedValue({ error: "No se pudo crear la organización." });
    await open();
    await userEvent.type(screen.getByLabelText("Nombre"), "Taller Norte");
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo crear");
    expect(push).not.toHaveBeenCalled();
  });
});
