import { printCost3d } from "@/tools/print-cost-3d/manifest";
import type { AnyToolManifest } from "@/tools/types";

/**
 * KAM-27 · Todas las herramientas que existen (spec `tenant-tools` → *Las
 * herramientas disponibles salen de un registro en código*).
 *
 * **Lista escrita a mano, no un `glob`**: añadir una herramienta es un diff
 * visible aquí, y el catálogo es el mismo para todas las organizaciones. La
 * base solo dice cuál está activa y con qué parámetros.
 *
 * Cómo se añade una: `tools/README.md`.
 */
export const TOOLS: readonly AnyToolManifest[] = [printCost3d];
