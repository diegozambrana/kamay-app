import { describe, expect, it } from "vitest";

import { hourInTimezone } from "./local-time";

/**
 * KAM-17 · La hora local de la organización.
 *
 * Escenarios del delta spec `notifications` — requisito "El resumen llega a la
 * hora que cada persona eligió, en la hora local de su organización": «La zona
 * horaria manda».
 *
 * Es la pieza que permite que **una sola entrada de cron** sirva a cualquier
 * hora elegida y a cualquier zona (design D4).
 */
describe("hourInTimezone", () => {
  it("traduce a la hora local de la zona pedida", () => {
    // 12:00 UTC son las 08:00 en La Paz (UTC−4).
    const mediodiaUTC = new Date("2026-09-08T12:00:00.000Z");

    expect(hourInTimezone("America/La_Paz", mediodiaUTC)).toBe(8);
    expect(hourInTimezone("UTC", mediodiaUTC)).toBe(12);
  });

  it("dos zonas distintas dan horas distintas para el mismo instante", () => {
    const instante = new Date("2026-09-08T12:00:00.000Z");

    expect(hourInTimezone("America/La_Paz", instante)).not.toBe(
      hourInTimezone("Asia/Tokyo", instante),
    );
  });

  it("la medianoche local es 0, no 24", () => {
    // 04:00 UTC es medianoche en La Paz.
    const medianoche = new Date("2026-09-08T04:00:00.000Z");

    expect(hourInTimezone("America/La_Paz", medianoche)).toBe(0);
  });

  it("cruzar el día no rompe la cuenta", () => {
    // 02:00 UTC del día 8 son las 22:00 del día 7 en La Paz.
    const madrugada = new Date("2026-09-08T02:00:00.000Z");

    expect(hourInTimezone("America/La_Paz", madrugada)).toBe(22);
  });

  it("una zona inválida cae a UTC en vez de tumbar el trabajo", () => {
    // Una configuración corrupta de una organización no puede impedir que el
    // trabajo corra para todas las demás.
    const instante = new Date("2026-09-08T12:00:00.000Z");

    expect(hourInTimezone("Marte/Olympus", instante)).toBe(12);
  });
});
