import { createOutboxDatabase, type OutboxDatabase } from "./db";

/**
 * Una base de pruebas con nombre propio por cada caso: `fake-indexeddb`
 * comparte el almacén entre pruebas del mismo archivo, y una cola heredada de
 * la prueba anterior convierte un fallo real en un aprobado por casualidad.
 */
let counter = 0;

export function freshOutbox(): OutboxDatabase {
  counter += 1;
  return createOutboxDatabase(`kamay-outbox-test-${counter}-${Date.now()}`);
}

export const SESSION = { organizationId: "org-a", userId: "user-a" };
