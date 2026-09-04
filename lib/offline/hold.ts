import { OUTBOX_SCHEMA_VERSION } from "./db";
import type { HoldReason, OutboxEntry, SessionIdentity } from "./types";

/**
 * Por qué una entrada pendiente no se envía ahora mismo.
 *
 * Se **calcula**, no se persiste (design.md, decisiones 7 y 9). Un estado
 * `blocked` guardado en la base se quedaría pegado: al volver a la organización
 * correcta, o al reintentar la dependencia que había muerto, la entrada tiene
 * que volver a salir sola.
 */
export function holdReason(
  entry: OutboxEntry,
  session: SessionIdentity | null,
  failedRecordIds: ReadonlySet<string>,
): HoldReason | null {
  if (entry.schemaVersion !== OUTBOX_SCHEMA_VERSION) return "schema";

  // Las acciones toman la organización del contexto de sesión, no del payload
  // (convención nº 2). Sin esta comprobación, un pedido encolado en la
  // organización A se guardaría en la B, y RLS no lo impediría: la sesión sí
  // tiene permiso sobre B.
  if (session === null) return "user";
  if (entry.userId !== session.userId) return "user";
  if (entry.organizationId !== session.organizationId) return "organization";

  if (entry.dependsOn.some((recordId) => failedRecordIds.has(recordId))) {
    return "dependency";
  }

  return null;
}

export function failedRecordIdsOf(entries: readonly OutboxEntry[]): Set<string> {
  return new Set(
    entries.filter((entry) => entry.state === "failed").map((entry) => entry.recordId),
  );
}

/** Texto para la bandeja. Explica, no acusa. */
export function holdMessage(reason: HoldReason): string {
  switch (reason) {
    case "organization":
      return "Se registró en otra organización. Cambia a esa organización para enviarlo.";
    case "user":
      return "Lo registró otra persona en este dispositivo. Se enviará cuando vuelva a entrar con su cuenta.";
    case "schema":
      return "Se guardó con una versión anterior de la aplicación. Actualiza y vuelve a intentarlo.";
    case "dependency":
      return "Espera a otro registro que no se pudo enviar. Resuelve aquel primero.";
  }
}
