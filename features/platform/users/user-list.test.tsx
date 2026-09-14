import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserList } from "./user-list";

vi.mock("@/actions/platform", () => ({ addUserToOrganization: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/users",
  useSearchParams: () => new URLSearchParams(),
}));

const users = [
  {
    id: "u1",
    email: "geeko@kamay.test",
    createdAt: "2026-09-01T00:00:00Z",
    lastSignInAt: "2026-09-10T15:00:00Z",
    platformAdmin: false,
    memberships: [
      {
        membershipId: "m1",
        organizationId: "o1",
        organizationName: "Geeko Store",
        role: "owner" as const,
        displayName: "Dueña Geeko",
        archivedAt: null,
      },
    ],
  },
  {
    id: "u2",
    email: "nadie@kamay.test",
    createdAt: "2026-09-01T00:00:00Z",
    lastSignInAt: null,
    platformAdmin: false,
    memberships: [],
  },
  {
    id: "u3",
    email: "superadmin@kamay.test",
    createdAt: "2026-09-01T00:00:00Z",
    lastSignInAt: null,
    platformAdmin: true,
    memberships: [],
  },
];

function renderList(props: Partial<React.ComponentProps<typeof UserList>> = {}) {
  return render(
    <UserList
      users={users}
      hasMore={false}
      limit={50}
      query=""
      withoutOrganization={false}
      organizations={[{ id: "o1", name: "Geeko Store" }]}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe("UserList", () => {
  it("lista cada cuenta con su organización y su rol", () => {
    // Escenario «Every account is listed» a nivel de componente.
    renderList();
    const table = screen.getByRole("table", { name: "Cuentas de la plataforma" });
    const rows = within(table).getAllByTestId("user-row");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Geeko Store · Dueña o dueño");
    expect(rows[1]).toHaveTextContent("Sin organización");
    expect(rows[1]).toHaveTextContent("Nunca entró");
    expect(rows[2]).toHaveTextContent("Administrador de la plataforma");
  });

  it("el filtro «Sin organización» viaja en la dirección", () => {
    // Escenario «Accounts without organization are found»: el filtro lo
    // resuelve `platform_list_users()` (pgTAP) y la vista lo envía.
    renderList({ withoutOrganization: true });
    const checkbox = screen.getByLabelText("Sin organización");
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute("name", "sin");
    expect(checkbox.closest("form")).toHaveAttribute("action", "/admin/users");
  });

  it("sin resultados con filtros ofrece quitarlos", () => {
    renderList({ users: [], query: "zzz" });
    expect(screen.getByRole("link", { name: "Quitar filtros" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  it("ofrece agregar un usuario", () => {
    renderList();
    expect(screen.getByRole("button", { name: "Agregar usuario" })).toBeInTheDocument();
  });

  it("no carga la tabla entera: si hay más, ofrece traerlas", () => {
    renderList({ hasMore: true });
    expect(screen.getByTestId("load-more")).toHaveTextContent("las primeras 50 cuentas");
  });
});
