import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  DEFAULT_SUMMARY_HOUR,
  resolvePreferences,
} from "./defaults";

/**
 * KAM-17 · Preferencias por omisión.
 *
 * Escenario del delta spec `notifications` — requisito "Preferencias de
 * notificación por persona, con cada tipo apagable": «Sin fila guardada».
 */
describe("resolvePreferences", () => {
  it("sin fila guardada aplica el comportamiento por omisión, todo activo", () => {
    const resolved = resolvePreferences(null);

    expect(resolved).toEqual(DEFAULT_PREFERENCES);
    expect(resolved.due_summary).toBe(true);
    expect(resolved.task_assigned).toBe(true);
    expect(resolved.task_review).toBe(true);
    expect(resolved.task_overdue).toBe(true);
    expect(resolved.task_stalled).toBe(true);
    expect(resolved.stock_below_min).toBe(true);
  });

  it("una fila ausente y una indefinida se tratan igual", () => {
    expect(resolvePreferences(undefined)).toEqual(resolvePreferences(null));
  });

  it("respeta lo que la fila sí declara", () => {
    const resolved = resolvePreferences({
      task_assigned: false,
      daily_summary_hour: 18,
      email_enabled: false,
    });

    expect(resolved.task_assigned).toBe(false);
    expect(resolved.dailySummaryHour).toBe(18);
    expect(resolved.emailEnabled).toBe(false);
  });

  it("un campo nulo de una fila parcial cae a la omisión, no a apagado", () => {
    // Es la diferencia que importa: «no lo he decidido» no es «no lo quiero».
    const resolved = resolvePreferences({
      task_assigned: false,
      task_overdue: null,
    });

    expect(resolved.task_assigned).toBe(false);
    expect(resolved.task_overdue).toBe(true);
  });

  it("una hora corrupta no deja a nadie sin resumen para siempre", () => {
    expect(resolvePreferences({ daily_summary_hour: 24 }).dailySummaryHour).toBe(
      DEFAULT_SUMMARY_HOUR,
    );
    expect(resolvePreferences({ daily_summary_hour: -1 }).dailySummaryHour).toBe(
      DEFAULT_SUMMARY_HOUR,
    );
    expect(
      resolvePreferences({ daily_summary_hour: 7.5 }).dailySummaryHour,
    ).toBe(DEFAULT_SUMMARY_HOUR);
  });

  it("la hora 0 es válida y no se confunde con ausente", () => {
    expect(resolvePreferences({ daily_summary_hour: 0 }).dailySummaryHour).toBe(
      0,
    );
  });

  it("apagar de verdad se distingue de no haber decidido", () => {
    expect(resolvePreferences({ email_enabled: false }).emailEnabled).toBe(
      false,
    );
    expect(resolvePreferences({ email_enabled: null }).emailEnabled).toBe(true);
  });
});
