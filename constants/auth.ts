/** Cookie que guarda la organización activa (D6). */
export const ORG_COOKIE = "kamay-org";

/** Un año: la selección de organización sobrevive a la sesión. */
export const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cookie de la línea activa, una por organización (D4): así cada organización
 * conserva su propia selección y borrar una no toca las demás.
 */
export function lineCookieName(organizationId: string): string {
  return `kamay-line-${organizationId}`;
}

/** Misma duración que la organización activa: la selección sobrevive a la sesión. */
export const LINE_COOKIE_MAX_AGE = ORG_COOKIE_MAX_AGE;
