import { describe, expect, it } from "vitest";

import { addAccountSchema, assignmentSchema, organizationSchema } from "./schema";

const ORG = "10000000-0000-0000-0000-000000000003";
const USER = "20000000-0000-0000-0000-000000000004";

describe("organizationSchema", () => {
  it("un nombre vacío se rechaza", () => {
    // Escenario «An empty name is rejected».
    const result = organizationSchema.safeParse({
      name: "   ",
      currency: "BOB",
      timezone: "America/La_Paz",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("La organización necesita un nombre");
  });

  it("normaliza la moneda a mayúsculas y recorta", () => {
    expect(
      organizationSchema.parse({ name: " Taller Norte ", currency: "usd", timezone: "UTC" }),
    ).toEqual({ name: "Taller Norte", currency: "USD", timezone: "UTC" });
  });

  it("la moneda son tres letras", () => {
    expect(
      organizationSchema.safeParse({ name: "T", currency: "BOLIVIANO", timezone: "UTC" }).success,
    ).toBe(false);
  });
});

describe("assignmentSchema", () => {
  it("exige al menos una organización", () => {
    expect(assignmentSchema.safeParse({ userId: USER, assignments: [] }).success).toBe(false);
  });

  it("acepta varias organizaciones con su rol", () => {
    const parsed = assignmentSchema.parse({
      userId: USER,
      assignments: [
        { organizationId: ORG, role: "owner", displayName: "Ana" },
        { organizationId: "10000000-0000-0000-0000-000000000001", role: "assistant", displayName: "Ana" },
      ],
    });
    expect(parsed.assignments).toHaveLength(2);
  });

  it("rechaza un rol inexistente", () => {
    expect(
      assignmentSchema.safeParse({
        userId: USER,
        assignments: [{ organizationId: ORG, role: "admin", displayName: "Ana" }],
      }).success,
    ).toBe(false);
  });
});

describe("addAccountSchema", () => {
  it("valida el correo y deja el nombre visible como opcional", () => {
    expect(
      addAccountSchema.safeParse({ organizationId: ORG, email: "no-es-correo", role: "owner" })
        .success,
    ).toBe(false);
    expect(
      addAccountSchema.safeParse({ organizationId: ORG, email: "ana@kamay.test", role: "owner" })
        .success,
    ).toBe(true);
  });
});
