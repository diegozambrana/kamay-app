import { describe, expect, it } from "vitest";

import { applyToolbarAction } from "./toolbar";

/** Atajo: aplica sobre el texto marcando la selección con posiciones. */
function apply(
  text: string,
  action: Parameters<typeof applyToolbarAction>[2],
  start = 0,
  end = start,
) {
  return applyToolbarAction(text, { start, end }, action);
}

describe("negrita y cursiva", () => {
  it("envuelve la selección en negrita", () => {
    const { text } = apply("Set de 6 tazas de gres", "bold", 7, 14);

    expect(text).toBe("Set de **6 tazas** de gres");
  });

  it("deja seleccionado lo que envolvió", () => {
    const { text, selection } = apply("Set de 6 tazas de gres", "bold", 7, 14);

    expect(text.slice(selection.start, selection.end)).toBe("6 tazas");
  });

  it("quita la negrita si ya estaba", () => {
    // Un botón que solo sabe poner obliga a borrar a mano para deshacer.
    const { text } = apply("Set de **6 tazas** de gres", "bold", 7, 18);

    expect(text).toBe("Set de 6 tazas de gres");
  });

  it("sin selección deja un marcador de posición seleccionado", () => {
    const { text, selection } = apply("", "bold");

    expect(text).toBe("**texto en negrita**");
    expect(text.slice(selection.start, selection.end)).toBe("texto en negrita");
  });

  it("la cursiva usa un solo asterisco", () => {
    expect(apply("esmalte celeste", "italic", 8, 15).text).toBe("esmalte *celeste*");
  });
});

describe("encabezado y listas", () => {
  it("convierte la línea en encabezado", () => {
    expect(apply("Proceso de la hornada", "heading", 3).text).toBe(
      "## Proceso de la hornada",
    );
  });

  it("convierte la línea en elemento de lista", () => {
    expect(apply("Modelado", "bulletList", 0).text).toBe("- Modelado");
  });

  it("convierte la línea en elemento de lista de verificación", () => {
    expect(apply("Modelado", "checklist", 0).text).toBe("- [ ] Modelado");
  });

  it("en una línea vacía deja el prefijo y algo que escribir encima", () => {
    const { text, selection } = apply("", "checklist");

    expect(text).toBe("- [ ] Paso");
    expect(text.slice(selection.start, selection.end)).toBe("Paso");
  });

  it("alcanza todas las líneas de la selección", () => {
    const body = "Modelado\nSecado\nEsmaltado";
    const { text } = apply(body, "checklist", 0, body.length);

    expect(text).toBe("- [ ] Modelado\n- [ ] Secado\n- [ ] Esmaltado");
  });

  it("quita el prefijo si todas las líneas ya lo llevan", () => {
    const body = "- [ ] Modelado\n- [ ] Secado";
    const { text } = apply(body, "checklist", 0, body.length);

    expect(text).toBe("Modelado\nSecado");
  });

  it("no toca las líneas de alrededor", () => {
    const body = "Antes\nModelado\nDespués";
    const { text } = apply(body, "bulletList", 6);

    expect(text).toBe("Antes\n- Modelado\nDespués");
  });
});

describe("enlace", () => {
  it("usa la selección como rótulo y deja el destino listo para escribir", () => {
    const { text, selection } = apply("Ver la ficha", "link", 7, 12);

    expect(text).toBe("Ver la [ficha](https://)");
    expect(text.slice(selection.start, selection.end)).toBe("https://");
  });

  it("sin selección deja un rótulo de ejemplo", () => {
    expect(apply("", "link").text).toBe("[texto del enlace](https://)");
  });
});
