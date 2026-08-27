import { describe, expect, it } from "vitest";

import { navEntriesFor } from "./nav-entries";

describe("navEntriesFor", () => {
  it("el dueño ve la configuración", () => {
    const hrefs = navEntriesFor("owner").map((entry) => entry.href);
    expect(hrefs).toContain("/settings");
  });

  it("el ayudante no tiene ninguna entrada a la configuración", () => {
    // Ocultar, no deshabilitar: la opción simplemente no existe para su rol.
    const hrefs = navEntriesFor("assistant").map((entry) => entry.href);
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).toContain("/dashboard");
  });

  it("catálogo y contactos son de la navegación base: los ven ambos roles", () => {
    for (const role of ["owner", "assistant"] as const) {
      const hrefs = navEntriesFor(role).map((entry) => entry.href);
      expect(hrefs).toContain("/catalog");
      expect(hrefs).toContain("/contacts");
    }
  });

  it("sin membresía no se ofrece nada", () => {
    expect(navEntriesFor(null)).toEqual([]);
    expect(navEntriesFor(undefined)).toEqual([]);
  });
});
