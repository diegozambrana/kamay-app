import type { z } from "zod";

import type { Role } from "@/types";

/**
 * KAM-27 · El contrato de una herramienta (spec `tenant-tools` → *Cada
 * herramienta declara su contrato*).
 *
 * Una **herramienta** es una utilidad opcional que el núcleo no trae. Es
 * código de este repositorio, entra por PR y vive entera en `tools/<slug>/`.
 * Lo que declara aquí no es documentación: `tools/contract.test.ts` lo
 * verifica sobre todo el registro, así que una herramienta nueva queda
 * cubierta sin escribir una sola prueba de contrato.
 */

/**
 * Dónde puede aparecer una herramienta. **Lista cerrada** (spec → *Los puntos
 * de enganche son una lista cerrada*): nada en el panel, el catálogo, las
 * tareas ni los egresos.
 */
export const TOOL_HOOKS = ["page", "order-detail"] as const;
export type ToolHook = (typeof TOOL_HOOKS)[number];

/** Lo que el catálogo le cuenta a la dueña, en lenguaje llano, antes de activar. */
export type ToolCapabilities = {
  /** ¿Sale a internet? En este cambio, ninguna. */
  network: boolean;
  /** ¿Guarda credenciales de otros servicios? En este cambio, ninguna. */
  credentials: boolean;
  /** Qué produce, dicho para una persona: «una línea en el pedido». */
  produces: string;
};

/**
 * Las tablas con las que se relaciona. Una herramienta **no toca tablas**
 * (spec → *Una herramienta no accede a los datos por su cuenta*), así que esto
 * dice qué le lee el núcleo para dársela y sobre qué escribe la Server Action
 * que llama. `via` se cruza con las importaciones reales de `@/actions/*`.
 */
export type ToolTables = {
  reads: readonly { table: string; why: string }[];
  writes: readonly { table: string; via: string }[];
};

/** Un caso de referencia: entradas reales con las que la herramienta se prueba. */
export type ToolFixture<Input> = {
  name: string;
  input: Input;
};

export type ToolManifest<Config = unknown, Input = unknown, Output = unknown> = {
  /** Identificador estable. Es el `slug` de `organization_tools` y de la URL. */
  slug: string;
  name: string;
  /** Una o dos frases para el catálogo. */
  description: string;
  /** Rol mínimo que puede usarla. `assistant` incluye a la dueña. */
  minRole: Role;
  hooks: readonly ToolHook[];
  capabilities: ToolCapabilities;
  tables: ToolTables;
  /** Parámetros de la organización. Todo campo lleva `.default()` y `.meta()`. */
  configSchema: z.ZodType<Config>;
  /** Lo que la persona escribe en cada uso. Nunca se guarda. */
  inputSchema: z.ZodType<Input>;
  /** Lo que la herramienta devuelve. Nunca se guarda (convención nº 4). */
  outputSchema: z.ZodType<Output>;
  /** Los parámetros con los que nace al activarse. */
  defaults: Config;
  fixtures: readonly ToolFixture<Input>[];
  /** La lógica: pura, sin React, sin fechas, sin E/S. */
  run: (config: Config, input: Input) => Output;
};

/**
 * El registro mezcla herramientas con tipos distintos; quien lo recorre solo
 * necesita la forma, no los tipos concretos de cada una.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolManifest = ToolManifest<any, any, any>;

/** Lo que cruza del servidor al cliente: serializable, sin esquemas Zod. */
export type ToolNavItem = {
  slug: string;
  name: string;
  href: string;
};
