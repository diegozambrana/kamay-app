import { createHash, randomBytes } from "node:crypto";

/**
 * El token de invitación se genera aquí y se guarda solo como hash: quien lea
 * la tabla —incluido el dueño— no puede reconstruir un enlace ajeno.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash en el formato hexadecimal de `bytea` que entiende Postgres (`\x…`),
 * que es como PostgREST acepta un valor binario en JSON.
 */
export function hashInvitationToken(token: string): string {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

/** Caducidad por defecto: una semana desde ahora. */
export const INVITATION_TTL_DAYS = 7;

export function invitationExpiry(from: Date = new Date()): string {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + INVITATION_TTL_DAYS);
  return expires.toISOString();
}
