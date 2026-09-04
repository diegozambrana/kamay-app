import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_ATTEMPTS } from "./backoff";
import { drainOutbox, resetDrainLock } from "./drain";
import type { OutboxDatabase } from "./db";
import { enqueue, listEntries } from "./queue";
import type { OfflineOperation } from "./registry";
import { SESSION, freshOutbox } from "./test-support";

/**
 * Escenarios de `offline-capture`:
 * - "El envío es secuencial y nunca envía un hijo antes que su padre" → los tres.
 * - "Reenviar un registro nunca crea un segundo" → «Dos reintentos, un solo
 *   registro», «La respuesta se pierde después de escribir».
 * - "La cola pertenece a una organización y a una sesión" → los tres.
 */

let db: OutboxDatabase;

beforeEach(() => {
  resetDrainLock();
  db = freshOutbox();
});

afterEach(async () => {
  await db.close();
});

function entrada(recordId: string, extra: Record<string, unknown> = {}) {
  return {
    recordId,
    operation: "order.create",
    payload: { id: recordId },
    organizationId: SESSION.organizationId,
    userId: SESSION.userId,
    ...extra,
  };
}

/** Una operación que anota lo que le llega, en el orden en que le llega. */
function espia(send: OfflineOperation["send"]) {
  const enviados: string[] = [];
  const operation: OfflineOperation = {
    send: async (payload) => {
      enviados.push((payload as { id: string }).id);
      return send(payload);
    },
    describe: () => "registro",
  };
  return { enviados, resolveOperation: () => operation };
}

describe("orden de envío", () => {
  // Escenario: «Padre antes que hijo al reconectar».
  it("envía en orden de encolado: el padre antes que el hijo", async () => {
    await enqueue(entrada("padre"), db);
    await enqueue(entrada("hijo", { dependsOn: ["padre"] }), db);

    const { enviados, resolveOperation } = espia(async () => undefined);
    await drainOutbox({ session: SESSION, db, resolveOperation });

    expect(enviados).toEqual(["padre", "hijo"]);
    expect(await listEntries(db)).toHaveLength(0);
  });

  // Escenario: «El hijo de un registro muerto no se envía».
  it("retiene al hijo cuando el padre falló de forma definitiva", async () => {
    await enqueue(entrada("padre"), db);
    await enqueue(entrada("hijo", { dependsOn: ["padre"] }), db);

    const { enviados, resolveOperation } = espia(async (payload) =>
      (payload as { id: string }).id === "padre"
        ? { error: "No tienes permiso para esto." }
        : undefined,
    );
    await drainOutbox({ session: SESSION, db, resolveOperation });

    expect(enviados).toEqual(["padre"]);

    const entries = await listEntries(db);
    expect(entries.map((entry) => [entry.recordId, entry.state])).toEqual([
      ["padre", "failed"],
      ["hijo", "pending"],
    ]);
  });

  // Escenario: «Un fallo transitorio no reordena la cola».
  it("se detiene ante un fallo de red en vez de dejar pasar a la siguiente", async () => {
    await enqueue(entrada("primera"), db);
    await enqueue(entrada("segunda"), db);

    const { enviados, resolveOperation } = espia(async (payload) => {
      if ((payload as { id: string }).id === "primera") {
        throw new TypeError("Failed to fetch");
      }
      return undefined;
    });
    await drainOutbox({ session: SESSION, db, resolveOperation });

    expect(enviados).toEqual(["primera"]);
    expect((await listEntries(db)).map((entry) => entry.recordId)).toEqual([
      "primera",
      "segunda",
    ]);
  });

  it("un rechazo definitivo no bloquea a las entradas que no dependen de él", async () => {
    await enqueue(entrada("rechazada"), db);
    await enqueue(entrada("independiente"), db);

    const { enviados, resolveOperation } = espia(async (payload) =>
      (payload as { id: string }).id === "rechazada"
        ? { error: "Elige o crea un cliente" }
        : undefined,
    );
    await drainOutbox({ session: SESSION, db, resolveOperation });

    expect(enviados).toEqual(["rechazada", "independiente"]);
    expect((await listEntries(db)).map((entry) => entry.recordId)).toEqual(["rechazada"]);
  });
});

