import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/members", () => ({
  inviteMember: vi.fn(),
  changeMemberRole: vi.fn(async () => undefined),
  setMemberLines: vi.fn(async () => undefined),
  archiveMembership: vi.fn(async () => undefined),
  revokeInvitation: vi.fn(async () => undefined),
}));

import {
  archiveMembership,
  changeMemberRole,
  inviteMember,
  revokeInvitation,
  setMemberLines,
} from "@/actions/members";
import type { BusinessLine, Invitation, MemberRow } from "@/types";

import { MembersSection } from "./members-section";

function line(id: string, name: string): BusinessLine {
  return {
    id,
    organizationId: "org",
    name,
    color: "orange",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  };
}

const ALFARERIA = line("l1", "Alfarería");
const SUBLIMACION = line("l2", "Sublimación");

const OWNER: MemberRow = {
  id: "m1",
  organizationId: "org",
  userId: "u1",
  role: "owner",
  displayName: "Dueña Geeko",
  archivedAt: null,
};
const ASSISTANT: MemberRow = {
  id: "m2",
  organizationId: "org",
  userId: "u2",
  role: "assistant",
  displayName: "Ayudante Geeko",
  archivedAt: null,
};
const INVITATION: Invitation = {
  id: "i1",
  organizationId: "org",
  email: "nueva@kamay.test",
  role: "assistant",
  expiresAt: "2026-09-21T12:00:00Z",
  acceptedAt: null,
  archivedAt: null,
  createdAt: "2026-09-14T12:00:00Z",
};

function renderSection() {
  render(
    <MembersSection
      members={[OWNER, ASSISTANT]}
      invitations={[INVITATION]}
      lines={[ALFARERIA, SUBLIMACION]}
      assignedLines={{}}
    />,
  );
}

const team = () => screen.getByRole("table", { name: "Equipo" });

