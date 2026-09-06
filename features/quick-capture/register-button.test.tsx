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

  it("los destinos pendientes también salen inertes en el menú", async () => {
    renderButton("/catalog");
    await userEvent.click(screen.getByTestId("register-button"));

    const consumo = screen.getByTestId("register-destination-consumption");
    expect(consumo.tagName).toBe("BUTTON");
    expect(consumo).toBeDisabled();
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

  it("en escritorio no se ve", () => {
    // El flotante de escritorio es de KAM-14; este es el móvil y se retira
    // con `md:hidden`, no con una consulta de medios en JavaScript.
    renderButton("/catalog");

    expect(screen.getByTestId("register-button").className).toContain("md:hidden");
  });
});
