import { afterEach, describe, expect, it } from "vitest";

import { OUTBOX_SCHEMA_VERSION, createOutboxDatabase, type OutboxDatabase } from "./db";
import { discardEntry, enqueue, listEntries, retryEntry } from "./queue";
import { SESSION, freshOutbox } from "./test-support";

/**
 * Escenarios de `offline-capture`:
 * - "La cola sobrevive al cierre de la aplicación" → «Cerrar y reabrir con
 *   registros pendientes», «Recargar la página no vacía la cola».
 * - "La cola pertenece a una organización y a una sesión" → lo que se graba
 *   al encolar.
 */

let db: OutboxDatabase;

afterEach(async () => {
  await db?.close();
});

function pedido(recordId: string, extra: Partial<{ dependsOn: string[] }> = {}) {
  return {
    recordId,
    operation: "order.create",
    payload: { id: recordId, occurredAt: "2026-09-03T15:40:00.000Z" },
    organizationId: SESSION.organizationId,
    userId: SESSION.userId,
    ...extra,
  };
}

describe("enqueue", () => {
  it("graba la organización, la persona y la hora del encolado", async () => {
    db = freshOutbox();

    await enqueue(pedido("a"), db, () => new Date("2026-09-03T15:40:00.000Z"));

    const [entry] = await listEntries(db);
    expect(entry.organizationId).toBe("org-a");
    expect(entry.userId).toBe("user-a");
    expect(entry.enqueuedAt).toBe("2026-09-03T15:40:00.000Z");
    expect(entry.state).toBe("pending");
    expect(entry.attempts).toBe(0);
    expect(entry.schemaVersion).toBe(OUTBOX_SCHEMA_VERSION);
  });

  it("numera las entradas en orden de encolado", async () => {
    db = freshOutbox();

    const primera = await enqueue(pedido("a"), db);
    const segunda = await enqueue(pedido("b"), db);

    expect(segunda).toBeGreaterThan(primera);
    expect((await listEntries(db)).map((entry) => entry.recordId)).toEqual(["a", "b"]);
  });

  it("admite dos entradas para el mismo registro: alta y luego edición", async () => {
    db = freshOutbox();

    await enqueue(pedido("a"), db);
    await enqueue({ ...pedido("a"), operation: "order.update" }, db);

    expect((await listEntries(db)).map((entry) => entry.operation)).toEqual([
      "order.create",
      "order.update",
    ]);
  });
});

describe("la cola sobrevive al cierre de la aplicación", () => {
  // Escenario: «Cerrar y reabrir con registros pendientes». Cerrar la base y
  // volver a abrirla con el mismo nombre es lo que ocurre al cerrar y reabrir
  // la aplicación instalada.
  it("conserva las entradas al cerrar y volver a abrir la base", async () => {
    const name = `kamay-outbox-durable-${Date.now()}`;
    const primera = createOutboxDatabase(name);

    await enqueue(pedido("a"), primera);
    await enqueue(pedido("b"), primera);
    await primera.close();

    db = createOutboxDatabase(name);
    const entries = await listEntries(db);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.recordId)).toEqual(["a", "b"]);
    expect(entries[0].payload).toEqual({
      id: "a",
      occurredAt: "2026-09-03T15:40:00.000Z",
    });
  });

  // Escenario: «Recargar la página no vacía la cola». Una recarga vuelve a
  // abrir la base sin cerrarla antes; no puede duplicar ni perder nada.
  it("no duplica ni pierde entradas al reabrir sin cerrar", async () => {
    const name = `kamay-outbox-reload-${Date.now()}`;
    const primera = createOutboxDatabase(name);
    await enqueue(pedido("a"), primera);

    db = createOutboxDatabase(name);
    const entries = await listEntries(db);

    expect(entries).toHaveLength(1);
    await primera.close();
  });
});

describe("reintentar y descartar", () => {
  it("reintentar devuelve la entrada a la cola con su contenido original", async () => {
    db = freshOutbox();
    const seq = await enqueue(pedido("a"), db);
    await db.outbox.update(seq, { state: "failed", attempts: 3, lastError: "algo" });

    await retryEntry(seq, db);

    const [entry] = await listEntries(db);
    expect(entry.state).toBe("pending");
    expect(entry.attempts).toBe(0);
    expect(entry.lastError).toBeNull();
    expect(entry.recordId).toBe("a");
    expect(entry.payload).toEqual({ id: "a", occurredAt: "2026-09-03T15:40:00.000Z" });
  });

  it("descartar es la única forma en que una entrada desaparece sin enviarse", async () => {
    db = freshOutbox();
    const seq = await enqueue(pedido("a"), db);

    await discardEntry(seq, db);

    expect(await listEntries(db)).toHaveLength(0);
  });
});
