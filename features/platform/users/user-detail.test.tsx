import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserDetail } from "./user-detail";

const actions = vi.hoisted(() => ({
  archiveMembership: vi.fn(async () => undefined),
  assignMemberships: vi.fn(),
  restoreMembership: vi.fn(async () => undefined),
  setMembershipDisplayName: vi.fn(async () => undefined),
  setMembershipRole: vi.fn(async () => undefined),
}));
vi.mock("@/actions/platform", () => actions);

const B = "10000000-0000-0000-0000-00000000000b";
const C = "10000000-0000-0000-0000-00000000000c";
const A = "10000000-0000-0000-0000-00000000000a";

const user = {
  id: "u1",
  email: "ana@kamay.test",
  createdAt: "2026-09-01T00:00:00Z",
  lastSignInAt: null,
  platformAdmin: true,
  memberships: [
    {
      membershipId: "m1",
      organizationId: A,
      organizationName: "Taller A",
      role: "assistant" as const,
      displayName: "Ana",
      archivedAt: null,
    },
  ],
};

const organizations = [
  { id: A, name: "Taller A" },
  { id: B, name: "Taller B" },
  { id: C, name: "Taller C" },
];

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockClear();
});
afterEach(cleanup);

describe("UserDetail", () => {
  it("el correo y la condición de super admin son de solo lectura, sin contraseña", () => {
    // Escenarios «Email and password are not editable» y «No screen offers
    // the grant».
    render(<UserDetail user={user} organizations={organizations} />);

    expect(screen.getByTestId("user-email")).toHaveTextContent("ana@kamay.test");
    expect(screen.queryByRole("textbox", { name: /correo/i })).toBeNull();
    expect(screen.queryByText(/contraseña/i)).toBeNull();
    const badge = screen.getByTestId("platform-admin-badge");
    expect(badge.tagName).not.toBe("BUTTON");
    expect(screen.queryByRole("button", { name: /administrador/i })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /administrador/i })).toBeNull();
  });

  it("asigna dos organizaciones en un paso, con un rol por cada una", async () => {
    // Escenario «Assigning two organizations at once» en la interfaz.
    actions.assignMemberships.mockResolvedValue({
      outcomes: [
        { organizationId: B, status: "created" },
        { organizationId: C, status: "already_member" },
      ],
    });
    render(<UserDetail user={user} organizations={organizations} />);

    // Solo se ofrecen las organizaciones donde no tiene acceso.
    expect(screen.queryByLabelText("Taller A")).toBeNull();

    await userEvent.click(screen.getByLabelText("Taller B"));
    await userEvent.selectOptions(screen.getByLabelText("Rol en Taller B"), "owner");
    await userEvent.click(screen.getByLabelText("Taller C"));
    await userEvent.click(screen.getByRole("button", { name: "Asignar" }));

    expect(actions.assignMemberships).toHaveBeenCalledWith({
      userId: "u1",
      assignments: [
        { organizationId: B, role: "owner", displayName: "Ana" },
        { organizationId: C, role: "assistant", displayName: "Ana" },
      ],
    });
    expect(await screen.findByTestId("assignment-report")).toHaveTextContent(
      "Taller B: agregada · Taller C: ya pertenecía",
    );
  });

  it("filtra las organizaciones sin perder las elegidas", async () => {
    render(<UserDetail user={user} organizations={organizations} moreOrganizations />);

    await userEvent.click(screen.getByLabelText("Taller B"));
    await userEvent.type(screen.getByLabelText("Filtrar organizaciones"), "c");

    expect(screen.getByLabelText("Taller B")).toBeChecked();
    expect(screen.getByLabelText("Taller C")).toBeInTheDocument();
    expect(screen.getByText(/Hay más organizaciones/)).toBeInTheDocument();
  });

  it("cambia el rol y el nombre de una membresía", async () => {
    render(<UserDetail user={user} organizations={organizations} />);

    await userEvent.selectOptions(screen.getAllByLabelText("Rol en Taller A")[0], "owner");
    expect(actions.setMembershipRole).toHaveBeenCalledWith({
      organizationId: A,
      membershipId: "m1",
      role: "owner",
    });

    const name = screen.getByLabelText("Nombre visible en Taller A");
    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    await userEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    expect(actions.setMembershipDisplayName).toHaveBeenCalledWith({
      organizationId: A,
      membershipId: "m1",
      displayName: "Ana María",
    });
  });
});
