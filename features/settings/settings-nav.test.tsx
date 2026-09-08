import { readdirSync, readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_SECTIONS, SettingsNav } from "./settings-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/notifications",
}));

afterEach(cleanup);

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
  it("la persona dueña ve las ocho secciones", () => {
    render(<SettingsNav isOwner />);

    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "General" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notificaciones" }),
    ).toBeInTheDocument();
  });

  // Scenario: El ayudante configura las suyas
  it("el ayudante ve solo Notificaciones", () => {
    render(<SettingsNav isOwner={false} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/settings/notifications");
  });

  // Scenario: Las demás secciones de configuración siguen siendo del dueño
  it("ninguna sección del taller aparece para el ayudante", () => {
    render(<SettingsNav isOwner={false} />);

    for (const label of [
      "General",
      "Líneas de negocio",
      "Canales",
      "Categorías",
      "Unidades",
      "Estados",
      "Usuarios y roles",
    ]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("solo Notificaciones está declarada como abierta a ambos roles", () => {
    const abiertas = SETTINGS_SECTIONS.filter((s) => !s.ownerOnly);

    expect(abiertas.map((s) => s.href)).toEqual(["/settings/notifications"]);
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
      .filter((dir) => dir !== "notifications")
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
