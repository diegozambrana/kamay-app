import { describe, expect, it } from "vitest";

import { balance, overpayment, paymentStatus } from "./balance";

describe("balance", () => {
  it("resta lo cobrado del total", () => {
    expect(balance(300, 100)).toBe(200);
  });

  it("sin cobros, el saldo es el total", () => {
    expect(balance(50, 0)).toBe(50);
  });

  it("queda negativo cuando se cobró de más, y eso es información", () => {
    // Scenario: Sobrepago confirmado — el saldo mostrado es −50.
    expect(balance(200, 250)).toBe(-50);
  });

  it("trata un valor no finito como cero en vez de propagar NaN", () => {
    expect(balance(Number.NaN, 10)).toBe(-10);
    expect(balance(100, Number.NaN)).toBe(100);
  });
});

describe("paymentStatus", () => {
  it("Scenario: Pedido sin cobros — pendiente", () => {
    expect(paymentStatus(300, 0)).toBe("pending");
  });

  it("Scenario: Pedido con anticipo — parcial", () => {
    expect(paymentStatus(300, 100)).toBe("partial");
  });

  it("Scenario: Pedido saldado — pagado", () => {
    expect(paymentStatus(300, 300)).toBe("paid");
  });

  it("Scenario: Pedido de total cero — pagado, no pendiente", () => {
    // No está pendiente de cobro quien no debe nada. Es el caso que más fácil
    // se resuelve mal, porque `paid` también es cero.
    expect(paymentStatus(0, 0)).toBe("paid");
  });

  it("Scenario: Sobrepago confirmado — sobrepagado", () => {
    expect(paymentStatus(200, 250)).toBe("overpaid");
  });
});

describe("overpayment", () => {
  it("mide el excedente sobre el saldo pendiente", () => {
    // Scenario: Advertencia antes de confirmar — 250 sobre un saldo de 200.
    expect(overpayment(200, 250)).toBe(50);
  });

  it("es cero cuando el cobro cabe en el saldo", () => {
    expect(overpayment(200, 200)).toBe(0);
    expect(overpayment(200, 120)).toBe(0);
  });

  it("un saldo ya negativo hace excedente de todo el cobro", () => {
    expect(overpayment(-50, 30)).toBe(80);
  });
});

describe("decimales", () => {
  // Los casos que delatan un redondeo de coma flotante. Sin `cents()`,
  // 0.30 − 0.10 − 0.20 devuelve −2.7755575615628914e-17 y el estado sale
  // `overpaid` en un pedido perfectamente saldado.
  it("un pedido saldado en dos cobros con decimales queda pagado", () => {
    expect(balance(0.3, 0.1 + 0.2)).toBe(0);
    expect(paymentStatus(0.3, 0.1 + 0.2)).toBe("paid");
  });

  it("los centavos se muestran exactos", () => {
    expect(balance(115.35, 40.1)).toBe(75.25);
    expect(balance(0.07, 0.01 + 0.02)).toBe(0.04);
  });

  it("un anticipo con decimales sigue siendo parcial", () => {
    expect(paymentStatus(99.99, 0.01)).toBe("partial");
  });
});
