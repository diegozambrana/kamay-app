import { describe, expect, it } from "vitest";

import type { ItemVariant } from "@/types";

import { movementVariantProblem } from "./variants";

function variant(id: string, archivedAt: string | null = null): ItemVariant {
  return { id, organizationId: "org", itemId: "item", name: id, attributes: {}, salePrice: null, archivedAt };
}

const NEGRO = variant("negro");
const ROJO = variant("rojo");
const VIEJA = variant("vieja", "2026-09-01T00:00:00Z");

describe("movementVariantProblem", () => {
  it("un ítem sin variantes admite el movimiento sin variante", () => {
    expect(movementVariantProblem([], null)).toBeNull();
  });

  it("un ítem cuyas variantes están todas archivadas también", () => {
    expect(movementVariantProblem([VIEJA], null)).toBeNull();
  });

  it("un ítem con variantes vigentes exige elegir una", () => {
    // «El servidor rechaza el consumo sin variante», nivel unitario.
    expect(movementVariantProblem([NEGRO, ROJO], null)).toBe(
      "Elige la variante: este insumo tiene variantes.",
    );
  });

  it("el conteo de la fila «Sin variante» se admite sin variante", () => {
    // «Poner en cero lo que no tiene variante», nivel unitario.
    expect(movementVariantProblem([NEGRO], null, { allowUnassigned: true })).toBeNull();
  });

  it("una variante de otro ítem o archivada se rechaza", () => {
    // «El servidor rechaza una variante ajena», nivel unitario.
    expect(movementVariantProblem([NEGRO], "de-otro-item")).toBe("Esa variante no es de este insumo.");
    expect(movementVariantProblem([NEGRO, VIEJA], "vieja")).toBe(
      "Esa variante está archivada. Elige otra.",
    );
  });

  it("una variante vigente del ítem se admite", () => {
    expect(movementVariantProblem([NEGRO, ROJO], "rojo")).toBeNull();
  });
});
