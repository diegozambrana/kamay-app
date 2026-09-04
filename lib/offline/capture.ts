import type { DrainOutcomes } from "./drain";
import type { EnqueueInput } from "./queue";

/**
 * Encolar primero y esperar un poco (design.md, decisión 3).
 *
 * El formulario nunca llama a la Server Action: escribe en la cola, dispara el
 * vaciado y espera su resultado un plazo corto. Con red, el registro sale
 * dentro del mismo gesto y la experiencia de KAM-08 no cambia; sin red, se
 * confirma igual y el resto es cosa de la cola.
 *
 * El plazo no es un tiempo de espera de red: el envío sigue vivo cuando vence.
 * Es cuánto está dispuesta la interfaz a esperar antes de dar por buena la
 * captura.
 */
export const FLUSH_DEADLINE_MS = 2_500;

export type CaptureResult =
  | { status: "sent"; result: unknown }
  | { status: "queued" }
  | { status: "failed"; message: string };

export interface CaptureDeps {
  enqueue: (input: EnqueueInput) => Promise<number>;
  drain: () => Promise<DrainOutcomes>;
  isOnline: () => boolean;
  deadlineMs?: number;
  wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function capture(
  input: EnqueueInput,
  deps: CaptureDeps,
): Promise<CaptureResult> {
  const seq = await deps.enqueue(input);

  // Sin red no se espera nada: esperar un plazo que se sabe agotado es la
  // única forma de que registrar deje de sentirse instantáneo.
  if (!deps.isOnline()) return { status: "queued" };

  const wait = deps.wait ?? sleep;
  const deadlineMs = deps.deadlineMs ?? FLUSH_DEADLINE_MS;

  const draining = deps.drain();
  // El vaciado sobrevive al plazo; lo que no puede es tumbar la interfaz con
  // un rechazo que nadie recoge.
  void draining.catch(() => undefined);

  const outcomes = await Promise.race([
    draining.then((value): DrainOutcomes | null => value).catch(() => null),
    wait(deadlineMs).then(() => null),
  ]);

  const outcome = outcomes?.get(seq);

  if (!outcome) return { status: "queued" };
  if (outcome.kind === "ok") return { status: "sent", result: outcome.result };
  if (outcome.kind === "permanent") return { status: "failed", message: outcome.message };

  // Transitorio: ya está en la cola con su espera calculada. Para quien
  // registró, es exactamente lo mismo que no haber tenido red.
  return { status: "queued" };
}
