import type { Role } from "@/types";
import { toolHref } from "@/tools/resolve";
import type { AnyToolManifest, ToolHook } from "@/tools/types";

/**
 * KAM-27 · Lo que el catálogo muestra de cada herramienta, ya en lenguaje
 * llano y serializable (spec `tenant-tools` → *El catálogo vive en la
 * configuración y es de la dueña*). El manifiesto no cruza a cliente: lleva
 * esquemas Zod y funciones.
 */
export type CatalogEntry = {
  slug: string;
  name: string;
  description: string;
  active: boolean;
  /** Tuvo parámetros alguna vez: al reactivar, vuelven. */
  hasSavedConfig: boolean;
  config: Record<string, unknown>;
  /** Capacidades, dónde aparece y quién la usa: una frase cada una. */
  facts: string[];
  href: string | null;
};

const HOOK_TEXT: Record<ToolHook, string> = {
  page: "Tiene su propia página, en la sección «Herramientas» del menú.",
  "order-detail": "Añade una acción en el detalle de cada pedido.",
};

const ROLE_TEXT: Record<Role, string> = {
  owner: "Solo la persona dueña puede usarla.",
  assistant: "La pueden usar la persona dueña y sus ayudantes.",
};

export function toolFacts(tool: AnyToolManifest): string[] {
  return [
    `Produce: ${tool.capabilities.produces}`,
    tool.capabilities.network
      ? "Se conecta a internet para funcionar."
      : "No sale a internet: todo se calcula dentro de Kamay.",
    tool.capabilities.credentials
      ? "Guarda credenciales de otros servicios."
      : "No guarda contraseñas ni credenciales de otros servicios.",
    "Solo guarda sus parámetros. Nada de lo que calcula se almacena.",
    ...tool.hooks.map((hook) => HOOK_TEXT[hook]),
    ROLE_TEXT[tool.minRole],
  ];
}

export function catalogEntries(
  registry: readonly AnyToolManifest[],
  rows: readonly { slug: string; config: Record<string, unknown>; archivedAt: string | null }[],
): CatalogEntry[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  return registry.map((tool) => {
    const row = bySlug.get(tool.slug);
    const active = row !== undefined && row.archivedAt === null;
    return {
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      active,
      hasSavedConfig: row !== undefined,
      config: row?.config ?? (tool.defaults as Record<string, unknown>),
      facts: toolFacts(tool),
      href: active && tool.hooks.includes("page") ? toolHref(tool.slug) : null,
    };
  });
}
