import { describe, expect, it } from "vitest";

import { FailingMailer, MemoryMailer } from "@/lib/email/port";
import type { PlannedNotification } from "@/lib/notifications/types";
import { FakeClient } from "@/tests/factories/supabase-fake";

import { NotificationGenerator } from "./generator";

const ORG = "11111111-1111-4111-8111-111111111111";
const ANA = "44444444-4444-4444-8444-444444444444";
const APP = "https://kamay.app";

function planned(
  overrides: Partial<PlannedNotification> = {},
): PlannedNotification {
  return {
    organizationId: ORG,
    userId: ANA,
    type: "task_assigned",
    title: "Te asignaron «Set de 6 tazas»",
    body: null,
    entityType: "task",
    entityId: "t1",
    dedupeKey: "task_assigned:t1:ana",
    ...overrides,
  };
}

function createdRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    organization_id: ORG,
    user_id: ANA,
    type: "task_assigned",
    title: "Te asignaron «Set de 6 tazas»",
    body: null,
    entity_type: "task",
    entity_id: "t1",
    read_at: null,
    created_at: "2026-09-08T10:00:00Z",
    ...overrides,
  };
}

describe("NotificationGenerator", () => {
  it("escribe el aviso y envía su correo", async () => {
    const client = new FakeClient([{ data: [createdRow()], error: null }]);
    const mailer = new MemoryMailer();

    await new NotificationGenerator(client.asSupabase(), mailer, APP).emit(
      [planned()],
      { recipients: new Map([[ANA, "ana@taller.test"]]) },
    );

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("ana@taller.test");
    expect(mailer.sent[0].text).toContain("https://kamay.app/tasks/t1");
  });

  it("un fallo del correo no impide que el aviso exista", async () => {
    // Escenario «El correo falla, el aviso queda». Es una consecuencia del
    // orden de las operaciones —escribir primero, enviar después—, no de un
    // manejo de errores que haya que recordar.
    const client = new FakeClient([{ data: [createdRow()], error: null }]);

    const created = await new NotificationGenerator(
      client.asSupabase(),
      new FailingMailer(),
      APP,
    ).emit([planned()], {
      recipients: new Map([[ANA, "ana@taller.test"]]),
    });

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe("n1");
  });

  it("con el correo apagado el aviso llega igual a la bandeja", async () => {
    // Escenario «Correo apagado, aviso presente».
    const client = new FakeClient([{ data: [createdRow()], error: null }]);
    const mailer = new MemoryMailer();

    const created = await new NotificationGenerator(
      client.asSupabase(),
      mailer,
      APP,
    ).emit([planned()], {
      recipients: new Map([[ANA, "ana@taller.test"]]),
      emailEnabled: new Map([[ANA, false]]),
    });

    expect(created).toHaveLength(1);
    expect(mailer.sent).toHaveLength(0);
  });

  it("los tipos que no viajan por correo no generan envío", async () => {
    // Escenario «Los demás tipos no viajan por correo».
    const client = new FakeClient([
      { data: [createdRow({ type: "task_stalled" })], error: null },
    ]);
    const mailer = new MemoryMailer();

    await new NotificationGenerator(client.asSupabase(), mailer, APP).emit(
      [planned({ type: "task_stalled" })],
      { recipients: new Map([[ANA, "ana@taller.test"]]) },
    );

    expect(mailer.sent).toHaveLength(0);
  });

  it("no se envía correo por lo que ya existía", async () => {
    // El `on conflict do nothing` no devuelve las filas que no creó: por eso
    // reejecutar el trabajo no reenvía nada.
    const client = new FakeClient([{ data: [], error: null }]);
    const mailer = new MemoryMailer();

    await new NotificationGenerator(client.asSupabase(), mailer, APP).emit(
      [planned({ type: "task_overdue" })],
      { recipients: new Map([[ANA, "ana@taller.test"]]) },
    );

    expect(mailer.sent).toHaveLength(0);
  });

  it("sin correo conocido del destinatario, el aviso queda en la bandeja", async () => {
    const client = new FakeClient([{ data: [createdRow()], error: null }]);
    const mailer = new MemoryMailer();

    const created = await new NotificationGenerator(
      client.asSupabase(),
      mailer,
      APP,
    ).emit([planned()], { recipients: new Map() });

    expect(created).toHaveLength(1);
    expect(mailer.sent).toHaveLength(0);
  });

  it("sin nada que emitir no toca la base ni el correo", async () => {
    const client = new FakeClient([]);
    const mailer = new MemoryMailer();

    expect(
      await new NotificationGenerator(client.asSupabase(), mailer, APP).emit([]),
    ).toEqual([]);
    expect(client.queries).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it("sin transporte de correo configurado solo escribe", async () => {
    const client = new FakeClient([{ data: [createdRow()], error: null }]);

    const created = await new NotificationGenerator(
      client.asSupabase(),
      null,
      APP,
    ).emit([planned()], { recipients: new Map([[ANA, "ana@taller.test"]]) });

    expect(created).toHaveLength(1);
  });

  it("cada aviso conserva la organización de su destinatario", async () => {
    // Escenario «Cada aviso a su organización»: ninguno cruza de una a otra,
    // aunque el generador corra sobre varias en la misma pasada.
    const client = new FakeClient([{ data: [createdRow()], error: null }]);

    await new NotificationGenerator(client.asSupabase(), null, APP).emit([
      planned({ organizationId: "org-a", userId: "u-a", dedupeKey: "k:a" }),
      planned({ organizationId: "org-b", userId: "u-b", dedupeKey: "k:b" }),
    ]);

    const [rows] = client.queries[0].argsOf("upsert") as [
      Array<{ organization_id: string; user_id: string }>,
    ];
    expect(rows).toEqual([
      expect.objectContaining({ organization_id: "org-a", user_id: "u-a" }),
      expect.objectContaining({ organization_id: "org-b", user_id: "u-b" }),
    ]);
  });
});
