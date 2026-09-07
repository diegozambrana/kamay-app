import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { MembershipService } from "./membership-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const MEMBERSHIP = "22222222-2222-2222-2222-222222222222";
const SUBLIMACION = "33333333-3333-3333-3333-333333333333";
const ALFARERIA = "44444444-4444-4444-4444-444444444444";

/**
 * KAM-15 · Las líneas de una membresía.
 *
 * Escenarios del delta spec `user-management` — requisito "The owner assigns
 * business lines to a membership": «Owner restricts an assistant to one line»,
 * «A membership with no line covers every line», «Clearing the assignment
 * restores full coverage».
 *
 * Lo que la regla de visibilidad significa lo decide `has_line_access()` en la
 * base y lo prueba `task_access.test.sql`; aquí se comprueba que el servicio
 * escribe lo que debe y **nunca borra**.
 */
describe("MembershipService · líneas", () => {
  it("indexa las asignaciones por membresía y solo cuenta las vigentes", async () => {
    const client = new FakeClient([
      {
        data: [
          { membership_id: MEMBERSHIP, business_line_id: SUBLIMACION },
          { membership_id: MEMBERSHIP, business_line_id: ALFARERIA },
        ],
        error: null,
      },
    ]);

    const byMembership = await new MembershipService(
      client.asSupabase(),
    ).listLinesByMembership(ORG);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    // Una asignación retirada está archivada, no borrada: si la lectura no la
    // excluyera, la pantalla mostraría una restricción que ya no existe.
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
    expect(byMembership.get(MEMBERSHIP)).toEqual([SUBLIMACION, ALFARERIA]);
  });

  it("una membresía sin filas no aparece en el mapa: alcanza todas las líneas", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    const byMembership = await new MembershipService(
      client.asSupabase(),
    ).listLinesByMembership(ORG);

    expect(byMembership.has(MEMBERSHIP)).toBe(false);
  });

  it("restringir a una línea archiva lo vigente e inserta la nueva", async () => {
    const client = new FakeClient([
      { data: [], error: null }, // no había ninguna asignación previa
      { data: null, error: null }, // archivar lo vigente
      { data: null, error: null }, // insertar la nueva
    ]);

    await new MembershipService(client.asSupabase()).setLines(ORG, MEMBERSHIP, [
      ALFARERIA,
    ]);

    const inserted = client.queries.at(-1)?.argsOf("insert")?.[0];
    expect(inserted).toEqual([
      {
        membership_id: MEMBERSHIP,
        business_line_id: ALFARERIA,
        organization_id: ORG,
      },
    ]);
  });

  it("quitar la última línea deja la membresía sin restricción, sin insertar nada", async () => {
    const client = new FakeClient([
      { data: [{ business_line_id: ALFARERIA }], error: null },
      { data: null, error: null }, // archivar lo vigente
    ]);

    await new MembershipService(client.asSupabase()).setLines(ORG, MEMBERSHIP, []);

    // Solo la lectura y el archivado: nada que devolver ni que crear.
    expect(client.queries).toHaveLength(2);
    expect(client.queries[1].argsOf("update")?.[0]).toMatchObject({
      archived_at: expect.any(String),
    });
  });

  it("devolver una línea retirada desarchiva su fila en vez de duplicarla", async () => {
    const client = new FakeClient([
      // La fila existe, archivada de una restricción anterior.
      { data: [{ business_line_id: ALFARERIA }], error: null },
      { data: null, error: null }, // archivar lo vigente
      { data: null, error: null }, // desarchivar la que vuelve
    ]);

    await new MembershipService(client.asSupabase()).setLines(ORG, MEMBERSHIP, [
      ALFARERIA,
    ]);

    expect(client.queries).toHaveLength(3);
    expect(client.queries[2].argsOf("update")?.[0]).toEqual({ archived_at: null });
    expect(client.queries[2].has("in", "business_line_id", [ALFARERIA])).toBe(true);
  });

  it("nunca borra: retirar una línea es archivarla (convención nº 3)", async () => {
    const client = new FakeClient([
      { data: [{ business_line_id: ALFARERIA }], error: null },
      { data: null, error: null },
    ]);

    await new MembershipService(client.asSupabase()).setLines(ORG, MEMBERSHIP, []);

    for (const query of client.queries) {
      expect(query.calls.some((call) => call.method === "delete")).toBe(false);
    }
  });

  it("toda escritura lleva la organización explícita (convención nº 2)", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await new MembershipService(client.asSupabase()).setLines(ORG, MEMBERSHIP, [
      SUBLIMACION,
    ]);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[1].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("un fallo al asignar se cuenta con su motivo", async () => {
    const client = new FakeClient([
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: { message: "permission denied" } },
    ]);

    await expect(
      new MembershipService(client.asSupabase()).setLines(ORG, MEMBERSHIP, [
        SUBLIMACION,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
