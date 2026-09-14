import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/stores/user-store";

vi.mock("@/actions/auth", () => ({
  signOut: vi.fn(),
}));

const { UserMenu } = await import("./user-menu");

function renderMenu({
  displayName,
  email,
}: {
  displayName: string | null;
  email: string | null;
}) {
  useUserStore.setState({
    user: email ? { id: "u1", email } : null,
    membership: {
      id: "m1",
      organizationId: "o1",
      role: "owner",
      displayName,
    },
  });
  return render(<UserMenu />);
}

afterEach(cleanup);

describe("UserMenu", () => {
  it("muestra las iniciales del nombre visible en el avatar", () => {
    renderMenu({ displayName: "Marcela Cruz", email: "marcela@geeko.test" });

    expect(screen.getByTestId("account-menu-trigger")).toHaveTextContent("MC");
  });

  // Sin nombre visible, cae al correo: nunca queda vacío.
  it("sin nombre visible usa las iniciales del correo", () => {
    renderMenu({ displayName: null, email: "z@geeko.test" });

    expect(screen.getByTestId("account-menu-trigger")).toHaveTextContent("Z");
  });

  it("al abrirse ofrece Perfil y Cerrar sesión", async () => {
    renderMenu({ displayName: "Marcela Cruz", email: "marcela@geeko.test" });

    await userEvent.click(screen.getByTestId("account-menu-trigger"));

    expect(screen.getByTestId("account-menu-profile")).toHaveTextContent("Perfil");
    expect(screen.getByTestId("account-menu-sign-out")).toHaveTextContent(
      "Cerrar sesión",
    );
  });

  it("Perfil enlaza a /profile", async () => {
    renderMenu({ displayName: "Marcela Cruz", email: "marcela@geeko.test" });

    await userEvent.click(screen.getByTestId("account-menu-trigger"));

    expect(screen.getByTestId("account-menu-profile")).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});
