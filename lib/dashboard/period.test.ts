import { describe, expect, it } from "vitest";

import {
  monthLabel,
  monthStartInTimezone,
  UPCOMING_DAYS,
  upcomingWindow,
} from "@/lib/dashboard/period";

const LA_PAZ = "America/La_Paz"; // UTC−4, sin horario de verano.

describe("monthStartInTimezone", () => {
  it("devuelve el primer día del mes en curso", () => {
    const now = new Date("2026-02-14T16:00:00Z");
    expect(monthStartInTimezone(LA_PAZ, now)).toBe("2026-02-01");
  });

  // Scenario: Manda la fecha del movimiento, no la del pedido — el límite de
  // mes se corta en la zona del taller, que es donde ocurrió el movimiento.
  it("el último día del mes a las 22:00 en La Paz sigue siendo ese mes", () => {
    // 2026-03-01T02:00Z es 2026-02-28T22:00 en La Paz.
    const now = new Date("2026-03-01T02:00:00Z");

    expect(monthStartInTimezone(LA_PAZ, now)).toBe("2026-02-01");
    // Con la zona del servidor, el mismo instante caería en marzo: es
    // exactamente el error que esta función existe para no cometer.
    expect(monthStartInTimezone("UTC", now)).toBe("2026-03-01");
  });

  it("una zona al este puede estar ya en el mes siguiente", () => {
    // 2026-02-28T16:00Z es 2026-03-01T01:00 en Tokio (UTC+9) y todavía
    // 2026-02-28T12:00 en La Paz: el mismo instante, dos meses distintos.
    const now = new Date("2026-02-28T16:00:00Z");

    expect(monthStartInTimezone("Asia/Tokyo", now)).toBe("2026-03-01");
    expect(monthStartInTimezone(LA_PAZ, now)).toBe("2026-02-01");
  });

  it("una zona horaria inválida no tumba el panel: se cae a UTC", () => {
    const now = new Date("2026-02-14T16:00:00Z");
    expect(monthStartInTimezone("Marte/Olympus", now)).toBe("2026-02-01");
  });
});

describe("monthLabel", () => {
  it("nombra el mes y el año en español", () => {
    expect(monthLabel("2026-02-01")).toContain("2026");
    expect(monthLabel("2026-02-01").toLowerCase()).toContain("febrero");
  });

  it("no se corre al mes anterior por la hora de construcción de la fecha", () => {
    expect(monthLabel("2026-03-01").toLowerCase()).toContain("marzo");
    expect(monthLabel("2026-01-01").toLowerCase()).toContain("enero");
  });

  it("un mes ilegible se muestra tal cual en vez de romper la pantalla", () => {
    expect(monthLabel("no-es-un-mes")).toBe("no-es-un-mes");
  });
});

describe("upcomingWindow", () => {
  it("abre en el hoy de la organización y cierra siete días después", () => {
    const now = new Date("2026-02-14T16:00:00Z");
    const { today, horizon } = upcomingWindow(LA_PAZ, now);

    expect(today).toBe("2026-02-14");
    expect(horizon).toBe("2026-02-21");
    expect(UPCOMING_DAYS).toBe(7);
  });

  it("cruza el cambio de mes sin saltarse días", () => {
    const now = new Date("2026-02-25T16:00:00Z");
    expect(upcomingWindow(LA_PAZ, now).horizon).toBe("2026-03-04");
  });

  it("cruza el cambio de año", () => {
    const now = new Date("2026-12-30T16:00:00Z");
    const { today, horizon } = upcomingWindow(LA_PAZ, now);

    expect(today).toBe("2026-12-30");
    expect(horizon).toBe("2027-01-06");
  });

  it("usa el hoy del taller y no el del servidor", () => {
    // 2026-02-15T02:00Z es todavía el 14 en La Paz.
    const now = new Date("2026-02-15T02:00:00Z");
    expect(upcomingWindow(LA_PAZ, now).today).toBe("2026-02-14");
  });
});
