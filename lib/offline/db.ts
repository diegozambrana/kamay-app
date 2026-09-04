import Dexie, { type EntityTable } from "dexie";

import type { OutboxEntry } from "./types";

/**
 * Versión del formato de una entrada de la cola.
 *
 * Una entrada encolada por una versión anterior de la aplicación puede
 * sobrevivir a un despliegue. Si su formato ya no es el que este código espera,
 * se **retiene y se muestra**, nunca se envía mal interpretada (design.md —
 * Risks, «la cola es un formato de datos con vida propia entre despliegues»).
 */
export const OUTBOX_SCHEMA_VERSION = 1;

export const OUTBOX_DB_NAME = "kamay-outbox";

/**
 * `++seq` es la llave: autoincremental y, por tanto, el orden de encolado. El
 * `recordId` **no** es único —un mismo pedido puede tener encolada su alta y
 * luego su edición— así que se indexa sin restricción.
 */
export type OutboxDatabase = Dexie & {
  outbox: EntityTable<OutboxEntry, "seq">;
};

export function createOutboxDatabase(name: string = OUTBOX_DB_NAME): OutboxDatabase {
  const db = new Dexie(name) as OutboxDatabase;

  db.version(1).stores({
    outbox: "++seq, recordId, state, operation, nextAttemptAt, *dependsOn",
  });

  return db;
}

let singleton: OutboxDatabase | null = null;

/** La base del navegador. Una sola por origen, creada al primer uso. */
export function outboxDatabase(): OutboxDatabase {
  singleton ??= createOutboxDatabase();
  return singleton;
}
