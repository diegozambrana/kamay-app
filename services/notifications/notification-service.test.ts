import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { NotificationService, groupByType } from "./notification-service";

const ORG = "11111111-1111-4111-8111-111111111111";
const ANA = "44444444-4444-4444-8444-444444444444";

function row(overrides: Record<string, unknown> = {}) {
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

describe("NotificationService", () => {
  it("lee la bandeja y la traduce", async () => {
    const client = new FakeClient([{ data: [row()], error: null }]);

    const notifications = await new NotificationService(
      client.asSupabase(),
    ).list(ORG);

    expect(notifications[0].title).toBe("Te asignaron «Set de 6 tazas»");
    expect(notifications[0].entityId).toBe("t1");
    expect(notifications[0].readAt).toBeNull();
  });

  it("filtra la organización explícitamente aunque la RLS ya lo haga", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new NotificationService(client.asSupabase()).list(ORG);

    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("pide lo más reciente primero", async () => {
    const client = new FakeClient([{ data: [], error: null }]);

    await new NotificationService(client.asSupabase()).list(ORG);

    expect(client.queries[0].argsOf("order")).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("cuenta solo las no leídas", async () => {
    const client = new FakeClient([{ data: null, error: null, count: 3 }]);

    const count = await new NotificationService(
      client.asSupabase(),
    ).unreadCount(ORG);

    expect(count).toBe(3);
    expect(client.queries[0].has("is", "read_at", null)).toBe(true);
  });

  it("sin nada sin leer devuelve cero, no null", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    expect(
      await new NotificationService(client.asSupabase()).unreadCount(ORG),
    ).toBe(0);
  });

  it("marcar leída escribe read_at sobre esa fila", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new NotificationService(client.asSupabase()).markRead(ORG, "n1");

    const [payload] = client.queries[0].argsOf("update") as [
      { read_at: string },
    ];
    expect(payload.read_at).toBeTruthy();
    expect(client.queries[0].has("eq", "id", "n1")).toBe(true);
  });

  it("marcar todas solo toca las que siguen sin leer", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new NotificationService(client.asSupabase()).markAllRead(ORG);

    expect(client.queries[0].has("is", "read_at", null)).toBe(true);
  });

  it("crear usa on conflict do nothing sobre la llave de idempotencia", async () => {
    // Es lo que hace reejecutable el trabajo programado: sin leer antes de
    // escribir, y por tanto sin ventana entre dos pasadas simultáneas.
    const client = new FakeClient([{ data: [row()], error: null }]);

    await new NotificationService(client.asSupabase()).createMany([
      {
        organizationId: ORG,
        userId: ANA,
        type: "task_assigned",
        title: "Te asignaron «Set de 6 tazas»",
        body: null,
        entityType: "task",
        entityId: "t1",
        dedupeKey: "task_assigned:t1:ana",
      },
    ]);

    const [rows, options] = client.queries[0].argsOf("upsert") as [
      Array<{ dedupe_key: string }>,
      { onConflict: string; ignoreDuplicates: boolean },
    ];
    expect(rows[0].dedupe_key).toBe("task_assigned:t1:ana");
    expect(options).toEqual({
      onConflict: "user_id,dedupe_key",
      ignoreDuplicates: true,
    });
  });

  it("crear sin nada que crear no toca la base", async () => {
    const client = new FakeClient([]);

    expect(
      await new NotificationService(client.asSupabase()).createMany([]),
    ).toEqual([]);
    expect(client.queries).toHaveLength(0);
  });

  it("devuelve solo lo realmente creado, no lo que ya existía", async () => {
    // Lo que impide que una reejecución reenvíe correos.
    const client = new FakeClient([{ data: [], error: null }]);

    const created = await new NotificationService(
      client.asSupabase(),
    ).createMany([
      {
        organizationId: ORG,
        userId: ANA,
        type: "task_overdue",
        title: "Se venció",
        body: null,
        entityType: "task",
        entityId: "t1",
        dedupeKey: "task_overdue:t1:2026-09-01",
      },
    ]);

    expect(created).toEqual([]);
  });

  it("un error de la base se propaga con un mensaje comprensible", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "conexión perdida" } },
    ]);

    await expect(
      new NotificationService(client.asSupabase()).list(ORG),
    ).rejects.toThrow(/No se pudieron cargar los avisos/);
  });
});

describe("groupByType", () => {
  it("agrupa por tipo en el orden del catálogo", async () => {
    const groups = groupByType([
      { ...toDomain(row({ id: "n1", type: "task_assigned" })) },
      { ...toDomain(row({ id: "n2", type: "due_summary" })) },
      { ...toDomain(row({ id: "n3", type: "task_assigned" })) },
    ]);

    expect(groups.map((group) => group.type)).toEqual([
      "due_summary",
      "task_assigned",
    ]);
    expect(groups[1].notifications).toHaveLength(2);
  });

  it("no deja grupos vacíos: un encabezado sin contenido sería un hueco", () => {
    const groups = groupByType([toDomain(row({ type: "due_summary" }))]);

    expect(groups).toHaveLength(1);
  });

  it("una bandeja vacía no produce ningún grupo", () => {
    expect(groupByType([])).toEqual([]);
  });

  it("conserva el orden cronológico dentro de cada grupo", () => {
    const groups = groupByType([
      toDomain(row({ id: "n1", created_at: "2026-09-08T12:00:00Z" })),
      toDomain(row({ id: "n2", created_at: "2026-09-08T09:00:00Z" })),
    ]);

    expect(groups[0].notifications.map((n) => n.id)).toEqual(["n1", "n2"]);
  });
});

/** La traducción que hace el servicio, para poder probar `groupByType` sola. */
function toDomain(r: ReturnType<typeof row>) {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    userId: r.user_id as string,
    type: r.type as "due_summary" | "task_assigned",
    title: r.title as string,
    body: r.body as string | null,
    entityType: r.entity_type as string | null,
    entityId: r.entity_id as string | null,
    readAt: r.read_at as string | null,
    createdAt: r.created_at as string,
  };
}
