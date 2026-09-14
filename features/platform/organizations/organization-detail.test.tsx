import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformUser } from "@/lib/platform/users";

import { OrganizationDetail, teamOf } from "./organization-detail";

const actions = vi.hoisted(() => ({
  addUserToOrganization: vi.fn(),
  archiveMembership: vi.fn(async () => undefined),
  restoreMembership: vi.fn(async () => undefined),
  setMembershipRole: vi.fn(async () => undefined),
  updateOrganization: vi.fn(async () => undefined),
}));
vi.mock("@/actions/platform", () => actions);

const ORG = "10000000-0000-0000-0000-00000000000b";

const organization = {
  id: ORG,
  name: "Taller B",
  currency: "BOB",
  timezone: "America/La_Paz",
  createdAt: "2026-09-01T00:00:00Z",
  archivedAt: null,
  owners: ["Dueña"],
  activeMembers: 1,
};

const account = (id: string, email: string, memberships: PlatformUser["memberships"] = []) => ({
  id,
  email,
  createdAt: "2026-09-01T00:00:00Z",
  lastSignInAt: null,
  platformAdmin: false,
  memberships,
});

const ex = account("u2", "ex@kamay.test", [
  {
    membershipId: "m2",
    organizationId: ORG,
    organizationName: "Taller B",
    role: "assistant",
    displayName: "Ex",
    archivedAt: "2026-09-02T00:00:00Z",
  },
]);
const duena = account("u1", "duena@kamay.test", [
  {
    membershipId: "m1",
    organizationId: ORG,
    organizationName: "Taller B",
    role: "owner",
    displayName: "Dueña",
    archivedAt: null,
  },
]);

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockClear();
});
afterEach(cleanup);

function renderDetail(members: PlatformUser[] = [ex, duena]) {
  return render(<OrganizationDetail organization={organization} members={members} />);
}

describe("OrganizationDetail", () => {
  it("lista el equipo en una tabla con su correo, primero quien tiene acceso", () => {
    // Escenario «Members are listed with their email».
    renderDetail();

    const table = screen.getByRole("table", { name: "Equipo de Taller B" });
    const [first, second] = within(table).getAllByTestId("platform-member");
    expect(first).toHaveTextContent("Dueña");
    expect(first).toHaveTextContent("duena@kamay.test");
    expect(first).toHaveTextContent("Activo");
    expect(second).toHaveTextContent("ex@kamay.test");
    expect(second).toHaveTextContent("Sin acceso");
  });

  it("cambia el rol desde la tabla", async () => {
    renderDetail();
    const table = screen.getByRole("table");
    await userEvent.selectOptions(
      within(table).getByLabelText("Rol de duena@kamay.test"),
      "assistant",
    );
    expect(actions.setMembershipRole).toHaveBeenCalledWith({
      organizationId: ORG,
      membershipId: "m1",
      role: "assistant",
    });
  });

  it("quita y devuelve el acceso desde el menú de cada fila", async () => {
    renderDetail();
    const table = screen.getByRole("table");

    await userEvent.click(within(table).getByRole("button", { name: "Acciones de duena@kamay.test" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Quitar acceso" }));
    expect(actions.archiveMembership).toHaveBeenCalledWith({ organizationId: ORG, membershipId: "m1" });

    await userEvent.click(within(table).getByRole("button", { name: "Acciones de ex@kamay.test" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Devolver acceso" }));
    expect(actions.restoreMembership).toHaveBeenCalledWith({ organizationId: ORG, membershipId: "m2" });
  });

  it("el error del último dueño se muestra", async () => {
    actions.archiveMembership.mockResolvedValueOnce({
      error: "La organización debe conservar al menos un dueño activo.",
    } as never);
    renderDetail();
    const table = screen.getByRole("table");

    await userEvent.click(within(table).getByRole("button", { name: "Acciones de duena@kamay.test" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Quitar acceso" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("al menos un dueño activo");
  });

  it("«Agregar usuario» viene con la organización elegida y propone dueña si no hay", async () => {
    renderDetail([]);
    expect(screen.getByText("Todavía no tiene a nadie. Usa «Agregar usuario».")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Agregar usuario" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Taller B")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Rol")).toHaveValue("owner");
  });

  it("guarda los datos de la organización", async () => {
    renderDetail();
    await userEvent.clear(screen.getByLabelText("Zona horaria"));
    await userEvent.type(screen.getByLabelText("Zona horaria"), "America/Lima");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(actions.updateOrganization).toHaveBeenCalledWith({
      organizationId: ORG,
      name: "Taller B",
      currency: "BOB",
      timezone: "America/Lima",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados.");
  });
});

describe("teamOf", () => {
  it("toma solo las membresías de esta organización", () => {
    const other = account("u3", "otra@kamay.test", [
      {
        membershipId: "m3",
        organizationId: "otra",
        organizationName: "Otra",
        role: "owner",
        displayName: "Otra",
        archivedAt: null,
      },
    ]);
    expect(teamOf(ORG, [duena, other]).map((m) => m.email)).toEqual(["duena@kamay.test"]);
  });
});
