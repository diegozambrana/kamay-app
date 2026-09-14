import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("@/actions/auth", () => ({ signOut }));

const { NoOrganizationNotice } = await import("./no-organization-notice");

afterEach(() => {
  cleanup();
  signOut.mockClear();
});

/**
 * KAM-25 · `user-auth` — requisito "An account without an organization can
 * sign out", escenario «The notice offers a way out». Que el botón termine la
 * sesión de verdad y lleve a `/auth/login` lo cubre `tests/e2e/account.spec.ts`.
 */
describe("NoOrganizationNotice", () => {
  it("explica que la cuenta no pertenece a ninguna organización", () => {
    render(<NoOrganizationNotice />);

    expect(
      screen.getByText(/no pertenece a ninguna organización/i),
    ).toBeInTheDocument();
  });

  it("ofrece un único botón para cerrar sesión, y ninguna navegación", () => {
    render(<NoOrganizationNotice />);

    const button = screen.getByRole("button", { name: "Cerrar sesión" });
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("al pulsarlo invoca la acción de cerrar sesión", async () => {
    render(<NoOrganizationNotice />);

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
