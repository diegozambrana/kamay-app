import type { Role } from "@/types";
import { TOOLS } from "@/tools/registry";
import type { AnyToolManifest, ToolHook, ToolNavItem } from "@/tools/types";

/**
 * KAM-27 · Cruce entre lo que la base dice que está activo y lo que el
 * registro dice que existe. Funciones puras: el `registry` se puede inyectar
 * para probar casos que el registro real todavía no tiene (una herramienta de
 * ayudante, una retirada).
 */

/** La dirección de la página propia de una herramienta. */
export function toolHref(slug: string): string {
  return `/extensions/${slug}`;
}

export function toolBySlug(
  slug: string,
  registry: readonly AnyToolManifest[] = TOOLS,
): AnyToolManifest | null {
  return registry.find((tool) => tool.slug === slug) ?? null;
}

/** `assistant` es el mínimo: lo alcanzan los dos roles. `owner`, solo la dueña. */
export function roleReaches(role: Role, minRole: Role): boolean {
  return minRole === "assistant" || role === "owner";
}

/**
 * Las herramientas que esta persona puede usar ahora mismo.
 *
 * Un slug activo que ya no está en el registro **se ignora sin lanzar** (spec
 * → *Herramienta retirada del registro*): la fila se queda en la base, y si la
 * herramienta vuelve, vuelve con sus parámetros.
 *
 * El orden es el del registro, no el de la base, para que el menú no baile.
 */
export function activeToolsFor(
  activeSlugs: readonly string[],
  role: Role,
  options: { hook?: ToolHook; registry?: readonly AnyToolManifest[] } = {},
): AnyToolManifest[] {
  const { hook, registry = TOOLS } = options;
  const active = new Set(activeSlugs);

  return registry.filter(
    (tool) =>
      active.has(tool.slug) &&
      roleReaches(role, tool.minRole) &&
      (hook === undefined || tool.hooks.includes(hook)),
  );
}

/**
 * Una herramienta concreta, solo si esta persona puede usarla. Es la guarda de
 * `/extensions/<slug>`: `null` significa «no encontrada», sin distinguir entre
 * «no existe», «no está activa» y «no es tu rol».
 */
export function usableTool(
  slug: string,
  activeSlugs: readonly string[],
  role: Role,
  options: { hook?: ToolHook; registry?: readonly AnyToolManifest[] } = {},
): AnyToolManifest | null {
  return activeToolsFor(activeSlugs, role, options).find((tool) => tool.slug === slug) ?? null;
}

/** Lo que el menú necesita, ya serializable para cruzar a cliente (design D5). */
export function toolNavItems(tools: readonly AnyToolManifest[]): ToolNavItem[] {
  return tools.map((tool) => ({ slug: tool.slug, name: tool.name, href: toolHref(tool.slug) }));
}
