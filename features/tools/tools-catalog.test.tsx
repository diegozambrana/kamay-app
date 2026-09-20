import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  llamadas: [] as string[],
  respuesta: undefined as undefined | { error: string },
}));

vi.mock("@/actions/tools", () => ({
  activateTool: async (slug: string) => {
    estado.llamadas.push(`activate:${slug}`);
    return estado.respuesta;
  },
  deactivateTool: async (slug: string) => {
    estado.llamadas.push(`deactivate:${slug}`);
    return estado.respuesta;
  },
  updateToolConfig: async () => undefined,
}));

const { catalogEntries, toolFacts } = await import("@/features/tools/catalog-view");
const { ToolsCatalog } = await import("@/features/tools/tools-catalog");
const { TOOLS } = await import("@/tools/registry");
const { printCost3d } = await import("@/tools/print-cost-3d/manifest");

const SLUG = "print-cost-3d";
const saved = { ...(printCost3d.defaults as Record<string, unknown>), filamentPricePerKg: 190 };

beforeEach(() => {
  estado.llamadas = [];
  estado.respuesta = undefined;
});
afterEach(cleanup);

/** KAM-27 · spec `tenant-tools` → *El catálogo vive en la configuración y es de la dueña*. */
describe("catalogEntries", () => {
  it("sin filas, toda herramienta del registro sale no activa y con sus valores por defecto", () => {
    const [entry] = catalogEntries(TOOLS, []);
    expect(entry).toMatchObject({
      slug: SLUG,
      active: false,
      hasSavedConfig: false,
      config: printCost3d.defaults,
      href: null,
    });
  });

  it("activa: con sus parámetros y el enlace a su página", () => {
    const [entry] = catalogEntries(TOOLS, [{ slug: SLUG, config: saved, archivedAt: null }]);
    expect(entry).toMatchObject({ active: true, config: saved, href: "/extensions/print-cost-3d" });
  });

  it("desactivada: no activa, pero recuerda que tiene parámetros guardados", () => {
    const [entry] = catalogEntries(TOOLS, [
      { slug: SLUG, config: saved, archivedAt: "2026-09-20T10:00:00Z" },
    ]);
    expect(entry).toMatchObject({ active: false, hasSavedConfig: true, config: saved, href: null });
  });

  it("una fila cuyo slug ya no está en el registro no aparece ni rompe nada", () => {
    const entries = catalogEntries(TOOLS, [{ slug: "retirada", config: {}, archivedAt: null }]);
    expect(entries.map((entry) => entry.slug)).toEqual([SLUG]);
  });

  it("dice en lenguaje llano qué produce, que no sale a internet, dónde aparece y quién la usa", () => {
    const facts = toolFacts(printCost3d).join("\n");
    expect(facts).toMatch(/Produce: Una línea libre en el pedido/);
    expect(facts).toMatch(/No sale a internet/);
    expect(facts).toMatch(/No guarda contraseñas/);
    expect(facts).toMatch(/propia página/);
    expect(facts).toMatch(/detalle de cada pedido/);
    expect(facts).toMatch(/Solo la persona dueña/);
  });

  it("una herramienta que sí saliera a internet lo diría", () => {
    const facts = toolFacts({
      ...printCost3d,
      minRole: "assistant",
      capabilities: { network: true, credentials: true, produces: "algo" },
    }).join("\n");
    expect(facts).toMatch(/Se conecta a internet/);
    expect(facts).toMatch(/Guarda credenciales/);
    expect(facts).toMatch(/sus ayudantes/);
  });
});

describe("ToolsCatalog", () => {
  it("organización sin herramientas: ve la calculadora, su descripción y sus capacidades, no activa", () => {
    render(<ToolsCatalog entries={catalogEntries(TOOLS, [])} />);

    const card = within(screen.getByTestId(`tool-${SLUG}`));
    expect(card.getByRole("heading", { name: "Calculadora de impresión 3D" })).toBeInTheDocument();
    expect(card.getByText("No activa")).toBeInTheDocument();
    expect(card.getByText(/No sale a internet/)).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Activar" })).toBeInTheDocument();
    // Sin activar no hay parámetros que editar ni página que abrir.
    expect(screen.queryByTestId(`tool-params-${SLUG}`)).not.toBeInTheDocument();
    expect(card.queryByRole("link", { name: "Abrir" })).not.toBeInTheDocument();
  });

  it("activar llama a la acción", async () => {
    render(<ToolsCatalog entries={catalogEntries(TOOLS, [])} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(estado.llamadas).toEqual([`activate:${SLUG}`]);
  });

  it("si activar falla, el motivo se muestra", async () => {
    estado.respuesta = { error: "No se pudo activar la herramienta. Intenta de nuevo." };
    render(<ToolsCatalog entries={catalogEntries(TOOLS, [])} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo activar/);
  });

  it("activa: ofrece abrirla, sus parámetros con los valores guardados, y desactivarla", () => {
    render(
      <ToolsCatalog
        entries={catalogEntries(TOOLS, [{ slug: SLUG, config: saved, archivedAt: null }])}
      />,
    );

    const card = within(screen.getByTestId(`tool-${SLUG}`));
    expect(card.getByText("Activa")).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Abrir" })).toHaveAttribute(
      "href",
      "/extensions/print-cost-3d",
    );
    expect(card.getByLabelText("Precio del filamento (por kilo)")).toHaveValue("190");
  });

  it("desactivar pide confirmación y dice que los parámetros se conservan", async () => {
    render(
      <ToolsCatalog
        entries={catalogEntries(TOOLS, [{ slug: SLUG, config: saved, archivedAt: null }])}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    // Todavía no se llamó a nada: primero se confirma.
    expect(estado.llamadas).toEqual([]);

    const dialog = within(screen.getByRole("alertdialog"));
    expect(dialog.getByText(/Tus parámetros se conservan/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Desactivar" }));
    expect(estado.llamadas).toEqual([`deactivate:${SLUG}`]);
  });

  it("cancelar la confirmación no desactiva", async () => {
    render(
      <ToolsCatalog
        entries={catalogEntries(TOOLS, [{ slug: SLUG, config: saved, archivedAt: null }])}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
    );
    expect(estado.llamadas).toEqual([]);
  });

  it("desactivada antes: avisa de que al activarla vuelven sus parámetros", () => {
    render(
      <ToolsCatalog
        entries={catalogEntries(TOOLS, [
          { slug: SLUG, config: saved, archivedAt: "2026-09-20T10:00:00Z" },
        ])}
      />,
    );
    expect(screen.getByText(/vuelve con los parámetros que dejaste/)).toBeInTheDocument();
  });

  it("sin herramientas en el registro lo dice", () => {
    render(<ToolsCatalog entries={[]} />);
    expect(screen.getByTestId("tools-empty")).toBeInTheDocument();
  });
});
