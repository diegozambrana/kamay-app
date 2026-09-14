import { cleanup, render, screen } from "@testing-library/react";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Todo segmento con datos tiene su estado de carga y su estado de error
 * (KAM-23, design D3; spec `view-states`).
 *
 * Es la diferencia entre «aplicamos los estados» y «los estados están
 * aplicados»: la ruta que se cree mañana sin `loading.tsx` o sin `error.tsx`
 * rompe esta prueba en el mismo commit que la introduce, en lugar de
 * descubrirse cuando alguien ve una pantalla en blanco.
 *
 * Las exclusiones se escriben con su motivo. Salir de la regla cuesta una
 * línea justificada; entrar en ella no cuesta nada.
 */

const APP_DIR = path.resolve(__dirname);

const EXCLUDED: Record<string, string> = {
  ".": "Solo redirige según la sesión (KAM-25): no consulta datos ni renderiza contenido.",
  offline:
    "Página estática que sirve el service worker sin red: no consulta datos.",
  "(app)/settings":
    "Índice que solo redirige a /settings/general; cada sección tiene los suyos.",
  "auth/login": "Formulario sin datos, fuera del cascarón; su fallo lo recoge app/error.tsx.",
  "auth/forgot-password":
    "Formulario sin datos, fuera del cascarón; su fallo lo recoge app/error.tsx.",
  "auth/reset-password":
    "Formulario sin datos, fuera del cascarón; su fallo lo recoge app/error.tsx.",
  "auth/invite/[token]":
    "Flujo de alta fuera del cascarón; su fallo lo recoge app/error.tsx.",
  "auth/select-org":
    "Paso de entrada fuera del cascarón; su fallo lo recoge app/error.tsx.",
};

/** Los segmentos de `app/` que tienen página, relativos a `app/`. */
function pageSegments(dir = APP_DIR): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...pageSegments(full));
    else if (entry === "page.tsx") found.push(path.relative(APP_DIR, dir) || ".");
  }
  return found.sort();
}

function has(segment: string, file: string): boolean {
  try {
    return statSync(path.join(APP_DIR, segment, file)).isFile();
  } catch {
    return false;
  }
}

const segments = pageSegments();

// Vite no resuelve importaciones dinámicas de más de un nivel con variables;
// `import.meta.glob` sí, y además solo carga los que existen.
const loadingModules = import.meta.glob("./**/loading.tsx") as Record<
  string,
  () => Promise<{ default: () => React.ReactElement }>
>;
const covered = segments.filter((segment) => !(segment in EXCLUDED));

afterEach(cleanup);

describe("cobertura de estados por ruta", () => {
  it("encuentra las páginas de la aplicación", () => {
    expect(segments.length).toBeGreaterThan(30);
  });

  it("toda exclusión corresponde a una página que existe", () => {
    expect(Object.keys(EXCLUDED).filter((segment) => !segments.includes(segment))).toEqual(
      [],
    );
  });

  it("todo segmento con datos tiene loading.tsx", () => {
    expect(covered.filter((segment) => !has(segment, "loading.tsx"))).toEqual([]);
  });

  it("todo segmento con datos tiene error.tsx", () => {
    expect(covered.filter((segment) => !has(segment, "error.tsx"))).toEqual([]);
  });
});

// «Loading shows the shape of the content», «No spinner replaces the content»
describe("los estados de carga son esqueletos, no giradores", () => {
  it.each(covered)("%s", async (segment) => {
    const load = loadingModules[`./${segment}/loading.tsx`];
    expect(load, `${segment} no tiene loading.tsx`).toBeDefined();
    const { default: Loading } = await load();

    const { container } = render(<Loading />);

    const region = screen.getByTestId("loading-skeleton");
    expect(region).toHaveAttribute("role", "status");
    expect(region.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(2);
    expect(container.querySelector(".animate-spin, [role='progressbar']")).toBeNull();
  });
});
