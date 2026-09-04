/**
 * La cola de captura sin conexión (KAM-11).
 *
 * Una entrada guarda la **intención** —qué operación y con qué datos—, no la
 * petición serializada: el protocolo de invocación de Server Actions no es una
 * API estable y una entrada encolada antes de un despliegue apuntaría a una
 * acción que ya no existe (design.md, decisión 1).
 */

/**
 * Estado persistido. La retención —dependencia muerta, organización o persona
 * que no coinciden, esquema de otra versión— **no** se persiste: se calcula al
 * leer (`holdReason`), porque es una condición que se cura sola al volver a la
 * organización correcta o al reintentar la dependencia.
 */
export type OutboxState = "pending" | "sending" | "failed";

/** Por qué una entrada no se envía aunque esté pendiente. */
export type HoldReason = "organization" | "user" | "schema" | "dependency";

export interface OutboxEntry {
  /** Orden de encolado. Lo asigna Dexie; es lo que garantiza padre → hijo. */
  seq: number;
  /** Identificador `uuid` del registro que se escribe, generado en el cliente. */
  recordId: string;
  /** Clave del registro de operaciones (`order.create`, `order.update`, …). */
  operation: string;
  /** Lo que la Server Action espera. Serializable y estable en el tiempo. */
  payload: unknown;
  organizationId: string;
  userId: string;
  /** `recordId` de las entradas que tienen que haber salido antes que esta. */
  dependsOn: string[];
  state: OutboxState;
  attempts: number;
  /** Época en milisegundos: antes de este instante no se reintenta. */
  nextAttemptAt: number;
  lastError: string | null;
  /** Hora real del encolado, en ISO. Lo que la bandeja muestra. */
  enqueuedAt: string;
  /** Versión del formato de la entrada. Ver `OUTBOX_SCHEMA_VERSION`. */
  schemaVersion: number;
}

/** Lo que hace falta saber de la sesión para decidir si una entrada sale. */
export interface SessionIdentity {
  organizationId: string;
  userId: string;
}

/** El resultado de intentar enviar una entrada, ya clasificado. */
export type SendOutcome =
  | { kind: "ok"; result: unknown }
  | { kind: "transient"; message: string }
  | { kind: "permanent"; message: string; recoverable: boolean };
