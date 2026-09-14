import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { OrganizationSwitcher, PLATFORM_VIEW_LABEL } from "./organization-switcher";

const enterOrganization = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/actions/auth", () => ({ enterOrganization }));

const ORGANIZATIONS = [
  { id: "o1", name: "Geeko Store" },
  { id: "o2", name: "Taller Kamay" },
  { id: "o3", name: "Kamay Feria" },
];

function renderSwitcher(activeOrganizationId: string | null = "o1") {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <OrganizationSwitcher
          organizations={ORGANIZATIONS}
          activeOrganizationId={activeOrganizationId}
        />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => enterOrganization.mockClear());
afterEach(cleanup);

/**
 * KAM-26 · El selector de organización del super admin. Escenarios de
 * `platform-administration` → *The sidebar offers an organization selector
 * only to platform admins* a nivel de componente.
 */
describe("OrganizationSwitcher", () => {
  it("nombra la organización activa", () => {
    renderSwitcher("o2");
    expect(screen.getByTestId("organization-switcher")).toHaveTextContent("Taller Kamay");
  });

  it("sin organización activa dice «Vista de plataforma»", () => {
    renderSwitcher(null);
    expect(screen.getByTestId("organization-switcher")).toHaveTextContent(PLATFORM_VIEW_LABEL);
  });

  it("filtra por nombre, sin importar tildes ni mayúsculas", async () => {
    renderSwitcher();
    await userEvent.click(screen.getByTestId("organization-switcher"));
    await userEvent.type(screen.getByLabelText("Buscar organización"), "kamay");

    const options = screen.getAllByTestId("organization-switcher-option");
    expect(options.map((o) => o.textContent)).toEqual(["Taller Kamay", "Kamay Feria"]);
  });

  it("Escape en el filtro cierra el menú", async () => {
    renderSwitcher();
    await userEvent.click(screen.getByTestId("organization-switcher"));
    await userEvent.type(screen.getByLabelText("Buscar organización"), "gee");
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByLabelText("Buscar organización")).not.toBeInTheDocument();
  });

  it("marca la activa", async () => {
    renderSwitcher("o1");
    await userEvent.click(screen.getByTestId("organization-switcher"));

    const [geeko] = screen.getAllByTestId("organization-switcher-option");
    expect(geeko).toContainElement(screen.getAllByLabelText("Activa")[0]);
  });

  it("elegir otra organización entra a ella", async () => {
    // Escenario «Switching organization from the sidebar».
    renderSwitcher("o1");
    await userEvent.click(screen.getByTestId("organization-switcher"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Kamay Feria" }));

    expect(enterOrganization).toHaveBeenCalledWith("o3");
  });

  it("«Vista de plataforma» sale de la organización", async () => {
    // Escenario «Leaving to the platform view».
    renderSwitcher("o1");
    await userEvent.click(screen.getByTestId("organization-switcher"));
    await userEvent.click(screen.getByRole("menuitem", { name: PLATFORM_VIEW_LABEL }));

    expect(enterOrganization).toHaveBeenCalledWith(null);
  });

  it("elegir la que ya está activa no hace nada", async () => {
    renderSwitcher("o1");
    await userEvent.click(screen.getByTestId("organization-switcher"));
    await userEvent.click(screen.getByRole("menuitem", { name: /Geeko Store/ }));

    expect(enterOrganization).not.toHaveBeenCalled();
  });

  it("si hay más organizaciones que las del tope, manda a Organizaciones", async () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <OrganizationSwitcher
            organizations={ORGANIZATIONS}
            hasMore
            activeOrganizationId="o9"
            activeOrganizationName="Taller Lejano"
          />
        </SidebarProvider>
      </TooltipProvider>,
    );
    // La activa puede quedar fuera del tope: su nombre llega aparte.
    expect(screen.getByTestId("organization-switcher")).toHaveTextContent("Taller Lejano");
    await userEvent.click(screen.getByTestId("organization-switcher"));
    expect(screen.getByRole("menuitem", { name: "Ver todas en Organizaciones" })).toHaveAttribute(
      "href",
      "/admin/organizations",
    );
  });

  it("con el menú plegado sigue siendo un botón con nombre y tooltip", () => {
    // Escenario «The selector survives the collapsed sidebar».
    render(
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <OrganizationSwitcher organizations={ORGANIZATIONS} activeOrganizationId="o1" />
        </SidebarProvider>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", {
      name: "Organización activa: Geeko Store. Cambiar de organización",
    });
    expect(trigger).toBeVisible();
  });
});
