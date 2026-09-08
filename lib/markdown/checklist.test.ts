import { describe, expect, it } from "vitest";

import { parseChecklistItems, toggleChecklistItem } from "./checklist";

const HORNADA = [
  "## Proceso de la hornada 07",
  "",
  "Set de 6 tazas de gres con esmalte celeste.",
  "",
  "- [ ] Modelado",
  "- [ ] Secado",
  "- [ ] Primera quema",
  "- [ ] Esmaltado",
  "- [ ] Segunda quema",
  "",
  "Van al horno junto con las macetas medianas.",
].join("\n");

describe("parseChecklistItems", () => {
  it("encuentra las casillas en el orden en que se rinden", () => {
    const items = parseChecklistItems(HORNADA);

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.text)).toEqual([
      "Modelado",
      "Secado",
      "Primera quema",
      "Esmaltado",
      "Segunda quema",
    ]);
    expect(items.map((item) => item.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("lee el estado de cada casilla", () => {
    const items = parseChecklistItems("- [x] Hecho\n- [ ] Pendiente\n- [X] También hecho");

    expect(items.map((item) => item.checked)).toEqual([true, false, true]);
  });

  it("acepta los tres marcadores de lista y la sangría", () => {
    const items = parseChecklistItems(
      ["- [ ] Guion", "* [ ] Asterisco", "+ [ ] Más", "  - [ ] Sangrada"].join("\n"),
    );

    expect(items).toHaveLength(4);
    expect(items[3].text).toBe("Sangrada");
  });

  it("no cuenta las casillas de dentro de un bloque de código cercado", () => {
    const body = [
      "- [ ] Real",
      "",
      "```md",
      "- [ ] Ejemplo de la documentación",
      "- [x] Otro ejemplo",
      "```",
      "",
      "- [ ] También real",
    ].join("\n");

    const items = parseChecklistItems(body);

    // Si contaran, «También real» tendría índice 3 en vez de 1 y marcar una
    // casilla escribiría en la línea equivocada (riesgo declarado en design).
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.text)).toEqual(["Real", "También real"]);
  });

  it("no confunde un cercado de tildes con el cierre de uno de comillas", () => {
    const body = ["```", "~~~", "- [ ] Dentro", "```", "- [ ] Fuera"].join("\n");

    const items = parseChecklistItems(body);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Fuera");
  });

  it("ignora el texto que solo se parece a una casilla", () => {
    const items = parseChecklistItems("Compramos [ ] cajas\n- Sin casilla");

    expect(items).toHaveLength(0);
  });
});

describe("toggleChecklistItem", () => {
  it("marca la casilla indicada", () => {
    const resultado = toggleChecklistItem(HORNADA, 2, true);

    expect(resultado).toContain("- [x] Primera quema");
  });

  it("desmarca una casilla ya marcada", () => {
    const marcado = toggleChecklistItem(HORNADA, 0, true);

    expect(toggleChecklistItem(marcado, 0, false)).toBe(HORNADA);
  });

  it("cambia solo la línea alternada y deja el resto idéntico", () => {
    const resultado = toggleChecklistItem(HORNADA, 2, true);

    const antes = HORNADA.split("\n");
    const despues = resultado.split("\n");

    expect(despues).toHaveLength(antes.length);
    for (const [i, linea] of antes.entries()) {
      if (i === 6) continue; // la línea de «Primera quema»
      expect(despues[i]).toBe(linea);
    }
  });

  it("conserva la sangría y el marcador de la línea", () => {
    const body = "  * [ ] Sangrada con asterisco";

    expect(toggleChecklistItem(body, 0, true)).toBe("  * [x] Sangrada con asterisco");
  });

  it("devuelve el cuerpo intacto si el índice no existe", () => {
    expect(toggleChecklistItem(HORNADA, 9, true)).toBe(HORNADA);
    expect(toggleChecklistItem(HORNADA, -1, true)).toBe(HORNADA);
  });

  it("devuelve el cuerpo intacto si no hay ninguna casilla", () => {
    const body = "Solo texto, sin listas.";

    expect(toggleChecklistItem(body, 0, true)).toBe(body);
  });

  it("no escribe dentro de un bloque de código", () => {
    const body = [
      "```md",
      "- [ ] Ejemplo de la documentación",
      "```",
      "- [ ] Real",
    ].join("\n");

    const resultado = toggleChecklistItem(body, 0, true);

    expect(resultado).toContain("- [ ] Ejemplo de la documentación");
    expect(resultado).toContain("- [x] Real");
  });

  it("no altera el final de línea ni añade uno nuevo", () => {
    const body = "- [ ] Único\n";

    expect(toggleChecklistItem(body, 0, true)).toBe("- [x] Único\n");
  });
});
