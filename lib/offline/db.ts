import Dexie, { type EntityTable } from "dexie";

import type { FairSnapshot, OutboxEntry } from "./types";

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
  /**
   * El snapshot del modo feria (KAM-12): una fila por organización y línea.
   * Vive aquí y no en `localStorage` porque es lo mismo que la cola —estado
   * de captura que tiene que sobrevivir a cerrar la aplicación— y partirlo en
   * dos almacenes abre la puerta a que uno sobreviva sin el otro.
   */
  fairSnapshots: EntityTable<FairSnapshot, "id">;
};

export function createOutboxDatabase(name: string = OUTBOX_DB_NAME): OutboxDatabase {
  const db = new Dexie(name) as OutboxDatabase;

  db.version(1).stores({
    outbox: "++seq, recordId, state, operation, nextAttemptAt, *dependsOn",
  });

  // La versión 2 solo **añade** una tabla: las entradas de la cola encoladas
  // por la versión 1 sobreviven intactas a la migración, que es exactamente
  // lo que `OUTBOX_SCHEMA_VERSION` protege. Por eso esa constante no cambia:
  // el formato de una entrada no se ha tocado.
  db.version(2).stores({
    fairSnapshots: "id, organizationId",
  });

  return db;
}

let singleton: OutboxDatabase | null = null;

/** La base del navegador. Una sola por origen, creada al primer uso. */
export function outboxDatabase(): OutboxDatabase {
  singleton ??= createOutboxDatabase();
  return singleton;
}
