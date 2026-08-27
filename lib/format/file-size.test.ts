import { describe, expect, it } from "vitest";

import { formatFileSize } from "./file-size";

describe("formatFileSize", () => {
  it("los bytes sueltos se muestran tal cual", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(940)).toBe("940 B");
  });

  it("sube de unidad en múltiplos de 1024, como el escritorio", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("redondea a un decimal con coma", () => {
    expect(formatFileSize(5_033_165)).toBe("4,8 MB");
  });

  it("a partir de 100 no muestra decimales", () => {
    expect(formatFileSize(120 * 1024)).toBe("120 KB");
  });

  it("un tamaño imposible no rompe la interfaz", () => {
    expect(formatFileSize(-1)).toBe("—");
    expect(formatFileSize(Number.NaN)).toBe("—");
  });
});
