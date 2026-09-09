/**
 * Rutas del grupo autenticado `(app)` y utilidades de redirección.
 * Cada feature nueva añade aquí su prefijo protegido.
 */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/quick",
  // Destino de la tercera ranura de la barra inferior (V20). Cascarón hasta
  // KAM-17, pero la ruta tiene que existir para el proxy desde ya.
  "/my-tasks",
  // El tablero de tareas (V17). `/my-tasks` es su hermana móvil y va arriba:
  // son dos pantallas distintas sobre las mismas tareas, no una ruta anidada.
  "/tasks",
  // El modo feria vive en su propio grupo de rutas `(fair)`, sin cascarón,
  // pero necesita sesión igual que el resto: se vende contra la organización.
  "/fair",
  "/orders",
  "/catalog",
  "/contacts",
  "/expenses",
  // V12 · Activos. Solo la persona dueña, como `/expenses`: la guardia real la
  // pone la página con `getOwnerContext()`; aquí solo se exige sesión.
  "/assets",
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
 * ¿El user-agent es de un teléfono?
 *
 * Se decide en el servidor y no con `matchMedia` porque las dos preguntas que
 * dependen de esto —a dónde aterrizar tras entrar y qué vista de pedidos
 * mostrar por omisión— se responden antes del primer render: resolverlas en
 * el cliente haría aparecer una pantalla y cambiarla al hidratar.
 *
 * Es imperfecto a propósito: una ventana estrecha de escritorio recibe la
 * variante de escritorio, y quien quiera la otra la tiene a un toque.
 */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent) && MOBILE_UA_PATTERN.test(userAgent as string);
}

/**
 * Aterrizaje por dispositivo (D5): `/quick` para user-agents móviles,
 * `/dashboard` para el resto. Es solo el destino inicial tras entrar;
 * ambas rutas quedan siempre accesibles.
 */
export function defaultLandingPath(userAgent: string | null | undefined): string {
  return isMobileUserAgent(userAgent) ? "/quick" : "/dashboard";
}
