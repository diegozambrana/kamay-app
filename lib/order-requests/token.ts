import { createHash, randomBytes } from "node:crypto";

/**
 * KAM-28 · El token de una solicitud de pedido: mismo patrón que
 * `lib/invitations/token.ts` (design D9), constante propia porque son dos
 * conceptos distintos que podrían divergir.
 *
 * Se genera y se hashea aquí, nunca en la base: el token en claro solo existe
 * en este momento del servidor y en el enlace que sale hacia el cliente.
 */
export function generateOrderRequestToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash en el formato hexadecimal de `bytea` que entiende Postgres (`\x…`),
 * que es como PostgREST acepta un valor binario en JSON.
 */
export function hashOrderRequestToken(token: string): string {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

/** Vigencia por defecto: una semana desde que se genera o se regenera. */
export const ORDER_REQUEST_TTL_DAYS = 7;

export function orderRequestExpiry(from: Date = new Date()): string {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + ORDER_REQUEST_TTL_DAYS);
  return expires.toISOString();
}
