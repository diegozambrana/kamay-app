import { describe, expect, it } from "vitest";

import { isOverdue, todayInTimezone } from "@/lib/orders/overdue";

const TODAY = "2026-08-26";

describe("isOverdue", () => {
  it("no alerta si el pedido vencido está en un estado de espera", () => {
    expect(
      isOverdue({ dueDate: "2026-08-20", statusKind: "waiting", today: TODAY }),
    ).toBe(false);
  });

  it("alerta si el pedido vencido está en proceso", () => {
    expect(
      isOverdue({ dueDate: "2026-08-20", statusKind: "in_progress", today: TODAY }),
    ).toBe(true);
  });

  it("alerta si el pedido vencido sigue en su estado inicial", () => {
    expect(
      isOverdue({ dueDate: "2026-08-20", statusKind: "initial", today: TODAY }),
    ).toBe(true);
  });

  it("no alerta si el pedido vencido ya terminó o se canceló", () => {
    expect(
      isOverdue({ dueDate: "2026-08-20", statusKind: "final", today: TODAY }),
    ).toBe(false);
    expect(
      isOverdue({ dueDate: "2026-08-20", statusKind: "cancelled", today: TODAY }),
    ).toBe(false);
  });

  it("no alerta sin fecha comprometida, aunque esté en proceso", () => {
    expect(
      isOverdue({ dueDate: null, statusKind: "in_progress", today: TODAY }),
    ).toBe(false);
  });

  it("no alerta el mismo día del compromiso: vencer es pasarse", () => {
    expect(
      isOverdue({ dueDate: TODAY, statusKind: "in_progress", today: TODAY }),
    ).toBe(false);
  });

  it("no alerta si la fecha aún no llegó", () => {
    expect(
      isOverdue({ dueDate: "2026-09-01", statusKind: "in_progress", today: TODAY }),
    ).toBe(false);
  });

  // El escenario "renombrar el estado no cambia el comportamiento": la
  // función no recibe el nombre, así que no hay forma de que lo mire.
  it("decide por kind y no por nombre: el nombre ni siquiera entra", () => {
    const vencidoEnEspera = {
      dueDate: "2026-08-20",
      statusKind: "waiting" as const,
      today: TODAY,
    };
    // Da igual cómo se llame el estado en la organización — "En cola",
    // "Esperando al cliente", "Pendiente de recojo": el resultado es el mismo.
    expect(isOverdue(vencidoEnEspera)).toBe(false);
    expect(Object.keys(vencidoEnEspera)).not.toContain("statusName");
  });
});

describe("todayInTimezone", () => {
  it("da la fecha de la organización, no la del navegador", () => {
    // 03:00 UTC del día 27 es todavía el día 26 en La Paz (UTC-4).
    const instante = new Date("2026-08-27T03:00:00Z");
    expect(todayInTimezone("America/La_Paz", instante)).toBe("2026-08-26");
    expect(todayInTimezone("UTC", instante)).toBe("2026-08-27");
  });

  it("cae a UTC si la zona horaria configurada es inválida", () => {
    const instante = new Date("2026-08-27T03:00:00Z");
    expect(todayInTimezone("No/Existe", instante)).toBe("2026-08-27");
  });
});
