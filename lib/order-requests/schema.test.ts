import { describe, expect, it } from "vitest";

import { publicOrderRequestSchema } from "./schema";

describe("esquema del formulario público de solicitud de pedido", () => {
  it("acepta nombre y teléfono, con nota", () => {
    const parsed = publicOrderRequestSchema.safeParse({
      name: "Cliente Real",
      phone: "70099999",
      note: "Lo necesito para el viernes",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        name: "Cliente Real",
        phone: "70099999",
        note: "Lo necesito para el viernes",
      });
    }
  });

  it("acepta sin nota: queda null, no cadena vacía", () => {
    const parsed = publicOrderRequestSchema.safeParse({
      name: "Cliente Real",
      phone: "70099999",
      note: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note).toBeNull();
  });

  it("rechaza sin nombre, y el error señala el campo", () => {
    const parsed = publicOrderRequestSchema.safeParse({
      name: "",
      phone: "70099999",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["name"]);
    }
  });

  it("rechaza sin teléfono, y el error señala el campo", () => {
    const parsed = publicOrderRequestSchema.safeParse({
      name: "Cliente Real",
      phone: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["phone"]);
    }
  });

  it("recorta espacios alrededor de nombre y teléfono", () => {
    const parsed = publicOrderRequestSchema.safeParse({
      name: "  Cliente Real  ",
      phone: "  70099999  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Cliente Real");
      expect(parsed.data.phone).toBe("70099999");
    }
  });
});
