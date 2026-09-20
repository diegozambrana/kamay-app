import { describe, expect, it } from "vitest";

import { publicOrderCommentSchema } from "./schema";

describe("esquema del comentario público de seguimiento", () => {
  it("acepta nombre y cuerpo", () => {
    const parsed = publicOrderCommentSchema.safeParse({
      name: "Cliente Demo",
      body: "¿Para cuándo está listo?",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        name: "Cliente Demo",
        body: "¿Para cuándo está listo?",
      });
    }
  });

  it("rechaza sin nombre, y el error señala el campo", () => {
    const parsed = publicOrderCommentSchema.safeParse({ name: "", body: "algo" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["name"]);
  });

  it("rechaza sin cuerpo, y el error señala el campo", () => {
    const parsed = publicOrderCommentSchema.safeParse({ name: "Cliente", body: "" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["body"]);
  });

  it("recorta espacios alrededor de nombre y cuerpo", () => {
    const parsed = publicOrderCommentSchema.safeParse({
      name: "  Cliente Demo  ",
      body: "  Un comentario  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Cliente Demo");
      expect(parsed.data.body).toBe("Un comentario");
    }
  });
});
