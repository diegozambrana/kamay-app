/**
 * La vista de origen de las pantallas de tarea (spec `navigation-breadcrumbs`,
 * design D5 de `task-detail-edit-split`).
 *
 * Es el hermano de `lib/orders/list-href.ts` con dos diferencias:
 *
 * 1. Tareas tiene **nueve** llaves de filtro, no cuatro.
 * 2. Tiene **dos** pantallas de origen. *Mis pendientes* no lleva ningún
 *    parámetro en la dirección —su búsqueda es estado del cliente—, así que no
 *    necesita llevar consulta: le basta con marcarse. `from=my-tasks` es un
 *    token reservado; cualquier otro valor se lee como consulta de `/tasks`.
 *
 * Como en pedidos, `from` **nunca** se usa como URL: se lee como consulta y
 * solo sobreviven las llaves conocidas, así que un origen ajeno (`https://…`,
 * `//host`, otra ruta) se ignora por construcción.
 */

/** Las llaves que `app/(app)/tasks/page.tsx` declara como filtros. */
const LIST_KEYS = [
  "view",
  "q",
  "assignee",
  "tag",
  "status",
  "archived",
  "link",
  "nodeliv",
  "closed",
] as const;

/**
 * El origen *Mis pendientes*. No es una llave de filtro válida, así que no
 * puede confundirse con una consulta del tablero.
 */
export const MY_TASKS_ORIGIN = "my-tasks";

/**
 * La consulta de `from` limpia: el token reservado tal cual, o solo los
 * filtros conocidos y no vacíos.
 */
export function sanitizeFrom(from: string | null | undefined): string {
  if (!from) return "";

  const raw = from.startsWith("?") ? from.slice(1) : from;
  if (raw === MY_TASKS_ORIGIN) return MY_TASKS_ORIGIN;

  // Una URL completa o una ruta no es una consulta: se descarta entera, no se
  // rescata lo que pudiera parecer un filtro dentro de ella.
  if (raw.includes("/") || raw.includes(":")) return "";

  const source = new URLSearchParams(raw);
  const clean = new URLSearchParams();
  for (const key of LIST_KEYS) {
    const value = source.get(key);
    if (value) clean.set(key, value);
  }
  return clean.toString();
}

/** A dónde vuelve el primer tramo de las migas. `extra` se suma a la consulta. */
export function tasksListHref(
  from: string | null | undefined,
  extra?: Record<string, string>,
): string {
  const clean = sanitizeFrom(from);
  const base = clean === MY_TASKS_ORIGIN ? "/my-tasks" : "/tasks";
  const params = new URLSearchParams(clean === MY_TASKS_ORIGIN ? "" : clean);
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * El primer tramo de las migas de una pantalla de tarea: nombra la pantalla de
 * origen, que puede ser el tablero o *Mis pendientes*.
 */
export function originCrumb(from: string | null | undefined): {
  label: string;
  href: string;
} {
  const clean = sanitizeFrom(from);
  return clean === MY_TASKS_ORIGIN
    ? { label: "Mis pendientes", href: "/my-tasks" }
    : { label: "Tareas", href: tasksListHref(clean) };
}

/** Propaga la vista de origen a un enlace de detalle o de edición. */
export function withFrom(href: string, from: string | null | undefined): string {
  const clean = sanitizeFrom(from);
  if (!clean) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(clean)}`;
}
