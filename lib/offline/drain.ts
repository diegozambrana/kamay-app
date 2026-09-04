import { backoffDelay, hasExhaustedAttempts } from "./backoff";
import { classify } from "./classify";
import { outboxDatabase, type OutboxDatabase } from "./db";
import { failedRecordIdsOf, holdReason } from "./hold";
import { getOperation, unknownOperationMessage, type OfflineOperation } from "./registry";
import { listEntries } from "./queue";
import type { SendOutcome, SessionIdentity } from "./types";

/**
 * El motor de vaciado (design.md, decisión 7).
 *
 * Estrictamente secuencial y en orden de encolado. El orden padre → hijo sale
 * gratis de ahí: el padre se encoló antes. `dependsOn` no ordena —eso ya lo
 * hace `seq`—, sirve para **retener** lo que no debe salir solo.
 */

export type DrainOutcomes = Map<number, SendOutcome>;

export interface DrainDeps {
  session: SessionIdentity | null;
  db?: OutboxDatabase;
  now?: () => number;
  random?: () => number;
  resolveOperation?: (key: string) => OfflineOperation | undefined;
}

let inFlight: Promise<DrainOutcomes> | null = null;

/**
 * Un solo vaciado a la vez. El temporizador, el evento `online` y el arranque
 * disparan los tres, y sin candado se solaparían sobre la misma entrada. Quien
 * llega segundo espera al vaciado en curso en lugar de abrir otro.
 */
export function drainOutbox(deps: DrainDeps): Promise<DrainOutcomes> {
  if (inFlight) return inFlight;

  const running = runDrain(deps);
  inFlight = running;

  void running.finally(() => {
    if (inFlight === running) inFlight = null;
  });

  return running;
}

/** Solo para pruebas: olvida el vaciado en curso. */
export function resetDrainLock(): void {
  inFlight = null;
}

async function runDrain(deps: DrainDeps): Promise<DrainOutcomes> {
  const db = deps.db ?? outboxDatabase();
  const now = deps.now ?? (() => Date.now());
  const random = deps.random ?? Math.random;
  const resolveOperation = deps.resolveOperation ?? getOperation;

  const outcomes: DrainOutcomes = new Map();

  for (;;) {
    const entries = await listEntries(db);
    const failedRecordIds = failedRecordIdsOf(entries);

    const next = entries.find(
      (entry) =>
        entry.state === "pending" &&
        !outcomes.has(entry.seq) &&
        entry.nextAttemptAt <= now() &&
        holdReason(entry, deps.session, failedRecordIds) === null,
    );

    if (!next) return outcomes;

    await db.outbox.update(next.seq, { state: "sending" });

    const operation = resolveOperation(next.operation);

    // Una operación que este código no sabe enviar no es un error del
    // programa: es una entrada de otra versión. Acaba en la bandeja, no
    // perdida (design.md — Risks).
    if (!operation) {
      const message = unknownOperationMessage(next.operation);
      await db.outbox.update(next.seq, {
        state: "failed",
        lastError: message,
        attempts: next.attempts + 1,
      });
      outcomes.set(next.seq, { kind: "permanent", message, recoverable: false });
      continue;
    }

    const [settled] = await Promise.allSettled([operation.send(next.payload)]);
    const outcome = classify(settled);
    outcomes.set(next.seq, outcome);

    if (outcome.kind === "ok") {
      // Enviada es enviada: la entrada deja de existir y el indicador baja.
      await db.outbox.delete(next.seq);
      continue;
    }

    const attempts = next.attempts + 1;

    if (outcome.kind === "permanent") {
      await db.outbox.update(next.seq, {
        state: "failed",
        attempts,
        lastError: outcome.message,
      });
      // Un rechazo definitivo no bloquea a los demás; solo a lo que dependa
      // de él, que `holdReason` retiene en la vuelta siguiente.
      continue;
    }

    if (hasExhaustedAttempts(attempts)) {
      await db.outbox.update(next.seq, {
        state: "failed",
        attempts,
        lastError: outcome.message,
      });
      return outcomes;
    }

    await db.outbox.update(next.seq, {
      state: "pending",
      attempts,
      nextAttemptAt: now() + backoffDelay(attempts, random),
      lastError: outcome.message,
    });

    // Un fallo transitorio detiene el vaciado entero: dejar pasar a la
    // siguiente sería reordenar la cola, y el orden es la garantía de que un
    // hijo no adelanta a su padre.
    return outcomes;
  }
}
