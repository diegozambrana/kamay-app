import { describe, expect, it } from "vitest";

import { findLostChecklistItems } from "./checklist-diff";

describe("findLostChecklistItems", () => {
  it("detecta un ítem del original ausente en la propuesta", () => {
    const original = "- [ ] Tornear\n- [ ] Hornear\n- [x] Esmaltar";
    const proposal = "- [ ] Tornear\n- [x] Esmaltar";

    expect(findLostChecklistItems(original, proposal)).toEqual(["Hornear"]);
  });

  it("sin pérdida, no reporta nada", () => {
    const original = "- [ ] Tornear\n- [x] Esmaltar";
    const proposal = "- [x] Esmaltar\n- [ ] Tornear";

    expect(findLostChecklistItems(original, proposal)).toEqual([]);
  });

  it("un ítem conservado pero desmarcado no cuenta como perdido", () => {
    const original = "- [x] Esmaltar";
    const proposal = "- [ ] Esmaltar";

    expect(findLostChecklistItems(original, proposal)).toEqual([]);
  });

  it("ignora diferencias de espacios y mayúsculas al comparar", () => {
    const original = "- [ ] Tornear   la pieza";
    const proposal = "- [ ] tornear la pieza";

    expect(findLostChecklistItems(original, proposal)).toEqual([]);
  });

  it("sin ítems de verificación en ninguno de los dos, no reporta nada", () => {
    expect(findLostChecklistItems("Texto sin listas.", "Otro texto sin listas.")).toEqual([]);
  });

  it("una propuesta que pierde todos los ítems los reporta todos", () => {
    const original = "- [ ] Tornear\n- [ ] Hornear";
    const proposal = "Un párrafo sin ninguna casilla.";

    expect(findLostChecklistItems(original, proposal)).toEqual(["Tornear", "Hornear"]);
  });
});
