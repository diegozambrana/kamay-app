import { describe, expect, it } from "vitest";

import { LINE_COLORS } from "@/types";

import { isLineColor, LINE_COLOR_LABELS, lineColorClasses } from "./colors";

describe("colores de línea", () => {
  it("cada token declarado tiene clases y nombre visible", () => {
    for (const color of LINE_COLORS) {
      expect(lineColorClasses(color).dot).toContain(color);
      expect(LINE_COLOR_LABELS[color]).toBeTruthy();
    }
  });

  it("las clases son literales, nunca interpoladas", () => {
    // Si alguna vez se arma con plantillas, Tailwind no la genera y el color
    // desaparece en producción sin que ninguna prueba lo note.
    expect(lineColorClasses("blue").dot).toBe("bg-blue-500");
    expect(lineColorClasses("orange").badge).toContain("bg-orange-100");
  });

  it("un token desconocido cae en gris en lugar de romper la pantalla", () => {
    expect(lineColorClasses("fucsia")).toEqual(lineColorClasses("zinc"));
    expect(lineColorClasses("")).toEqual(lineColorClasses("zinc"));
  });

  it("reconoce los tokens válidos y rechaza los demás", () => {
    expect(isLineColor("violet")).toBe(true);
    expect(isLineColor("fucsia")).toBe(false);
  });
});
