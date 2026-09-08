import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { MemoryMailer } from "@/lib/email/port";
import { DEFAULT_PREFERENCES } from "@/lib/notifications/defaults";
import { planScheduled } from "@/lib/notifications/plan";
import type { PlannedNotification } from "@/lib/notifications/types";
import { NotificationGenerator } from "@/services/notifications/generator";

import { GEEKO } from "./fair-support";
import {
  adminClient,
  countNotifications,
  userIdByEmail,
} from "./notifications-support";

/**
 * KAM-17 · La generación de avisos, contra la base real.
 *
 * Escenarios del delta spec `notifications` — requisitos "Ningún hecho genera
 * dos avisos" («Reejecución sin duplicados»), "La generación privilegiada se
 * limita al trabajo programado y a la creación de avisos" («Cada aviso a su
 * organización») y "La bitácora nunca genera notificaciones" («Actividad
 * intensa, bandeja tranquila»).
 *
 * Lo que esto añade sobre las pruebas unitarias de `plan()` es el paso que
 * aquellas no pueden cubrir: que la **unicidad de la llave** exista de verdad
 * en la base y que el `on conflict do nothing` la use.
 *
 * No hay limpieza —el esquema no permite borrar—, así que todo se mide en
 * deltas y cada prueba usa llaves propias.
 */

let admin: SupabaseClient;
let generator: NotificationGenerator;
let mailer: MemoryMailer;
let ana: string;

/** Llaves propias de esta corrida: dos ejecuciones no deben pisarse. */
const RUN = Date.now();

function planned(overrides: Partial<PlannedNotification> = {}): PlannedNotification {
  return {
    organizationId: GEEKO.organizationId,
    userId: ana,
    type: "task_overdue",
    title: "Se venció «Set de 6 tazas»",
    body: null,
    entityType: "task",
    entityId: null,
    dedupeKey: `it:${RUN}:overdue`,
    ...overrides,
  };
}

beforeAll(async () => {
  admin = adminClient();
  mailer = new MemoryMailer();
  generator = new NotificationGenerator(admin, mailer, "https://kamay.test");
  ana = await userIdByEmail(admin, GEEKO.owner.email);
});

describe("generación de avisos", () => {
  it("escribe el aviso decidido", async () => {
    const before = await countNotifications(admin, { userId: ana });

    const created = await generator.emit([
      planned({ dedupeKey: `it:${RUN}:basico` }),
    ]);

    expect(created).toHaveLength(1);
    expect(await countNotifications(admin, { userId: ana })).toBe(before + 1);
  });

  // Scenario: Reejecución sin duplicados
  it("reejecutar sobre los mismos datos no duplica nada", async () => {
    const key = `it:${RUN}:idempotente`;

    await generator.emit([planned({ dedupeKey: key })]);
    const after1 = await countNotifications(admin, { userId: ana });

    // La segunda pasada: mismos datos, misma llave.
    const created2 = await generator.emit([planned({ dedupeKey: key })]);
    const after2 = await countNotifications(admin, { userId: ana });

    expect(created2).toHaveLength(0);
    expect(after2).toBe(after1);
  });

  it("una tarea tres días vencida sigue teniendo un solo aviso", async () => {
    // La llave lleva la fecha límite, no el día de la pasada: correr el
    // trabajo tres días seguidos no produce tres avisos.
    const key = `it:${RUN}:vencida:2026-09-01`;
    const before = await countNotifications(admin, { userId: ana });

    // Tres pasadas del trabajo, como tres días seguidos de cron.
    await generator.emit([planned({ dedupeKey: key })]);
    await generator.emit([planned({ dedupeKey: key })]);
    await generator.emit([planned({ dedupeKey: key })]);

    expect(await countNotifications(admin, { userId: ana })).toBe(before + 1);
  });

  it("reprogramar la tarea sí vuelve a avisar", async () => {
    const before = await countNotifications(admin, { userId: ana });

    await generator.emit([planned({ dedupeKey: `it:${RUN}:d1:2026-09-01` })]);
    await generator.emit([planned({ dedupeKey: `it:${RUN}:d1:2026-09-15` })]);

    expect(await countNotifications(admin, { userId: ana })).toBe(before + 2);
  });

  // Scenario: Cada aviso a su organización
  it("cada aviso queda con la organización de su destinatario", async () => {
    await generator.emit([
      planned({ dedupeKey: `it:${RUN}:org` }),
    ]);

    const { data } = await admin
      .from("notifications")
      .select("organization_id, user_id")
      .eq("dedupe_key", `it:${RUN}:org`)
      .single();

    expect(data?.organization_id).toBe(GEEKO.organizationId);
    expect(data?.user_id).toBe(ana);
  });
});

