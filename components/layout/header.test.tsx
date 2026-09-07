import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";

import { Header } from "./header";

function renderHeader(role: "owner" | "assistant" = "owner") {
  useUserStore.setState({
    membership: { id: "m1", organizationId: "o1", role, displayName: null },
  });
  useOrganizationStore.setState({
    organization: {
      id: "o1",
      name: "Geeko Store",
      logoPath: null,
      currency: "BOB",
      timezone: "America/La_Paz",
    },
  });
  // `SidebarTrigger` vive en la barra y necesita el contexto que el layout
  // le da; aquí se monta el mismo proveedor y no un doble.
  return render(
    <SidebarProvider>
      <Header />
    </SidebarProvider>,
  );
}

afterEach(cleanup);

describe("Header", () => {
  // Scenario: Desktop shell shows the top bar
  it("rinde la barra superior con la organización y la campana", () => {
    renderHeader();

    expect(screen.getByTestId("top-bar")).toBeInTheDocument();
    expect(screen.getByText("Geeko Store")).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  // Scenario: Both roles get the bell
  it("la campana está para los dos roles", () => {
    renderHeader("assistant");
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();

    cleanup();

    renderHeader("owner");
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  // Scenario: Nothing unread shows no badge
  it("sin nada sin leer no pinta insignia", () => {
    renderHeader();

    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toHaveAccessibleName(
      "Notificaciones",
    );
  });

  // Scenario: The tray does not exist yet
  it("al activarla explica que la bandeja aún no existe, y no navega", async () => {
    renderHeader();

    const bell = screen.getByTestId("notification-bell");
    // Anuncia que despliega, no que navega: no hay ruta a la que ir.
    expect(bell.tagName).toBe("BUTTON");
    expect(bell).toHaveAttribute("aria-haspopup", "dialog");

    await userEvent.click(bell);

    expect(
      screen.getByText(/bandeja de notificaciones todavía no está disponible/),
    ).toBeInTheDocument();
  });

  it("la barra superior es solo de escritorio", () => {
    renderHeader();

    // En móvil manda la barra inferior; esta no existe allí.
    expect(screen.getByTestId("top-bar").className).toContain("hidden");
    expect(screen.getByTestId("top-bar").className).toContain("md:flex");
  });
});
