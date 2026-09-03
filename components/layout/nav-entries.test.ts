import { describe, expect, it } from "vitest";

import { isNavEntryActive, navEntriesFor } from "./nav-entries";

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

  it("egresos es del grupo Dinero: el dueño lo ve y el ayudante no", () => {
    // Lo que un rol no puede ver no aparece en el menú (mapa §10): los
    // costos viven en `expenses`, sin acceso para el ayudante.
    expect(navEntriesFor("owner").map((entry) => entry.href)).toContain("/expenses");
    expect(navEntriesFor("assistant").map((entry) => entry.href)).not.toContain(
      "/expenses",
    );
  });

  it("pedidos, catálogo y contactos son de la navegación base: los ven ambos roles", () => {
    for (const role of ["owner", "assistant"] as const) {
      const hrefs = navEntriesFor(role).map((entry) => entry.href);
      expect(hrefs).toContain("/orders");
      expect(hrefs).toContain("/catalog");
      expect(hrefs).toContain("/contacts");
    }
  });

  it("toda entrada trae icono: el menú lateral lo necesita", () => {
    for (const entry of navEntriesFor("owner")) {
      // Los iconos de lucide son componentes envueltos en `forwardRef`, así
      // que son objetos, no funciones: basta con que sean rendibles.
      expect(entry.icon).toBeDefined();
    }
  });

  it("sin membresía no se ofrece nada", () => {
    expect(navEntriesFor(null)).toEqual([]);
    expect(navEntriesFor(undefined)).toEqual([]);
  });
});

describe("isNavEntryActive", () => {
  it("marca la ruta exacta", () => {
    expect(isNavEntryActive("/orders", "/orders")).toBe(true);
  });

  it("marca también las rutas hijas", () => {
    expect(isNavEntryActive("/orders", "/orders/a0000000-0000")).toBe(true);
    expect(isNavEntryActive("/settings", "/settings/general")).toBe(true);
  });

  it("no marca una ruta que solo comparte prefijo de texto", () => {
    // `startsWith("/quick")` a secas marcaría esta; por eso se compara por
    // segmento y no por cadena.
    expect(isNavEntryActive("/quick", "/quick-sale")).toBe(false);
    expect(isNavEntryActive("/orders", "/orders-archive")).toBe(false);
  });

  it("no marca una sección distinta", () => {
    expect(isNavEntryActive("/orders", "/catalog")).toBe(false);
  });
});
