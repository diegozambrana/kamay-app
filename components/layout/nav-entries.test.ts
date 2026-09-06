import { describe, expect, it } from "vitest";

import {
  barLabelOf,
  bottomBarEntriesFor,
  isNavEntryActive,
  moreEntriesFor,
  navEntriesFor,
} from "./nav-entries";

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

  it("tareas es de la navegación base: la ven ambos roles", () => {
    for (const role of ["owner", "assistant"] as const) {
      expect(navEntriesFor(role).map((entry) => entry.href)).toContain("/my-tasks");
    }
  });
});

describe("reparto entre la barra inferior y el panel Más", () => {
  const ROLES = ["owner", "assistant"] as const;

  it("la barra lleva exactamente tres entradas para cualquier rol", () => {
    // La cuarta ranura es "Más", que no es navegación sino su disparador.
    // Afirmar el número exacto es lo que impide que una tarea futura cuele
    // una quinta sección en la barra sin romper nada (design D2).
    for (const role of ROLES) {
      expect(bottomBarEntriesFor(role).map(barLabelOf)).toEqual([
        "Inicio",
        "Pedidos",
        "Tareas",
      ]);
    }
  });

  it("la partición es completa y sin solapes", () => {
    // El riesgo real de tener una sola fuente para tres superficies es que
    // una entrada se quede sin sitio —inalcanzable en el celular— o aparezca
    // en los dos. Se afirma la partición entera, no cada mitad por separado.
    for (const role of ROLES) {
      const todas = navEntriesFor(role).map((entry) => entry.href);
      const barra = bottomBarEntriesFor(role).map((entry) => entry.href);
      const mas = moreEntriesFor(role).map((entry) => entry.href);

      expect([...barra, ...mas].sort()).toEqual([...todas].sort());
      expect(barra.filter((href) => mas.includes(href))).toEqual([]);
    }
  });

  it("el registro rápido se llama distinto en cada superficie", () => {
    // "Registrar" en el menú lateral, donde Panel es la puerta de entrada
    // (§4.1); "Inicio" en el celular, donde la puerta es la captura (§4.2).
    const [inicio] = bottomBarEntriesFor("owner");

    expect(inicio.href).toBe("/quick");
    expect(inicio.label).toBe("Registrar");
    expect(barLabelOf(inicio)).toBe("Inicio");
  });

  it("una entrada sin rótulo propio de barra usa el suyo de siempre", () => {
    const pedidos = bottomBarEntriesFor("owner")[1];

    expect(barLabelOf(pedidos)).toBe(pedidos.label);
  });

  it("el dueño encuentra dinero y sistema dentro de Más", () => {
    const labels = moreEntriesFor("owner").map((entry) => entry.label);

    expect(labels).toEqual(
      expect.arrayContaining(["Egresos", "Catálogo", "Contactos", "Configuración"]),
    );
  });

  it("el ayudante solo encuentra en Más lo que su rol puede usar", () => {
    const labels = moreEntriesFor("assistant").map((entry) => entry.label);

    expect(labels).toEqual(expect.arrayContaining(["Catálogo", "Contactos"]));
    expect(labels).not.toContain("Egresos");
    expect(labels).not.toContain("Configuración");
  });

  it("una sección con ranura propia no se repite dentro de Más", () => {
    for (const role of ROLES) {
      const labels = moreEntriesFor(role).map((entry) => entry.label);

      expect(labels).not.toContain("Inicio");
      expect(labels).not.toContain("Pedidos");
      expect(labels).not.toContain("Tareas");
    }
  });

  it("una restricción de rol se respeta en las tres superficies a la vez", () => {
    // No hay una segunda lista que actualizar: `mobile` reparte la misma
    // declaración que ya filtró el rol.
    const enAlgunSitio = [
      ...navEntriesFor("assistant"),
      ...bottomBarEntriesFor("assistant"),
      ...moreEntriesFor("assistant"),
    ].map((entry) => entry.href);

    expect(enAlgunSitio).not.toContain("/settings");
    expect(enAlgunSitio).not.toContain("/expenses");
  });

  it("sin membresía ninguna de las dos superficies ofrece nada", () => {
    expect(bottomBarEntriesFor(null)).toEqual([]);
    expect(moreEntriesFor(undefined)).toEqual([]);
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
