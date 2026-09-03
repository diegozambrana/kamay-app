/**
 * Rutas del grupo autenticado `(app)` y utilidades de redirección.
 * Cada feature nueva añade aquí su prefijo protegido.
 */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/quick",
  "/orders",
  "/catalog",
  "/contacts",
  "/expenses",
  "/settings",
] as const;

export const LOGIN_PATH = "/auth/login";

/** ¿La ruta pertenece al grupo autenticado `(app)`? */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Ruta interna válida: empieza con `/`, sin `//` ni `\` que un navegador
 * interprete como esquema u host externo (anti open redirect).
 */
export function sanitizeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

/**
 * Valida el parámetro `next` de login: ruta interna y fuera de `/auth`
 * para no crear ciclos de redirección.
 */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  const path = sanitizeInternalPath(raw);
  if (!path || path.startsWith("/auth")) return null;
  return path;
}

const MOBILE_UA_PATTERN = /Mobi|Android|iPhone|iPod|Windows Phone/i;

/**
 * Aterrizaje por dispositivo (D5): `/quick` para user-agents móviles,
 * `/dashboard` para el resto. Es solo el destino inicial tras entrar;
 * ambas rutas quedan siempre accesibles.
 */
export function defaultLandingPath(userAgent: string | null | undefined): string {
  return userAgent && MOBILE_UA_PATTERN.test(userAgent) ? "/quick" : "/dashboard";
}
