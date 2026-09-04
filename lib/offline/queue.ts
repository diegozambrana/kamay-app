import { OUTBOX_SCHEMA_VERSION, outboxDatabase, type OutboxDatabase } from "./db";
import type { OutboxEntry } from "./types";

/**
 * Escribir en la cola y leerla. Nada de esto envía: enviar es cosa de
 * `drain.ts`, y esa separación es lo que permite probar el orden sin red.
 */

export interface EnqueueInput {
  /** `uuid` del registro, generado en el cliente (convención nº 9). */
  recordId: string;
  operation: string;
  payload: unknown;
  organizationId: string;
  userId: string;
  /** `recordId` de lo que tiene que salir antes. */
  dependsOn?: string[];
}

export async function enqueue(
  input: EnqueueInput,
  db: OutboxDatabase = outboxDatabase(),
  now: () => Date = () => new Date(),
): Promise<number> {
  const entry: Omit<OutboxEntry, "seq"> = {
    recordId: input.recordId,
    operation: input.operation,
    payload: input.payload,
    // La organización y la persona se graban aquí, al encolar, no al enviar:
    // es lo que impide que un registro de la organización A acabe en la B
    // (design.md, decisión 9).
    organizationId: input.organizationId,
    userId: input.userId,
    dependsOn: input.dependsOn ?? [],
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    enqueuedAt: now().toISOString(),
    schemaVersion: OUTBOX_SCHEMA_VERSION,
  };

  return db.outbox.add(entry as OutboxEntry);
}

/** Todas las entradas, en orden de encolado. Es un orden, no un detalle. */
export async function listEntries(
  db: OutboxDatabase = outboxDatabase(),
): Promise<OutboxEntry[]> {
  const entries = await db.outbox.toArray();
  return entries.sort((a, b) => a.seq - b.seq);
}

export async function countPending(db: OutboxDatabase = outboxDatabase()): Promise<number> {
  return db.outbox.count();
}

/**
 * Devolver a la cola una entrada que había fallado, con su contenido y su
 * identificador originales: reintentar no reescribe nada.
 */
export async function retryEntry(
  seq: number,
  db: OutboxDatabase = outboxDatabase(),
): Promise<void> {
  await db.outbox.update(seq, {
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
  });
}

/**
 * Descartar. Es la única forma en que una entrada desaparece sin haberse
 * enviado, y la interfaz pide confirmación antes de llegar aquí.
 */
export async function discardEntry(
  seq: number,
  db: OutboxDatabase = outboxDatabase(),
): Promise<void> {
  await db.outbox.delete(seq);
}
