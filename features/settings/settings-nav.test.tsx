import { readdirSync, readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_SECTIONS, SettingsNav } from "./settings-nav";

const ruta = vi.hoisted(() => ({ actual: "/settings/notifications" }));

vi.mock("next/navigation", () => ({
  usePathname: () => ruta.actual,
}));

afterEach(() => {
  cleanup();
  ruta.actual = "/settings/notifications";
});

/**
 * KAM-17 · La excepción de rol de V15.
 *
 * Escenarios del delta spec `notifications` — requisito "Preferencias de
 * notificación por persona, con cada tipo apagable": «El ayudante configura
 * las suyas» y «Las demás secciones de configuración siguen siendo del dueño».
 *
 * La comprobación de que la guardia real sigue en su sitio (tarea 9.7) es la
 * última prueba de este archivo, y es la que importa: bajar la guardia del
 * layout a las secciones solo es seguro mientras **todas** las que son del
 * taller la conserven.
 */
describe("SettingsNav", () => {
  // Atado a la lista de secciones y no a un número escrito a mano: ese número
  // se rompió al añadir Estados, al añadir Notificaciones y otra vez al añadir
  // Retención (KAM-22), y cada vez señalaba la prueba en lugar del cambio.
  it("la persona dueña ve todas las secciones", () => {
    render(<SettingsNav isOwner />);

    expect(screen.getAllByRole("link")).toHaveLength(
      SETTINGS_SECTIONS.length,
    );
    for (const section of SETTINGS_SECTIONS) {
      expect(
        screen.getByRole("link", { name: section.label }),
      ).toBeInTheDocument();
    }
  });

  // KAM-22: la retención es del taller, no de la persona.
  it("Retención es del dueño y lleva a su sección", () => {
    render(<SettingsNav isOwner />);

    expect(screen.getByRole("link", { name: "Retención" })).toHaveAttribute(
      "href",
      "/settings/retention",
    );
  });

  // Scenario: El ayudante configura las suyas
  it("el ayudante ve solo lo suyo: Notificaciones y Exportar", () => {
    render(<SettingsNav isOwner={false} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/settings/notifications",
      // KAM-23: cada quien exporta lo que su rol puede leer.
      "/settings/export",
    ]);
  });

  // Scenario: Las demás secciones de configuración siguen siendo del dueño
  it("ninguna sección del taller aparece para el ayudante", () => {
    render(<SettingsNav isOwner={false} />);

    for (const label of [
      "General",
      "Líneas de negocio",
      "Canales",
      "Categorías de gasto",
      "Categorías de ítem",
      "Unidades",
      "Estados",
      // KAM-27 · «The assistant is not offered Tools».
      "Herramientas",
      "Usuarios y roles",
    ]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  /** El menú como se lee: cada grupo con su título, seguido de sus secciones. */
  const menuItems = () =>
    Array.from(
      screen
        .getByRole("navigation", { name: "Secciones de configuración" })
        .querySelectorAll("li"),
      (item) => item.textContent,
    );

  // Spec `settings-interaction` → «Owner sees the menu beside the content on a
  // wide screen», nivel unitario: los grupos, su orden y la sección actual.
  it("la persona dueña ve cuatro grupos con sus secciones, y la actual marcada", () => {
    render(<SettingsNav isOwner />);

    expect(menuItems()).toEqual([
      "Organización",
      "General",
      "Líneas de negocio",
      "Canales",
      "Categorías de gasto",
      "Categorías de ítem",
      "Unidades",
      "Estados",
      // KAM-27 · spec `settings-interaction` → «Tools closes the Organización group».
      "Herramientas",
      "Equipo",
      "Usuarios y roles",
      "Preferencias",
      "Notificaciones",
      "Datos",
      "Retención",
      "Exportar",
    ]);
    expect(screen.getByRole("link", { name: "Notificaciones" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "General" })).not.toHaveAttribute("aria-current");
  });

  // Spec `org-configuration` → «The two kinds of categories are named apart».
  it("las dos listas de categorías tienen nombres distintos y ninguna es solo «Categorías»", () => {
    render(<SettingsNav isOwner />);

    expect(screen.getByRole("link", { name: "Categorías de gasto" })).toHaveAttribute(
      "href",
      "/settings/categories",
    );
    expect(screen.getByRole("link", { name: "Categorías de ítem" })).toHaveAttribute(
      "href",
      "/settings/item-categories",
    );
    expect(screen.queryByRole("link", { name: "Categorías" })).toBeNull();
  });

  // Spec `settings-interaction` → «Item categories is marked when open».
  it("en /settings/item-categories, su entrada es la página actual", () => {
    ruta.actual = "/settings/item-categories";
    render(<SettingsNav isOwner />);

    expect(screen.getByRole("link", { name: "Categorías de ítem" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Categorías de gasto" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // catalog-custom-attributes: los atributos de una categoría son una subpágina
  // de «Categorías de ítem», y la sección sigue marcada.
  it("en los atributos de una categoría, «Categorías de ítem» sigue siendo la página actual", () => {
    ruta.actual = "/settings/item-categories/92000000-0000-0000-0000-000000000004";
    render(<SettingsNav isOwner />);

    expect(screen.getByRole("link", { name: "Categorías de ítem" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Categorías de gasto" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // KAM-27 · spec `settings-interaction` → «Tools closes the Organización group».
  it("en /settings/tools, Herramientas cierra Organización y es la página actual", () => {
    ruta.actual = "/settings/tools";
    render(<SettingsNav isOwner />);

    const tools = screen.getByRole("link", { name: "Herramientas" });
    expect(tools).toHaveAttribute("href", "/settings/tools");
    expect(tools).toHaveAttribute("aria-current", "page");

    const items = menuItems();
    expect(items[items.indexOf("Equipo") - 1]).toBe("Herramientas");
  });

  // Spec `settings-interaction` → «The assistant sees only their groups».
  it("el ayudante solo ve Preferencias y Datos, sin títulos de grupos vacíos", () => {
    render(<SettingsNav isOwner={false} />);

    expect(menuItems()).toEqual(["Preferencias", "Notificaciones", "Datos", "Exportar"]);
  });

  it("solo Notificaciones y Exportar están declaradas como abiertas a ambos roles", () => {
    const abiertas = SETTINGS_SECTIONS.filter((s) => !s.ownerOnly);

    expect(abiertas.map((s) => s.href)).toEqual(["/settings/notifications", "/settings/export"]);
  });
});

/**
 * Tarea 9.7 · Ninguna sección quedó sin guardia al bajarla del layout.
 *
 * Se comprueba una por una y sobre el disco, no de un vistazo: es exactamente
 * el error que una revisión humana deja pasar, y su consecuencia sería que un
 * ayudante alcanzara la configuración del taller.
 */
describe("guardia de rol de cada sección de configuración", () => {
  const SETTINGS_DIR = "app/(app)/settings";

  function sectionDirs(): string[] {
    return readdirSync(SETTINGS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  /**
   * Se busca la **llamada**, no la mención: el propio layout explica en su
   * comentario que las secciones siguen llamando a `getOwnerContext()`, y
   * buscar el nombre a secas convertiría esa explicación en un fallo.
   */
  const CALLS_OWNER_GUARD = /await\s+getOwnerContext\s*\(/;

  it("cada sección del taller exige ser dueño por su cuenta", () => {
    const sinGuardia = sectionDirs()
      // Las dos secciones de la persona: sus avisos (KAM-17) y su exportación
      // (KAM-23), que RLS recorta a lo que su rol lee.
      .filter((dir) => dir !== "notifications" && dir !== "export")
      .filter((dir) => {
        const source = readFileSync(`${SETTINGS_DIR}/${dir}/page.tsx`, "utf8");
        return !CALLS_OWNER_GUARD.test(source);
      });

    expect(
      sinGuardia,
      `Estas secciones de configuración perdieron su guardia de rol:\n` +
        `${sinGuardia.join("\n")}\n\n` +
        `Desde KAM-17 el layout ya no la aplica (design D6): cada sección del ` +
        `taller tiene que llamar a getOwnerContext() ella misma.`,
    ).toEqual([]);
  });

  // catalog-custom-attributes · «The assistant cannot reach the attributes».
  it("la página de atributos de una categoría también exige ser dueño", () => {
    const page = readFileSync(
      `${SETTINGS_DIR}/item-categories/[categoryId]/page.tsx`,
      "utf8",
    );
    expect(page).toMatch(CALLS_OWNER_GUARD);
  });

  it("el layout ya no aplica la guardia, y por eso las de arriba importan", () => {
    const layout = readFileSync(`${SETTINGS_DIR}/layout.tsx`, "utf8");

    expect(layout).not.toMatch(CALLS_OWNER_GUARD);
    expect(layout).toMatch(/await\s+getSessionContext\s*\(/);
  });

  it("la sección de notificaciones deliberadamente no la exige", () => {
    const page = readFileSync(`${SETTINGS_DIR}/notifications/page.tsx`, "utf8");

    expect(page).not.toMatch(CALLS_OWNER_GUARD);
  });

  it("toda sección con página tiene su entrada en la navegación", () => {
    // Una sección alcanzable por dirección directa y ausente del menú sería
    // una pantalla sin puerta.
    const enDisco = sectionDirs().sort();
    const enMenu = SETTINGS_SECTIONS.map((s) =>
      s.href.replace("/settings/", ""),
    ).sort();

    expect(enDisco).toEqual(enMenu);
  });
});
