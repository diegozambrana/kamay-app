import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";

const estado = vi.hoisted(() => ({
  llamadas: [] as { metodo: string; args: unknown[] }[],
  esDuenna: true,
  fallo: false,
  revalidado: [] as unknown[][],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => estado.revalidado.push(args),
}));

vi.mock("@/lib/auth/session-context", () => ({
  getOwnerContext: async () => (estado.esDuenna ? { supabase: {}, organizationId: ORG } : null),
}));

vi.mock("@/services/tools/organization-tool-service", () => ({
  OrganizationToolService: class {
    private registrar(metodo: string, args: unknown[]) {
      if (estado.fallo) throw new Error("caída");
      estado.llamadas.push({ metodo, args });
    }
    async activate(...args: unknown[]) {
      this.registrar("activate", args);
    }
    async deactivate(...args: unknown[]) {
      this.registrar("deactivate", args);
    }
    async updateConfig(...args: unknown[]) {
      this.registrar("updateConfig", args);
    }
  },
}));

const { activateTool, deactivateTool, updateToolConfig } = await import("@/actions/tools");
const { printCost3d } = await import("@/tools/print-cost-3d/manifest");

const SLUG = "print-cost-3d";

beforeEach(() => {
  estado.llamadas = [];
  estado.esDuenna = true;
  estado.fallo = false;
  estado.revalidado = [];
});

/** KAM-27 · spec `tenant-tools` → catálogo de la dueña y formulario de parámetros. */
describe("activateTool", () => {
  it("activa con los valores por defecto del manifiesto y revalida el layout", async () => {
    expect(await activateTool(SLUG)).toBeUndefined();
    expect(estado.llamadas).toEqual([
      { metodo: "activate", args: [ORG, SLUG, printCost3d.defaults] },
    ]);
    expect(estado.revalidado).toEqual([["/", "layout"]]);
  });

  it("rechaza al ayudante sin tocar el servicio", async () => {
    estado.esDuenna = false;
    expect(await activateTool(SLUG)).toMatchObject({ error: expect.stringMatching(/dueña/) });
    expect(estado.llamadas).toEqual([]);
  });

  it("rechaza un slug que no está en el registro, aunque esté bien formado", async () => {
    expect(await activateTool("no-existe")).toMatchObject({ error: expect.any(String) });
    expect(await activateTool("../etc")).toMatchObject({ error: expect.any(String) });
    expect(estado.llamadas).toEqual([]);
  });

  it("traduce un fallo del servicio", async () => {
    estado.fallo = true;
    expect(await activateTool(SLUG)).toMatchObject({ error: expect.stringMatching(/activar/) });
    expect(estado.revalidado).toEqual([]);
  });
});

describe("deactivateTool", () => {
  it("desactiva y revalida", async () => {
    expect(await deactivateTool(SLUG)).toBeUndefined();
    expect(estado.llamadas).toEqual([{ metodo: "deactivate", args: [ORG, SLUG] }]);
    expect(estado.revalidado).toHaveLength(1);
  });

  it("rechaza al ayudante, el slug desconocido, y traduce un fallo", async () => {
    estado.esDuenna = false;
    expect(await deactivateTool(SLUG)).toMatchObject({ error: expect.any(String) });
    estado.esDuenna = true;
    expect(await deactivateTool("no-existe")).toMatchObject({ error: expect.any(String) });
    estado.fallo = true;
    expect(await deactivateTool(SLUG)).toMatchObject({ error: expect.stringMatching(/desactivar/) });
    expect(estado.llamadas).toEqual([]);
  });
});

describe("updateToolConfig", () => {
  it("guarda la salida del esquema: completada con los valores por defecto", async () => {
    expect(await updateToolConfig(SLUG, { filamentPricePerKg: 190 })).toBeUndefined();
    expect(estado.llamadas).toEqual([
      {
        metodo: "updateConfig",
        args: [ORG, SLUG, { ...printCost3d.defaults, filamentPricePerKg: 190 }],
      },
    ]);
  });

  it("el servidor no confía en el formulario: una curva inválida se rechaza con su camino", async () => {
    const result = await updateToolConfig(SLUG, {
      marginCurve: [
        { cost: 10, margin: 2.5 },
        { cost: 12, margin: 1.5 },
      ],
    });
    expect(result?.error).toMatch(/Entre 10 y 12/);
    expect(result?.issues?.[0].path).toEqual(["marginCurve", 1, "margin"]);
    expect(estado.llamadas).toEqual([]);
  });

  it("rechaza lo que ni siquiera es un objeto", async () => {
    expect(await updateToolConfig(SLUG, "hola")).toMatchObject({ error: expect.any(String) });
    expect(estado.llamadas).toEqual([]);
  });

  it("rechaza al ayudante, el slug desconocido, y traduce un fallo", async () => {
    estado.esDuenna = false;
    expect(await updateToolConfig(SLUG, {})).toMatchObject({ error: expect.stringMatching(/dueña/) });
    estado.esDuenna = true;
    expect(await updateToolConfig("no-existe", {})).toMatchObject({ error: expect.any(String) });
    estado.fallo = true;
    expect(await updateToolConfig(SLUG, {})).toMatchObject({
      error: expect.stringMatching(/parámetros/),
    });
  });
});
