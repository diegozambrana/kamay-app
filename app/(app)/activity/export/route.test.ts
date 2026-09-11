import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_EXPORT_ROWS } from "@/lib/activity/export";

const ORG = "11111111-1111-4111-8111-111111111111";

const estado = vi.hoisted(() => ({
  esDueno: true,
  /** Cuántos eventos devuelve la búsqueda en total. */
  totalEventos: 3,
  paginas: 0,
}));

vi.mock("@/lib/auth/session-context", () => ({
  getOwnerContext: async () =>
    estado.esDueno
      ? { supabase: {}, organizationId: ORG, membership: { role: "owner" } }
      : null,
}));

vi.mock("@/services/organization-service", () => ({
  OrganizationService: class {
    async getById() {
      return { timezone: "America/La_Paz", currency: "Bs" };
    }
  },
}));

vi.mock("@/services/configuration/business-line-service", () => ({
  BusinessLineService: class {
    async listActive() {
      return [];
    }
  },
}));

vi.mock("@/services/activity/label-service", () => ({
  LabelService: class {
    async forRecords() {
      return new Map();
    }
    async forDetails() {
      return new Map();
    }
    async people() {
      return new Map();
    }
  },
  resolveSearch: async () => undefined,
}));

const PAGE_SIZE = 50;

vi.mock("@/services/activity/activity-service", () => ({
  PAGE_SIZE: 50,
  ActivityService: class {
    async search() {
      const restantes = estado.totalEventos - estado.paginas * PAGE_SIZE;
      const cuantos = Math.max(0, Math.min(PAGE_SIZE, restantes));
      estado.paginas += 1;

      return {
        entries: Array.from({ length: cuantos }, (_, i) => ({
          id: estado.paginas * 1000 + i,
          action: "created",
          actorId: null,
          actorLabel: "sistema",
          changes: { name: "Taza" },
          occurredAt: "2026-08-19T14:22:00.000Z",
          tableName: "items",
          recordId: "r1",
          businessLineId: null,
          origin: "desktop",
        })),
        nextCursor: cuantos === PAGE_SIZE ? "siguiente" : null,
      };
    }
  },
}));

const { GET } = await import("./route");

const pedir = (query = "") =>
  GET(new Request(`http://localhost:3010/activity/export${query}`));

beforeEach(() => {
  estado.esDueno = true;
  estado.totalEventos = 3;
  estado.paginas = 0;
});

/**
 * KAM-22 · La exportación del resultado filtrado (design D6).
 *
 * Escenarios de `activity-screen` § El resultado filtrado se exporta →
 * «Se exporta lo filtrado, no lo cargado», «El archivo es legible», «Un
 * resultado por encima del techo se avisa».
 */
describe("GET /activity/export", () => {
  it("el ayudante no descarga por aquí lo que no ve por pantalla", async () => {
    estado.esDueno = false;

    const response = await pedir();
    expect(response.status).toBe(403);
  });

  // Escenario: El archivo es legible
  it("entrega un CSV con su nombre de archivo y la frase redactada", async () => {
    const response = await pedir("?from=2026-08-17&to=2026-08-19");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="bitacora-2026-08-17_2026-08-19.csv"',
    );

    const csv = await response.text();
    expect(csv).toContain("Bitácora de actividad");
    expect(csv).toContain("2026-08-17 a 2026-08-19");
    expect(csv).toContain("Qué pasó");
    // La frase, no el `jsonb` crudo.
    expect(csv).toContain("Sistema registró el ítem");
    expect(csv).toContain("Nombre: — → Taza");
    expect(csv).not.toContain('{"name"');
  });

  // Escenario: Se exporta lo filtrado, no lo cargado
  it("recorre las páginas: exporta más de una página de resultados", async () => {
    estado.totalEventos = PAGE_SIZE + 7;

    const csv = await (await pedir()).text();
    const filas = csv.trimEnd().split("\r\n").slice(5);

    expect(filas).toHaveLength(PAGE_SIZE + 7);
  });

  // Escenario: Un resultado por encima del techo se avisa
  it("por encima del techo avisa y no produce archivo recortado", async () => {
    estado.totalEventos = MAX_EXPORT_ROWS + 1;

    const response = await pedir();

    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as { error: string };
    expect(body.error).toContain(String(MAX_EXPORT_ROWS));
    expect(body.error).toContain("Acota el rango de fechas");
  });

  it("justo en el techo sí exporta", async () => {
    estado.totalEventos = MAX_EXPORT_ROWS;

    const response = await pedir();
    expect(response.status).toBe(200);
  });
});
