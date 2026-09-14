import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUserStore } from "@/stores/user-store";

import { UserProvider } from "./user-provider";

const USER = { id: "u1", email: "a@kamay.test" };

/**
 * KAM-26 · Hidratar los stores sin actualizar otro árbol en medio del render
 * (`useHydrateStore`).
 */
describe("useHydrateStore", () => {
  it("con un cascarón ya montado, el layout nuevo no escribe durante el render", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    // Un componente del árbol viejo, suscrito al rol.
    function OldSidebar() {
      return <span>{useUserStore((state) => state.role) ?? "sin rol"}</span>;
    }

    const { rerender, getByText } = render(
      <UserProvider user={USER} membership={null} role={null} platformAdmin>
        <OldSidebar />
      </UserProvider>,
    );

    // La navegación de `(platform)` a `(app)`: el árbol viejo sigue montado
    // mientras se monta un proveedor nuevo con otro rol.
    rerender(
      <>
        <UserProvider user={USER} membership={null} role={null} platformAdmin>
          <OldSidebar />
        </UserProvider>
        <UserProvider key="nuevo" user={USER} membership={null} role="owner" platformAdmin>
          <span>nuevo</span>
        </UserProvider>
      </>,
    );

    expect(getByText("nuevo")).toBeInTheDocument();
    // Antes de pintar, el store ya tiene el rol del layout nuevo.
    expect(useUserStore.getState().role).toBe("owner");
    expect(
      errors.mock.calls.some((call) => String(call[0]).includes("Cannot update a component")),
    ).toBe(false);
    errors.mockRestore();
  });
});