describe("deduplicación y reintentos", () => {
  // Escenario: «Dos reintentos, un solo registro». El identificador no cambia
  // entre intentos: es lo que permite a la base ignorar el segundo envío.
  it("conserva el identificador del registro en todos los reintentos", async () => {
    await enqueue(entrada("a"), db);

    let intentos = 0;
    const { enviados, resolveOperation } = espia(async () => {
      intentos += 1;
      if (intentos < 3) throw new TypeError("Failed to fetch");
      return undefined;
    });

    // Cada vaciado se detiene tras el fallo transitorio; `now` avanza para
    // que la espera creciente ya haya vencido en la vuelta siguiente.
    const now = vi.fn(() => 0);
    await drainOutbox({ session: SESSION, db, resolveOperation, now });
    resetDrainLock();
    now.mockReturnValue(60_000);
    await drainOutbox({ session: SESSION, db, resolveOperation, now });
    resetDrainLock();
    now.mockReturnValue(600_000);
    await drainOutbox({ session: SESSION, db, resolveOperation, now });

    expect(enviados).toEqual(["a", "a", "a"]);
    expect(await listEntries(db)).toHaveLength(0);
  });

  // Escenario: «La respuesta se pierde después de escribir». El servidor
  // guardó y la respuesta no llegó; el reenvío resuelve bien —la base lo
  // ignora por idempotencia— y la entrada se da por completada.
  it("da por completada la entrada cuando el reenvío resuelve bien", async () => {
    await enqueue(entrada("a"), db);

    let primera = true;
    const { resolveOperation } = espia(async () => {
      if (primera) {
        primera = false;
        throw new TypeError("Failed to fetch");
      }
      return { orderId: "a", code: 142 };
    });

    await drainOutbox({ session: SESSION, db, resolveOperation, now: () => 0 });
    resetDrainLock();
    const outcomes = await drainOutbox({
      session: SESSION,
      db,
      resolveOperation,
      now: () => 600_000,
    });

    expect([...outcomes.values()]).toEqual([
      { kind: "ok", result: { orderId: "a", code: 142 } },
    ]);
    expect(await listEntries(db)).toHaveLength(0);
  });

  it("convierte el fallo transitorio en definitivo al agotar los intentos", async () => {
    const seq = await enqueue(entrada("a"), db);
    await db.outbox.update(seq, { attempts: MAX_ATTEMPTS - 1 });

    const { resolveOperation } = espia(async () => {
      throw new TypeError("Failed to fetch");
    });
    await drainOutbox({ session: SESSION, db, resolveOperation, now: () => 0 });

    const [entry] = await listEntries(db);
    expect(entry.state).toBe("failed");
    expect(entry.attempts).toBe(MAX_ATTEMPTS);
  });

  it("no vuelve a intentar antes de que venza su espera", async () => {
    await enqueue(entrada("a"), db);

    const { enviados, resolveOperation } = espia(async () => {
      throw new TypeError("Failed to fetch");
    });
    await drainOutbox({ session: SESSION, db, resolveOperation, now: () => 0 });
    resetDrainLock();
    await drainOutbox({ session: SESSION, db, resolveOperation, now: () => 1 });

    expect(enviados).toEqual(["a"]);
  });
});

describe("aislamiento por organización y por persona", () => {
  // Escenario: «Cambiar de organización no reencamina lo pendiente».
  it("no envía un registro de otra organización bajo la organización activa", async () => {
    await enqueue({ ...entrada("a"), organizationId: "org-b" }, db);

    const { enviados, resolveOperation } = espia(async () => undefined);
    await drainOutbox({ session: SESSION, db, resolveOperation });

    expect(enviados).toEqual([]);
    expect(await listEntries(db)).toHaveLength(1);
  });

  it("lo envía en cuanto se vuelve a la organización en que se creó", async () => {
    await enqueue({ ...entrada("a"), organizationId: "org-b" }, db);

    const { enviados, resolveOperation } = espia(async () => undefined);
    await drainOutbox({
      session: { organizationId: "org-b", userId: "user-a" },
      db,
      resolveOperation,
    });

    expect(enviados).toEqual(["a"]);
  });

  // Escenario: «Otra persona en el mismo dispositivo».
  it("no envía bajo la sesión de otra persona", async () => {
    await enqueue({ ...entrada("a"), userId: "user-b" }, db);

    const { enviados, resolveOperation } = espia(async () => undefined);
    await drainOutbox({ session: SESSION, db, resolveOperation });

    expect(enviados).toEqual([]);
  });

  // Escenario: «Cerrar sesión conserva lo pendiente».
  it("sin sesión no envía nada y no pierde nada", async () => {
    await enqueue(entrada("a"), db);

    const { enviados, resolveOperation } = espia(async () => undefined);
    await drainOutbox({ session: null, db, resolveOperation });

    expect(enviados).toEqual([]);
    expect(await listEntries(db)).toHaveLength(1);
  });
});

describe("el candado del vaciado", () => {
  it("dos disparos simultáneos no envían la misma entrada dos veces", async () => {
    await enqueue(entrada("a"), db);

    const { enviados, resolveOperation } = espia(
      async () => new Promise((resolve) => setTimeout(() => resolve(undefined), 5)),
    );

    await Promise.all([
      drainOutbox({ session: SESSION, db, resolveOperation }),
      drainOutbox({ session: SESSION, db, resolveOperation }),
    ]);

    expect(enviados).toEqual(["a"]);
  });
});

describe("operación desconocida", () => {
  // Escenario: «Nada se pierde en silencio». Una entrada de otra versión no
  // se envía mal interpretada ni se descarta: acaba en la bandeja.
  it("falla de forma definitiva y la entrada sigue existiendo", async () => {
    await enqueue({ ...entrada("a"), operation: "order.create.v0" }, db);

    await drainOutbox({ session: SESSION, db, resolveOperation: () => undefined });

    const [entry] = await listEntries(db);
    expect(entry.state).toBe("failed");
    expect(entry.lastError).toContain("versión anterior");
  });
});
