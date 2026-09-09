import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/stores/user-store";

const pathname = vi.hoisted(() => ({ value: "/catalog" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

import { RegisterButton } from "./register-button";

function renderButton(route: string, role: "owner" | "assistant" = "owner") {
  pathname.value = route;
  useUserStore.setState({
    membership: { id: "m1", organizationId: "o1", role, displayName: null },
  });
  return render(<RegisterButton />);
}

afterEach(cleanup);

describe("RegisterButton", () => {
  it("se rinde en las pantallas normales", () => {
    renderButton("/catalog");

    expect(screen.getByTestId("register-button")).toBeInTheDocument();
  });

  it("registrar un gasto desde el catálogo son dos toques", async () => {
    renderButton("/catalog");

    await userEvent.click(screen.getByTestId("register-button"));
    const gasto = screen.getByTestId("register-destination-cost");

    expect(gasto).toHaveAttribute("href", "/expenses/costs/new");
  });

  it("registrar un pedido desde los egresos son dos toques", async () => {
    renderButton("/expenses");

    await userEvent.click(screen.getByTestId("register-button"));

    expect(screen.getByTestId("register-destination-order")).toHaveAttribute(
      "href",
      "/orders/new",
    );
  });

  it("el menú respeta el rol", async () => {
    renderButton("/catalog", "assistant");
    await userEvent.click(screen.getByTestId("register-button"));

    expect(screen.queryByTestId("register-destination-purchase")).toBeNull();
    expect(screen.queryByTestId("register-destination-cost")).toBeNull();
    expect(screen.getByTestId("register-destination-order")).toBeInTheDocument();
  });

  it("ofrece exactamente los mismos destinos que la retícula", async () => {
    // Una sola declaración para las dos superficies: si divergieran, el menú
    // ofrecería algo que la pantalla de inicio no, o al revés (design D1).
    renderButton("/catalog");
    await userEvent.click(screen.getByTestId("register-button"));

    for (const key of ["direct-sale", "order", "purchase", "cost", "consumption", "task"]) {
      expect(screen.getByTestId(`register-destination-${key}`)).toBeInTheDocument();
    }
  });

  // El menú y la retícula salen de la misma declaración, así que Consumo
  // tampoco queda inerte aquí: abre el mismo diálogo y cierra el menú.
  it("Consumo abre su diálogo desde el menú, sin destinos inertes", async () => {
    renderButton("/catalog");
    await userEvent.click(screen.getByTestId("register-button"));

    const consumo = screen.getByTestId("register-destination-consumption");
    expect(consumo.tagName).toBe("BUTTON");
    expect(consumo).not.toBeDisabled();

    await userEvent.click(consumo);

    expect(screen.getByTestId("consumption-form")).toBeInTheDocument();
  });

  it("no se rinde en las pantallas de captura", () => {
    // Mismo criterio que la barra: taparía el guardar y ofrecería una salida
    // que se saltaría la confirmación de descarte.
    for (const route of [
      "/orders/new",
      "/expenses/costs/new",
      "/expenses/purchases/new",
    ]) {
      renderButton(route);
      expect(screen.queryByTestId("register-button")).toBeNull();
      cleanup();
    }
  });

  it("en escritorio no se retira: se recoloca", () => {
    // Desde KAM-14 el flotante existe también en escritorio (V2 lo pide entre
    // sus elementos permanentes). Ya no hay `md:hidden`; lo que cambia es
    // dónde se apoya, porque allí no hay barra inferior que despejar.
    renderButton("/catalog");

    const button = screen.getByTestId("register-button");
    expect(button.className).not.toContain("md:hidden");
    expect(button.className).toContain("md:bottom-6");
  });

  it("registrar una compra desde el panel son dos interacciones", async () => {
    renderButton("/dashboard");

    await userEvent.click(screen.getByTestId("register-button"));

    expect(screen.getByTestId("register-destination-purchase")).toHaveAttribute(
      "href",
      "/expenses/purchases/new",
    );
  });

  it("el menú tampoco se oculta en escritorio", async () => {
    // Si el panel se retirase con `md:hidden`, el botón de escritorio abriría
    // un menú invisible: dos interacciones que no llevan a ninguna parte.
    renderButton("/dashboard");

    await userEvent.click(screen.getByTestId("register-button"));

    expect(screen.getByTestId("register-menu").className).not.toContain(
      "md:hidden",
    );
  });

  it("el indicador de sincronización no queda tapado por el flotante", () => {
    // El indicador vive arriba, en la tira de contexto; el flotante se ancla
    // abajo a la derecha. No comparten ni borde ni capa.
    renderButton("/catalog");

    const className = screen.getByTestId("register-button").className;
    expect(className).toContain("fixed");
    expect(className).toContain("bottom-20");
    expect(className).not.toContain("top-");
  });
});
