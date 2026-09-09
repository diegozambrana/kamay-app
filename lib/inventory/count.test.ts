import { describe, expect, it } from "vitest";

import { countAdjustment } from "./count";

describe("countAdjustment", () => {
  // Escenario "El saldo pasa al valor contado" del delta spec `inventory`.
  it("guarda la diferencia cuando se contó menos de lo que decía el saldo", () => {
    expect(countAdjustment(60, 65)).toEqual({ status: "adjustment", difference: -5 });
  });

  // Escenario "Conteo por encima del saldo".
  it("guarda la diferencia cuando se contó más", () => {
    expect(countAdjustment(72, 60)).toEqual({ status: "adjustment", difference: 12 });
  });

  // Escenario "Conteo que coincide con el saldo": no es un fallo, es la
  // respuesta correcta y frecuente. La base rechazaría cantidad cero.
  it("no produce movimiento cuando el conteo coincide", () => {
    expect(countAdjustment(60, 60)).toEqual({ status: "unchanged" });
  });

  it("contar cero es una respuesta legítima", () => {
    expect(countAdjustment(0, 8)).toEqual({ status: "adjustment", difference: -8 });
  });

  it("un saldo negativo se corrige hacia arriba", () => {
    expect(countAdjustment(5, -3)).toEqual({ status: "adjustment", difference: 8 });
  });

  // `57.1 - 57` es `0.09999999999999432` en coma flotante. La columna es
  // `numeric(14,3)`: sin redondear, se guardaría un ajuste imposible.
  it("redondea a los tres decimales de la columna", () => {
    expect(countAdjustment(57.1, 57)).toEqual({ status: "adjustment", difference: 0.1 });
    expect(countAdjustment(0.3, 0.1)).toEqual({ status: "adjustment", difference: 0.2 });
  });

  it("una diferencia por debajo de la escala de la columna es coincidencia", () => {
    expect(countAdjustment(60.00004, 60)).toEqual({ status: "unchanged" });
  });
});
