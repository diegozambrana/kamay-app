import { createHash, randomBytes } from "node:crypto";

/**
 * KAM-32 · El token del enlace público de seguimiento de un pedido: mismo
 * patrón que `lib/invitations/token.ts` y `lib/order-requests/token.ts`
 * (design D5), constante de vigencia propia porque este enlace vive mucho
 * más tiempo (design D4) — no es un token de un solo uso.
 */
export function generateOrderShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOrderShareToken(token: string): string {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

/** Vigencia por defecto: 180 días desde que se genera o se regenera. */
export const ORDER_SHARE_TTL_DAYS = 180;

export function orderShareExpiry(from: Date = new Date()): string {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + ORDER_SHARE_TTL_DAYS);
  return expires.toISOString();
}
