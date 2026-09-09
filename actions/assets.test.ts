import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const PRINTER = "22222222-2222-4222-8222-222222222222";
const OTHER_ASSET = "66666666-6666-4666-8666-666666666666";
const EXPENSE = "33333333-3333-4333-8333-333333333333";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  esDuenna: true,
  vinculos: [] as unknown[],
  activos: [] as unknown[],
  fallo: null as unknown,
  revalidadas: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    estado.revalidadas.push(path);
  },
}));

vi.mock("@/lib/auth/session-context", () => ({
  getOwnerContext: async () =>
    estado.esDuenna
      ? {
          supabase: {},
          userId: USER,
          organizationId: ORG,
          membership: { role: "owner" },
        }
      : null,
}));

vi.mock("@/services/assets/asset-service", () => ({
  AssetService: class {
    async save(_org: string, values: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.activos.push(values);
    }
  },
}));

vi.mock("@/services/expenses/expense-service", () => ({
  ExpenseService: class {
    async setAsset(_org: string, id: string, asset: unknown) {
      if (estado.fallo) throw estado.fallo;
      estado.vinculos.push({ id, asset });
    }
  },
}));

const { linkExpenseToAsset, saveAssetDetails } = await import("./assets");

beforeEach(() => {
  estado.esDuenna = true;
  estado.vinculos = [];
  estado.activos = [];
  estado.fallo = null;
  estado.revalidadas = [];
});

/**
 * Escenarios del delta spec `assets`, requisito "Vinculación de gastos de
 * mantenimiento a un activo": "Vincular y ver el efecto", "Desvincular", "Un
 * egreso pertenece a un solo activo", "Ninguna organización vincula lo ajeno".
 */
describe("linkExpenseToAsset", () => {
  it("vincula el egreso como mantenimiento y revalida la barra", async () => {
    const result = await linkExpenseToAsset({
      expenseId: EXPENSE,
      assetId: PRINTER,
      role: "maintenance",
    });

    expect(result).toBeUndefined();
    expect(estado.vinculos).toEqual([
      { id: EXPENSE, asset: { assetId: PRINTER, role: "maintenance" } },
    ]);
    // El costo total cambió: la pantalla del activo no puede quedarse con la
    // barra anterior.
    expect(estado.revalidadas).toContain("/assets");
    expect(estado.revalidadas).toContain(`/expenses/${EXPENSE}`);
  });

  it("desvincular es el mismo camino con el activo en nulo", async () => {
    const result = await linkExpenseToAsset({
      expenseId: EXPENSE,
      assetId: null,
      role: null,
    });

    expect(result).toBeUndefined();
    expect(estado.vinculos).toEqual([{ id: EXPENSE, asset: null }]);
    expect(estado.revalidadas).toContain("/assets");
  });

  it("el activo y su papel se declaran juntos o no se declaran", async () => {
    const result = await linkExpenseToAsset({
      expenseId: EXPENSE,
      assetId: PRINTER,
      role: null,
    });

    expect(result).toEqual({ error: "Elige el activo y qué hace ese egreso por él." });
    expect(estado.vinculos).toHaveLength(0);
  });

  it("vincular a un segundo activo reemplaza: nunca hay dos vínculos vivos", async () => {
    await linkExpenseToAsset({ expenseId: EXPENSE, assetId: PRINTER, role: "maintenance" });
    await linkExpenseToAsset({ expenseId: EXPENSE, assetId: OTHER_ASSET, role: "maintenance" });

    expect(estado.vinculos).toHaveLength(2);
    // Dos escrituras sobre el mismo egreso, la última manda: la columna es
    // una sola, así que no puede quedar apuntando a los dos.
    expect(estado.vinculos.at(-1)).toEqual({
      id: EXPENSE,
      asset: { assetId: OTHER_ASSET, role: "maintenance" },
    });
  });

  it("un activo de otra organización lo rechaza la base y el mensaje llega entero", async () => {
    estado.fallo = { message: "El activo pertenece a otra organización" };

    const result = await linkExpenseToAsset({
      expenseId: EXPENSE,
      assetId: PRINTER,
      role: "maintenance",
    });

    expect(result).toEqual({ error: "El activo pertenece a otra organización" });
  });

  it("el ayudante no llega a escribir", async () => {
    estado.esDuenna = false;

    const result = await linkExpenseToAsset({
      expenseId: EXPENSE,
      assetId: PRINTER,
      role: "maintenance",
    });

    expect(result).toEqual({
      error: "Solo la persona dueña puede administrar los activos.",
    });
    expect(estado.vinculos).toHaveLength(0);
  });
});

describe("saveAssetDetails", () => {
  it("guarda costo y fecha y revalida activos y catálogo", async () => {
    const result = await saveAssetDetails({
      itemId: PRINTER,
      acquisitionCost: 7000,
      acquiredOn: "2026-03-01",
    });

    expect(result).toBeUndefined();
    expect(estado.activos).toHaveLength(1);
    expect(estado.revalidadas).toContain("/assets");
    expect(estado.revalidadas).toContain(`/catalog/${PRINTER}`);
  });

  it("un costo negativo no llega a la base", async () => {
    const result = await saveAssetDetails({
      itemId: PRINTER,
      acquisitionCost: -1,
      acquiredOn: "2026-03-01",
    });

    expect(result).toEqual({ error: "El costo no puede ser negativo." });
    expect(estado.activos).toHaveLength(0);
  });

  it("el ayudante no puede declarar un activo", async () => {
    estado.esDuenna = false;

    const result = await saveAssetDetails({
      itemId: PRINTER,
      acquisitionCost: 7000,
      acquiredOn: "2026-03-01",
    });

    expect(result).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
    expect(estado.activos).toHaveLength(0);
  });
});
