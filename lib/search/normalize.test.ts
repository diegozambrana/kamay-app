import { describe, expect, it } from "vitest";

import { matchesSearch, normalizeForSearch } from "./normalize";

describe("normalizeForSearch", () => {
  it("quita los acentos", () => {
    expect(normalizeForSearch("Sublimación")).toBe("sublimacion");
    expect(normalizeForSearch("Ñawi")).toBe("nawi");
  });

  it("pasa a minúsculas", () => {
    expect(normalizeForSearch("TAZA")).toBe("taza");
  });

  it("recorta y colapsa los espacios sobrantes", () => {
    expect(normalizeForSearch("  taza   grande  ")).toBe("taza grande");
  });

  it("la cadena vacía se queda vacía", () => {
    expect(normalizeForSearch("")).toBe("");
    expect(normalizeForSearch("   ")).toBe("");
  });
});

describe("matchesSearch", () => {
  it("encuentra con acento lo escrito sin acento", () => {
    expect(matchesSearch("Taza para sublimación", "sublimacion")).toBe(true);
  });

  it("encuentra sin acento lo escrito con acento", () => {
    expect(matchesSearch("Taza para sublimacion", "sublimación")).toBe(true);
  });

  it("ignora mayúsculas", () => {
    expect(matchesSearch("Taza para sublimación", "TAZA")).toBe(true);
  });

  it("un término vacío no filtra nada", () => {
    expect(matchesSearch("Cualquiera", "  ")).toBe(true);
  });

  it("no encuentra lo que no está", () => {
    expect(matchesSearch("Taza para sublimación", "arcilla")).toBe(false);
  });
});