async function chooseFromRow(table: HTMLElement, label: string, action: string) {
  await userEvent.click(within(table).getByRole("button", { name: `Acciones de ${label}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

beforeEach(() => {
  vi.mocked(inviteMember).mockReset();
  vi.mocked(changeMemberRole).mockReset().mockResolvedValue(undefined);
  vi.mocked(setMemberLines).mockReset().mockResolvedValue(undefined);
  vi.mocked(archiveMembership).mockReset().mockResolvedValue(undefined);
  vi.mocked(revokeInvitation).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("MembersSection", () => {
  it("la fila no tiene selector de rol ni casillas: todo va al «⋯»", () => {
    renderSection();

    const row = within(team()).getByRole("row", { name: /Ayudante Geeko/ });
    expect(within(row).queryByRole("combobox")).toBeNull();
    expect(within(row).queryByRole("checkbox")).toBeNull();
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Acciones de Ayudante Geeko",
    ]);
    expect(row).toHaveTextContent("Todas");
  });

  // Spec `settings-interaction` → «Owner invites and copies the link from the dialog», nivel unitario.
  it("invitar muestra el enlace en el mismo diálogo, con su botón de copiar y el aviso", async () => {
    const user = userEvent.setup();
    vi.mocked(inviteMember).mockResolvedValue({
      inviteUrl: "http://localhost:3010/auth/invite/abc",
    });
    renderSection();

    await user.click(screen.getByRole("button", { name: "Invitar" }));
    const dialog = await screen.findByRole("dialog", { name: "Invitar" });
    await user.type(within(dialog).getByLabelText("Correo"), "otra@kamay.test");
    await user.click(within(dialog).getByRole("button", { name: "Invitar" }));

    expect(inviteMember).toHaveBeenCalledWith({ email: "otra@kamay.test", role: "assistant" });
    const created = await screen.findByRole("dialog", { name: "Invitación creada" });
    expect(within(created).getByTestId("invite-url")).toHaveTextContent(
      "http://localhost:3010/auth/invite/abc",
    );
    expect(created).toHaveTextContent("No se vuelve a mostrar");

    await user.click(within(created).getByRole("button", { name: "Copiar enlace" }));
    expect(await navigator.clipboard.readText()).toBe("http://localhost:3010/auth/invite/abc");
    expect(within(created).getByRole("button", { name: "Enlace copiado" })).toBeInTheDocument();

    // Al cerrarlo, el enlace se pierde: la próxima vez vuelve el formulario.
    await user.click(within(created).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Invitar" }));
    expect(await screen.findByRole("dialog", { name: "Invitar" })).toBeInTheDocument();
    expect(screen.queryByTestId("invite-url")).toBeNull();
  });

  // Spec `settings-interaction` → «Owner restricts an assistant to one line», nivel unitario.
  it("editar a un ayudante y marcar solo Alfarería guarda esa línea sin tocar el rol", async () => {
    const user = userEvent.setup();
    renderSection();

    await chooseFromRow(team(), "Ayudante Geeko", "Editar");
    const dialog = await screen.findByRole("dialog", { name: "Editar a Ayudante Geeko" });
    expect(dialog).toHaveTextContent("Sin ninguna marcada, ve las tareas de todas las líneas.");

    await user.click(within(dialog).getByLabelText("Alfarería para Ayudante Geeko"));
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(setMemberLines).toHaveBeenCalledWith({ membershipId: "m2", businessLineIds: ["l1"] }),
    );
    expect(changeMemberRole).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Spec `settings-interaction` → «Promoting to owner hides the lines».
  it("cambiar el rol a dueño oculta las líneas y guardar no las envía", async () => {
    const user = userEvent.setup();
    renderSection();

    await chooseFromRow(team(), "Ayudante Geeko", "Editar");
    const dialog = await screen.findByRole("dialog", { name: "Editar a Ayudante Geeko" });
    expect(within(dialog).getByTestId("line-picker")).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("Rol"));
    await user.click(await screen.findByRole("option", { name: "Dueña o dueño" }));
    expect(within(dialog).queryByTestId("line-picker")).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(changeMemberRole).toHaveBeenCalledWith({ membershipId: "m2", role: "owner" }),
    );
    expect(setMemberLines).not.toHaveBeenCalled();
  });

  it("si cambiar el rol falla, no se envían las líneas y el error queda en el diálogo", async () => {
    const user = userEvent.setup();
    vi.mocked(changeMemberRole).mockResolvedValue({
      error: "No se pudo cambiar el rol. Intenta de nuevo.",
    });
    renderSection();

    await chooseFromRow(team(), "Dueña Geeko", "Editar");
    const dialog = await screen.findByRole("dialog", { name: "Editar a Dueña Geeko" });
    await user.click(within(dialog).getByLabelText("Rol"));
    await user.click(await screen.findByRole("option", { name: "Ayudante" }));
    await user.click(within(dialog).getByLabelText("Sublimación para Dueña Geeko"));
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo cambiar el rol");
    expect(setMemberLines).not.toHaveBeenCalled();
  });

  // Spec `settings-interaction` → «Removing access asks first».
  it("«Quitar acceso» pide confirmación y «Cancelar» no lo quita", async () => {
    renderSection();

    await chooseFromRow(team(), "Ayudante Geeko", "Quitar acceso");
    const dialog = await screen.findByRole("alertdialog", {
      name: "¿Quitar el acceso a Ayudante Geeko?",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(archiveMembership).not.toHaveBeenCalled();
    expect(within(team()).getByText("Ayudante Geeko")).toBeInTheDocument();
  });

  // Spec `settings-interaction` → «The last owner cannot lose access», nivel unitario.
  it("si la base rechaza quitar al último dueño, la confirmación sigue abierta con el motivo", async () => {
    vi.mocked(archiveMembership).mockResolvedValue({
      error: "La organización debe conservar al menos una persona dueña.",
    });
    renderSection();

    await chooseFromRow(team(), "Dueña Geeko", "Quitar acceso");
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Quitar acceso" }));

    expect(archiveMembership).toHaveBeenCalledWith({ membershipId: "m1" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La organización debe conservar al menos una persona dueña.",
    );
  });

  // Spec `settings-interaction` → «Revoking an invitation asks first».
  it("«Revocar» una invitación pide confirmación y confirmar la revoca", async () => {
    renderSection();

    const invitations = screen.getByRole("table", { name: "Invitaciones pendientes" });
    await chooseFromRow(invitations, "nueva@kamay.test", "Revocar");
    const dialog = await screen.findByRole("alertdialog", {
      name: "¿Revocar la invitación de nueva@kamay.test?",
    });
    expect(revokeInvitation).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Revocar" }));

    expect(revokeInvitation).toHaveBeenCalledWith({ invitationId: "i1" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("quien no tiene acceso se lista aparte y sin acciones", () => {
    render(
      <MembersSection
        members={[OWNER, { ...ASSISTANT, archivedAt: "2026-09-01T00:00:00Z" }]}
        invitations={[]}
        lines={[ALFARERIA]}
        assignedLines={{}}
      />,
    );

    const archived = screen.getByRole("table", { name: "Sin acceso" });
    expect(within(archived).getByText("Ayudante Geeko")).toBeInTheDocument();
    expect(within(archived).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("table", { name: "Invitaciones pendientes" })).toBeNull();
  });
});
