import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("toma la primera letra de las dos primeras palabras", () => {
    expect(initialsOf("Marcela Cruz")).toBe("MC");
  });

  it("con un solo nombre usa solo esa letra", () => {
    expect(initialsOf("Marcela")).toBe("M");
  });

  it("ignora nombres compuestos de más de dos palabras, solo toma las dos primeras", () => {
    expect(initialsOf("Marcela Inés Cruz")).toBe("MI");
  });

  it("recorta espacios repetidos entre palabras", () => {
    expect(initialsOf("Marcela   Cruz")).toBe("MC");
  });

  it("sin nombre no hay iniciales que inventar", () => {
    expect(initialsOf(null)).toBeNull();
    expect(initialsOf(undefined)).toBeNull();
    expect(initialsOf("")).toBeNull();
    expect(initialsOf("   ")).toBeNull();
  });
});
