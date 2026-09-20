/**
 * La vista de origen de la pantalla de pedidos (spec `navigation-breadcrumbs`,
 * design D2).
 *
 * Los enlaces que salen del tablero hacia un alta o un detalle llevan
 * `?from=<consulta del tablero>`, y la miga «Pedidos» —y el «Guardar» del
 * alta— vuelven a `/orders` con esa consulta. `from` nunca se usa como URL:
 * se lee como consulta y solo sobreviven las llaves de filtro conocidas, así
 * que un origen ajeno (`https://…`, `//host`, otra ruta) se ignora por
 * construcción.
 */
const LIST_KEYS = ["view", "q", "archived", "closed"] as const;

/** La consulta de `from` limpia: solo filtros conocidos y no vacíos. */
export function sanitizeFrom(from: string | null | undefined): string {
  if (!from) return "";

  // Una URL completa o una ruta no es una consulta: se descarta entera, no
  // se rescata lo que pudiera parecer un filtro dentro de ella.
  const raw = from.startsWith("?") ? from.slice(1) : from;
  if (raw.includes("/") || raw.includes(":")) return "";

  const source = new URLSearchParams(raw);
  const clean = new URLSearchParams();
  for (const key of LIST_KEYS) {
    const value = source.get(key);
    if (value) clean.set(key, value);
  }
  return clean.toString();
}

/** A dónde vuelve la miga «Pedidos». `extra` se suma a la consulta. */
export function ordersListHref(
  from: string | null | undefined,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams(sanitizeFrom(from));
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

/** Propaga la vista de origen a un enlace de alta, detalle o edición. */
export function withFrom(href: string, from: string | null | undefined): string {
  const clean = sanitizeFrom(from);
  if (!clean) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(clean)}`;
}
