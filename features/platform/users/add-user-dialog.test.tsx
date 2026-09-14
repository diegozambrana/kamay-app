import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddUserDialog } from "./add-user-dialog";

const addUserToOrganization = vi.hoisted(() => vi.fn());
vi.mock("@/actions/platform", () => ({ addUserToOrganization }));

const B = "10000000-0000-0000-0000-00000000000b";
const ORGS = [
  { id: B, name: "Taller B" },
  { id: "10000000-0000-0000-0000-00000000000c", name: "Taller C" },
];

beforeEach(() => addUserToOrganization.mockReset());
afterEach(cleanup);

async function open(props: React.ComponentProps<typeof AddUserDialog> = { organizations: ORGS }) {
  render(<AddUserDialog {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Agregar usuario" }));
}

/**
 * KAM-26 · «Agregar usuario». Escenarios de `platform-administration` → *A
 * platform admin adds a user to an organization from the platform views* a
 * nivel de componente.
 */
describe("AddUserDialog", () => {
  it("agrega una cuenta existente a la organización elegida", async () => {
    // «Adding an existing account from the Users view».
    addUserToOrganization.mockResolvedValue({ kind: "created", email: "ana@kamay.test" });
    await open();

    await userEvent.type(screen.getByLabelText("Correo"), "ana@kamay.test");
    await userEvent.selectOptions(screen.getByLabelText("Organización"), B);
    await userEvent.selectOptions(screen.getByLabelText("Rol"), "owner");
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(addUserToOrganization).toHaveBeenCalledWith({
      organizationId: B,
      email: "ana@kamay.test",
      role: "owner",
      displayName: "",
    });
    expect(await screen.findByTestId("add-user-result")).toHaveTextContent(
      "ana@kamay.test ya es parte de Taller B.",
    );
  });

  it("un correo sin cuenta queda invitado y el enlace se muestra", async () => {
    // «Adding an email with no account invites it».
    addUserToOrganization.mockResolvedValue({
      kind: "invited",
      email: "nueva@kamay.test",
      inviteUrl: "http://localhost:3010/auth/invite/tok",
    });
    await open();

    await userEvent.type(screen.getByLabelText("Correo"), "nueva@kamay.test");
    await userEvent.selectOptions(screen.getByLabelText("Organización"), B);
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByTestId("invite-url")).toHaveTextContent("/auth/invite/tok");
    expect(screen.getByTestId("add-user-result")).toHaveTextContent("todavía no tiene cuenta");
  });

  it("si ya pertenecía, lo dice", async () => {
    // «Adding someone who already belongs is reported».
    addUserToOrganization.mockResolvedValue({ kind: "already_member", email: "ana@kamay.test" });
    await open();

    await userEvent.type(screen.getByLabelText("Correo"), "ana@kamay.test");
    await userEvent.selectOptions(screen.getByLabelText("Organización"), B);
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByTestId("add-user-result")).toHaveTextContent(
      "ya pertenecía a Taller B; no se cambió nada",
    );
  });

  it("sin organización elegida no se envía", async () => {
    await open();
    await userEvent.type(screen.getByLabelText("Correo"), "ana@kamay.test");
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Elige una organización");
    expect(addUserToOrganization).not.toHaveBeenCalled();
  });

  it("desde el detalle la organización viene dada y no se elige", async () => {
    // «The organization's detail preselects the organization».
    addUserToOrganization.mockResolvedValue({ kind: "created", email: "ana@kamay.test" });
    await open({ organization: ORGS[0], defaultRole: "owner" });

    expect(screen.queryByRole("combobox", { name: "Organización" })).toBeNull();
    expect(screen.getByText("Taller B")).toBeInTheDocument();
    expect(screen.getByLabelText("Rol")).toHaveValue("owner");

    await userEvent.type(screen.getByLabelText("Correo"), "ana@kamay.test");
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(addUserToOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: B, role: "owner" }),
    );
  });

  it("muestra el error de la acción", async () => {
    addUserToOrganization.mockResolvedValue({
      error: "Ese correo ya tiene una invitación pendiente en esta organización.",
    });
    await open();
    await userEvent.type(screen.getByLabelText("Correo"), "x@kamay.test");
    await userEvent.selectOptions(screen.getByLabelText("Organización"), B);
    await userEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invitación pendiente");
  });
});