describe("el trabajo programado sobre datos reales", () => {
  it("agrupa el resumen del día en un solo aviso", async () => {
    // Escenario «Cinco tareas, un aviso», recorriendo `planScheduled` con los
    // datos tal como los lee el manejador de ruta.
    const tasks = [1, 2, 3, 4, 5].map((n) => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      organizationId: GEEKO.organizationId,
      title: `Tarea ${n}`,
      dueDate: "2026-09-08",
      assigneeId: ana,
      statusKind: "initial" as const,
      statusSince: null,
      closed: false,
    }));

    const plan = planScheduled({
      organizationId: GEEKO.organizationId,
      today: "2026-09-08",
      localHour: DEFAULT_PREFERENCES.dailySummaryHour,
      tasks,
      members: [{ userId: ana, preferences: { ...DEFAULT_PREFERENCES } }],
    });

    const summaries = plan.filter((n) => n.type === "due_summary");
    expect(summaries).toHaveLength(1);

    const before = await countNotifications(admin, {
      userId: ana,
      type: "due_summary",
    });
    await generator.emit(
      summaries.map((n) => ({ ...n, dedupeKey: `it:${RUN}:${n.dedupeKey}` })),
    );

    expect(
      await countNotifications(admin, { userId: ana, type: "due_summary" }),
    ).toBe(before + 1);
  });
});

// Scenario: Actividad intensa, bandeja tranquila
describe("la bitácora no genera notificaciones", () => {
  it("decenas de eventos de bitácora no crean ni un aviso", async () => {
    const before = await countNotifications(admin, {
      organizationId: GEEKO.organizationId,
    });

    // Se provoca actividad real: cada `update` sobre una tabla auditada
    // dispara `log_activity()`. Veinte de golpe, de dos tablas distintas.
    for (let i = 0; i < 20; i++) {
      await admin
        .from("business_lines")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", i % 2 === 0 ? GEEKO.alfareria : GEEKO.sublimacion);
    }

    const { count: logged } = await admin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", GEEKO.organizationId);

    // La bitácora sí registró; la bandeja no se movió.
    expect(logged ?? 0).toBeGreaterThan(0);
    expect(
      await countNotifications(admin, {
        organizationId: GEEKO.organizationId,
      }),
    ).toBe(before);
  });
});

describe("el correo acompaña al aviso, no lo sustituye", () => {
  // Scenario: El correo falla, el aviso queda — su versión de integración es
  // que sin transporte configurado el aviso se escribe igual.
  it("sin transporte de correo el aviso se escribe de todos modos", async () => {
    const sinCorreo = new NotificationGenerator(admin, null, "https://kamay.test");
    const before = await countNotifications(admin, { userId: ana });

    await sinCorreo.emit([planned({ dedupeKey: `it:${RUN}:sincorreo` })]);

    expect(await countNotifications(admin, { userId: ana })).toBe(before + 1);
  });

  // Scenario: Correo apagado, aviso presente
  it("con el correo apagado el aviso llega y el correo no", async () => {
    const enviadosAntes = mailer.sent.length;
    const before = await countNotifications(admin, { userId: ana });

    await generator.emit([planned({ dedupeKey: `it:${RUN}:apagado` })], {
      recipients: new Map([[ana, GEEKO.owner.email]]),
      emailEnabled: new Map([[ana, false]]),
    });

    expect(await countNotifications(admin, { userId: ana })).toBe(before + 1);
    expect(mailer.sent).toHaveLength(enviadosAntes);
  });
});
