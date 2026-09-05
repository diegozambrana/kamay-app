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

/**
 * Lo que el modo feria captura al entrar con red para poder abrir sin ella
 * (KAM-12, design.md decisión 12).
 *
 * No es una caché que se sirva a espaldas de nadie: lleva `capturedAt` y la
 * cuadrícula lo enseña. La diferencia con cachear la ruta a secas es de
 * honestidad, no de implementación — el HTML cacheado serviría precios de
 * anoche sin decirlo.
 */
export interface FairSnapshot {
  /** `<organizationId>:<businessLineId>`: una feria por línea y organización. */
  id: string;
  organizationId: string;
  businessLineId: string;
  /** El canal elegido al abrir la feria; el mismo para toda la sesión. */
  salesChannelId: string | null;
  products: FairSnapshotProduct[];
  /** Cuándo se capturó, en ISO. Es lo que la cuadrícula muestra. */
  capturedAt: string;
}

/** Un producto tal como se guarda para vender sin señal. */
export interface FairSnapshotProduct {
  id: string;
  name: string;
  salePrice: number;
  quantitySold: number;
}
