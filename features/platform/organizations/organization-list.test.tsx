import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrganizationSummary } from "@/services/platform/organization-admin-service";

import { OrganizationList } from "./organization-list";

vi.mock("@/actions/auth", () => ({ enterOrganization: vi.fn() }));
vi.mock("@/actions/platform", () => ({ createOrganization: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/organizations",
  useSearchParams: () => new URLSearchParams(),
}));

const summary = (id: string, name: string, extra: Partial<OrganizationSummary> = {}) => ({
  id,
  name,
  currency: "BOB",
  timezone: "America/La_Paz",
  createdAt: "2026-09-01T12:00:00Z",
  archivedAt: null,
  owners: ["Dueña"],
  activeMembers: 2,
  ...extra,
});

const organizations = [
  summary("o1", "Geeko Store"),
  summary("o2", "Taller Kamay", { owners: [], activeMembers: 0 }),
  summary("o3", "Kamay Histórico", { archivedAt: "2026-09-05T00:00:00Z" }),
];

function renderList(props: Partial<React.ComponentProps<typeof OrganizationList>> = {}) {
  return render(
    <OrganizationList
      organizations={organizations}
      hasMore={false}
      limit={50}
      query=""
      activeOrganizationId={null}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe("OrganizationList", () => {
  it("lista cada organización con sus dueños y miembros", () => {
    renderList({ activeOrganizationId: "o1" });

    const table = screen.getByRole("table", { name: "Organizaciones de la plataforma" });
    const rows = within(table).getAllByTestId("organization-row");
    expect(rows).toHaveLength(3);
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Nombre",
      "Dueños",
      "Miembros",
      "Creada",
      "Entrar",
      "Acciones",
    ]);
    expect(rows[0]).toHaveTextContent("Dueña");
    expect(rows[0]).toHaveTextContent("2");
    expect(rows[0]).toHaveTextContent("Activa");
    expect(rows[1]).toHaveTextContent("Sin dueño activo");
  });

  it("la búsqueda es un formulario que viaja en la dirección", () => {
    // Escenario «Searching by name»: el filtrado lo hace el servidor.
    renderList({ query: "geeko" });

    const search = screen.getByLabelText("Buscar organización por nombre");
    expect(search).toHaveValue("geeko");
    expect(search).toHaveAttribute("name", "q");
    expect(search.closest("form")).toHaveAttribute("action", "/admin/organizations");
  });

  it("sin resultados tras buscar ofrece quitar la búsqueda", () => {
    renderList({ organizations: [], query: "zzz" });
    expect(screen.getByRole("link", { name: "Quitar filtros" })).toHaveAttribute(
      "href",
      "/admin/organizations",
    );
  });

  it("sin organizaciones muestra el vacío inicial", () => {
    renderList({ organizations: [] });
    expect(screen.getByTestId("empty-state")).toHaveTextContent("Aún no hay organizaciones");
  });

  it("no carga la tabla entera: si hay más, ofrece traerlas", () => {
    renderList({ hasMore: true });
    expect(screen.getByTestId("load-more")).toHaveTextContent("las primeras 50 organizaciones");
  });

  it("una organización archivada no ofrece entrar", () => {
    renderList();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("button", { name: "Entrar a Geeko Store" })).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Entrar a Kamay Histórico" })).toBeNull();
  });

  it("cada fila tiene su menú con «Ver detalle»", async () => {
    renderList();
    const table = screen.getByRole("table");
    await userEvent.click(within(table).getByRole("button", { name: "Acciones de Geeko Store" }));
    expect(screen.getByRole("menuitem", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      "/admin/organizations/o1",
    );
    expect(screen.getByRole("menuitem", { name: "Entrar" })).toBeInTheDocument();
  });
});
