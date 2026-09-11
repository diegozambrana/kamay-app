import { beforeEach, describe, expect, it, vi } from "vitest";

const ORDER = "11111111-1111-4111-8111-111111111111";

/** Qué acción de dominio se llamó y con qué. */
const estado = vi.hoisted(() => ({
  llamadas: [] as { dominio: string; input: unknown }[],
  fallo: null as { error: string } | null,
  revalidadas: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    estado.revalidadas.push(path);
  },
}));

const registrar = (dominio: string) => async (input: unknown) => {
  estado.llamadas.push({ dominio, input });
  return estado.fallo ?? undefined;
};

vi.mock("@/actions/orders", () => ({ unarchiveOrder: registrar("orders") }));
vi.mock("@/actions/expenses", () => ({ unarchiveExpense: registrar("expenses") }));
vi.mock("@/actions/contacts", () => ({ setContactArchived: registrar("contacts") }));
vi.mock("@/actions/catalog", () => ({ setItemArchived: registrar("items") }));
vi.mock("@/actions/configuration", () => ({
  unarchiveConfigurationItem: registrar("configuration"),
}));

const { unarchiveFromEvent } = await import("./activity");

beforeEach(() => {
  estado.llamadas = [];
  estado.fallo = null;
  estado.revalidadas = [];
});

/**
 * KAM-22 · Desarchivar desde el evento.
 *
 * Escenarios de `activity-screen` § Un evento de archivado permite
 * desarchivar, y el desarchivado queda registrado.
 *
 * Lo que se comprueba es que **delega**. Un `update archived_at = null`
 * genérico desde aquí funcionaría igual de bien en la pantalla y se saltaría
 * las validaciones, la guardia de rol y el `revalidatePath` que cada dominio
 * ya tiene: sería una puerta trasera al modelo con aspecto de atajo.
 */
describe("unarchiveFromEvent", () => {
  it("delega en la acción del dominio, con la forma que esa acción espera", async () => {
    await unarchiveFromEvent({ tableName: "orders", recordId: ORDER });

    expect(estado.llamadas).toEqual([
      { dominio: "orders", input: { orderId: ORDER } },
    ]);
  });

  it("cada tabla va a su acción", async () => {
    for (const tableName of ["expenses", "contacts", "items"]) {
      await unarchiveFromEvent({ tableName, recordId: ORDER });
    }

    expect(estado.llamadas.map((c) => c.dominio)).toEqual([
      "expenses",
      "contacts",
      "items",
    ]);
    expect(estado.llamadas[1].input).toEqual({ id: ORDER, archived: false });
  });

  it("las cuatro tablas de configuración van con su nombre de entidad", async () => {
    const esperado: Record<string, string> = {
      business_lines: "line",
      sales_channels: "channel",
      expense_categories: "category",
      units: "unit",
    };

    for (const tableName of Object.keys(esperado)) {
      estado.llamadas = [];
      await unarchiveFromEvent({ tableName, recordId: ORDER });
      expect(estado.llamadas[0]).toEqual({
        dominio: "configuration",
        input: { entity: esperado[tableName], id: ORDER },
      });
    }
  });

  // Escenario: Ya desarchivado, sin acción — su otra mitad. Una tabla sin
  // acción de desarchivado no se resuelve con un atajo.
  it("una tabla sin acción de desarchivado se niega y no toca nada", async () => {
    const result = await unarchiveFromEvent({
      tableName: "tasks",
      recordId: ORDER,
    });

    expect(result).toEqual({
      error: "Este registro no se puede desarchivar desde la bitácora.",
    });
    expect(estado.llamadas).toEqual([]);
    expect(estado.revalidadas).toEqual([]);
  });

  it("una variante tampoco: su acción pide también el ítem, que el evento no guarda", async () => {
    const result = await unarchiveFromEvent({
      tableName: "item_variants",
      recordId: ORDER,
    });

    expect(result?.error).toBeTruthy();
    expect(estado.llamadas).toEqual([]);
  });

  it("un identificador que no es un uuid se rechaza antes de despachar", async () => {
    const result = await unarchiveFromEvent({
      tableName: "orders",
      recordId: "no-soy-un-uuid",
    });

    expect(result?.error).toBe("No se pudo identificar el registro.");
    expect(estado.llamadas).toEqual([]);
  });

  it("el error del dominio se devuelve tal cual, sin reescribirlo", async () => {
    estado.fallo = { error: "No se pudo desarchivar el pedido." };

    const result = await unarchiveFromEvent({
      tableName: "orders",
      recordId: ORDER,
    });

    expect(result).toEqual({ error: "No se pudo desarchivar el pedido." });
    expect(estado.revalidadas).toEqual([]);
  });

  it("al lograrlo revalida la bitácora, para que el evento nuevo aparezca", async () => {
    await unarchiveFromEvent({ tableName: "orders", recordId: ORDER });

    expect(estado.revalidadas).toEqual(["/activity"]);
  });
});
