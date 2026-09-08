import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";

import { Header } from "./header";

vi.mock("@/actions/notifications", () => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const AVISO = {
  id: "n1",
  organizationId: "o1",
  userId: "u1",
  type: "task_assigned" as const,
  title: "Te asignaron «Set de 6 tazas»",
  body: null,
  entityType: "task",
  entityId: "t1",
  readAt: null,
  createdAt: "2026-09-08T10:00:00.000Z",
};

function renderHeader(
  role: "owner" | "assistant" = "owner",
  props: Partial<React.ComponentProps<typeof Header>> = {},
) {
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
      <Header timezone="America/La_Paz" {...props} />
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

  // Scenario: Contador real (delta spec `notifications`)
  it("con avisos sin leer muestra su número", () => {
    renderHeader("owner", { unreadCount: 3 });

    expect(screen.getByTestId("notification-badge")).toHaveTextContent("3");
    expect(screen.getByTestId("notification-bell")).toHaveAccessibleName(
      "Notificaciones, 3 sin leer",
    );
  });

  // Scenario: Bandeja vacía (delta spec `notifications`)
  it("al abrirla sin avisos muestra su mensaje de lista sin contenido", async () => {
    renderHeader();

    const bell = screen.getByTestId("notification-bell");
    // Anuncia que despliega, no que navega: la bandeja es un panel lateral.
    expect(bell.tagName).toBe("BUTTON");
    expect(bell).toHaveAttribute("aria-haspopup", "dialog");

    await userEvent.click(bell);

    expect(screen.getByTestId("notifications-empty")).toHaveTextContent(
      "No tienes avisos.",
    );
  });

  it("al abrirla con avisos los muestra y ya no dice que no está disponible", async () => {
    renderHeader("owner", {
      unreadCount: 1,
      notificationGroups: [{ type: "task_assigned", notifications: [AVISO] }],
    });

    await userEvent.click(screen.getByTestId("notification-bell"));

    expect(screen.getByTestId("notification-n1")).toBeInTheDocument();
    expect(
      screen.queryByText(/todavía no está disponible/),
    ).not.toBeInTheDocument();
  });

  // Scenario: V21 → Preferencias (mapa §11), para los dos roles
  it("ofrece las preferencias, también al ayudante", async () => {
    renderHeader("assistant");

    await userEvent.click(screen.getByTestId("notification-bell"));

    expect(
      screen.getByRole("link", { name: /Preferencias de notificación/ }),
    ).toHaveAttribute("href", "/settings/notifications");
  });

  it("la barra superior es solo de escritorio", () => {
    renderHeader();

    // En móvil manda la barra inferior; esta no existe allí.
    expect(screen.getByTestId("top-bar").className).toContain("hidden");
    expect(screen.getByTestId("top-bar").className).toContain("md:flex");
  });
});
