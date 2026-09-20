import { describe, expect, it } from "vitest";

import { deriveOrderRequestStatus, isOrderRequestExpired } from "./status";

describe("estado de una solicitud de pedido", () => {
  it("esperando al cliente: sin envío, sin pedido, sin archivar", () => {
    expect(
      deriveOrderRequestStatus({ submittedAt: null, orderId: null, archivedAt: null }),
    ).toBe("waiting");
  });

  it("recibida: con envío, sin pedido todavía", () => {
    expect(
      deriveOrderRequestStatus({
        submittedAt: "2026-09-20T10:00:00.000Z",
        orderId: null,
        archivedAt: null,
      }),
    ).toBe("received");
  });

  it("aceptada: con pedido, aunque también tenga envío", () => {
    expect(
      deriveOrderRequestStatus({
        submittedAt: "2026-09-20T10:00:00.000Z",
        orderId: "11111111-1111-1111-1111-111111111111",
        archivedAt: null,
      }),
    ).toBe("accepted");
  });

  it("descartada: archivada manda sobre cualquier otra marca", () => {
    expect(
      deriveOrderRequestStatus({
        submittedAt: "2026-09-20T10:00:00.000Z",
        orderId: "11111111-1111-1111-1111-111111111111",
        archivedAt: "2026-09-21T10:00:00.000Z",
      }),
    ).toBe("discarded");

    expect(
      deriveOrderRequestStatus({
        submittedAt: null,
        orderId: null,
        archivedAt: "2026-09-21T10:00:00.000Z",
      }),
    ).toBe("discarded");
  });
});

describe("vencimiento de una solicitud", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  it("no venció: expira en el futuro", () => {
    expect(isOrderRequestExpired("2026-09-27T12:00:00.000Z", now)).toBe(false);
  });

  it("venció justo ahora", () => {
    expect(isOrderRequestExpired("2026-09-20T12:00:00.000Z", now)).toBe(true);
  });

  it("venció hace tiempo", () => {
    expect(isOrderRequestExpired("2026-09-01T00:00:00.000Z", now)).toBe(true);
  });
});
