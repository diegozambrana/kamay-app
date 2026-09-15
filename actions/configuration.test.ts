import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
/** Con la forma de los de la semilla: sin versión RFC en su sitio. */
const SEED_LINE = "10000000-0000-0000-0000-000000000001";
const SEED_CHANNEL = "20000000-0000-0000-0000-000000000002";

/** Qué se le pidió a cada servicio, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  llamadas: [] as { servicio: string; metodo: string; id: string }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/auth/session-context", () => ({
  getOwnerContext: async () => ({ supabase: {}, organizationId: ORG }),
}));

function servicio(nombre: string) {
  return class {
    async rename(_org: string, id: string) {
      estado.llamadas.push({ servicio: nombre, metodo: "rename", id });
    }
    async archive(_org: string, id: string) {
      estado.llamadas.push({ servicio: nombre, metodo: "archive", id });
    }
    async unarchive(_org: string, id: string) {
      estado.llamadas.push({ servicio: nombre, metodo: "unarchive", id });
    }
  };
}

vi.mock("@/services/configuration/business-line-service", () => ({
  BusinessLineService: servicio("line"),
}));
vi.mock("@/services/configuration/sales-channel-service", () => ({
  SalesChannelService: servicio("channel"),
}));
vi.mock("@/services/configuration/expense-category-service", () => ({
  ExpenseCategoryService: servicio("category"),
}));
vi.mock("@/services/configuration/unit-service", () => ({
  UnitService: servicio("unit"),
}));

const {
  archiveConfigurationItem,
  unarchiveConfigurationItem,
  updateBusinessLine,
  updateSalesChannel,
} = await import("./configuration");

beforeEach(() => {
  estado.llamadas = [];
});

/**
 * Los registros de la semilla tienen identificadores escritos a mano, sin la
 * versión RFC en su sitio. Con `z.uuid()` editarlos o archivarlos fallaba con
 * «Invalid UUID»; solo los creados desde la aplicación (UUID v4) pasaban.
 */
describe("acciones de configuración con identificadores de la semilla", () => {
  it("editar una línea sembrada llega al servicio", async () => {
    const result = await updateBusinessLine({ id: SEED_LINE, name: "Sublimación 2", color: "blue" });

    expect(result).toBeUndefined();
    expect(estado.llamadas).toEqual([{ servicio: "line", metodo: "rename", id: SEED_LINE }]);
  });

  it("editar un canal sembrado llega al servicio", async () => {
    const result = await updateSalesChannel({ id: SEED_CHANNEL, name: "Feria UP" });

    expect(result).toBeUndefined();
    expect(estado.llamadas).toEqual([{ servicio: "channel", metodo: "rename", id: SEED_CHANNEL }]);
  });

  it("archivar y restaurar lo sembrado también llega al servicio", async () => {
    expect(await archiveConfigurationItem({ entity: "channel", id: SEED_CHANNEL })).toBeUndefined();
    expect(await unarchiveConfigurationItem({ entity: "channel", id: SEED_CHANNEL })).toBeUndefined();

    expect(estado.llamadas.map((l) => l.metodo)).toEqual(["archive", "unarchive"]);
  });

  it("un identificador que no es un UUID se rechaza en español, sin llegar al servicio", async () => {
    const result = await updateSalesChannel({ id: "no-es-un-id", name: "Feria UP" });

    expect(result).toEqual({ error: "No se pudo identificar el registro." });
    expect(estado.llamadas).toEqual([]);
  });
});
