import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUserStore } from "@/stores/user-store";
import type { Role } from "@/types";

import { AppSidebar } from "./app-sidebar";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

// El selector de línea trae su propia acción de servidor y su store; aquí solo
// interesa que el menú lo coloque, no su comportamiento (ya probado aparte).
vi.mock("@/features/business-lines/line-selector", () => ({
  LineSelector: ({ testId = "line-selector" }: { testId?: string }) => (
    <button type="button" data-testid={testId}>
      Todas
    </button>
  ),
}));

function renderSidebar(role: Role | null, route = "/dashboard") {
  pathname.value = route;
  useUserStore.setState({
    membership: role
      ? {
          id: "m1",
          organizationId: "o1",
          role,
          displayName: null,
        }
      : null,
  });

  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

function mainNav() {
  return screen.getByRole("navigation", { name: "Navegación principal" });
}

beforeEach(() => {
  useUserStore.setState({ membership: null });
});
afterEach(cleanup);

describe("AppSidebar", () => {
  it("expone la navegación principal como landmark con nombre", () => {
    // El nombre accesible es contrato: es como se distingue de la barra móvil.
    renderSidebar("owner");
    expect(mainNav()).toBeInTheDocument();
  });

  it("la persona dueña ve todas las secciones, incluida Configuración", () => {
    renderSidebar("owner");
    const nav = mainNav();

    for (const label of [
      "Panel",
      "Registrar",
      "Pedidos",
      "Catálogo",
      "Contactos",
      "Configuración",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("el ayudante no ve Configuración: la opción no existe, no está apagada", () => {
    renderSidebar("assistant");
    const nav = mainNav();

    expect(within(nav).getByRole("link", { name: "Pedidos" })).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Configuración" }),
    ).not.toBeInTheDocument();
  });

  it("sin membresía no ofrece ninguna entrada", () => {
    renderSidebar(null);
    expect(within(mainNav()).queryAllByRole("link")).toHaveLength(0);
  });

  it("marca la sección actual", () => {
    renderSidebar("owner", "/orders");
    const nav = mainNav();

    expect(within(nav).getByRole("link", { name: "Pedidos" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(within(nav).getByRole("link", { name: "Panel" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("una ruta hija marca su sección padre", () => {
    renderSidebar("owner", "/orders/a0000000-0000-0000-0000-000000000001");

    expect(
      within(mainNav()).getByRole("link", { name: "Pedidos" }),
    ).toHaveAttribute("data-active", "true");
  });

  it("lleva el selector de línea en la cabecera", () => {
    renderSidebar("owner");
    expect(screen.getByTestId("line-selector")).toBeInTheDocument();
  });

  it("no duplica las secciones de configuración", () => {
    // Desplegarlas aquí daría dos enlaces con el mismo nombre en la página.
    renderSidebar("owner", "/settings/general");
    const nav = mainNav();

    expect(within(nav).queryByRole("link", { name: "Canales" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Unidades" })).toBeNull();
  });
});
