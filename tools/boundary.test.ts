import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * KAM-27 · La frontera de las herramientas (spec `tenant-tools` → *Una
 * herramienta no accede a los datos por su cuenta*).
 *
 * Hermana de `services/notifications/service-role-boundary.test.ts`. Una
 * herramienta es código de este repositorio, pero **no es el núcleo**: no
 * consulta la base, no usa la capa de servicios y no define Server Actions.
 * Todo lo que lee le llega como dato ya resuelto; todo lo que escribe pasa por
 * una acción del núcleo declarada en su manifiesto, con la sesión, el rol, la
 * RLS y la bitácora de quien la usa.
 *
 * El riesgo no es la línea de hoy: es la que alguien escriba dentro de seis
 * meses porque «era más rápido». Se recorre el disco y no `git ls-files` a
 * propósito: un archivo recién creado y sin añadir es justo el que hay que
 * atrapar.
 */

const TOOLS_DIR = join(process.cwd(), "tools");

const FORBIDDEN: readonly { what: string; pattern: RegExp }[] = [
  { what: "un cliente de Supabase", pattern: /from\s+["']@supabase\// },
  { what: "lib/supabase (incluido el service role)", pattern: /from\s+["']@\/lib\/supabase/ },
  { what: "la capa de servicios", pattern: /from\s+["']@\/services\// },
  { what: "una Server Action propia", pattern: /^\s*["']use server["']/m },
  { what: "una consulta directa (.from / .rpc)", pattern: /\.(from|rpc)\(\s*["'`]/ },
  { what: "una petición a internet (fetch)", pattern: /\bfetch\(/ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    // Las pruebas pueden nombrar lo prohibido —esta misma lo hace—.
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

function offendersIn(files: readonly { path: string; source: string }[]): string[] {
  return files.flatMap(({ path, source }) =>
    FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(({ what }) => `${path}: ${what}`),
  );
}

describe("frontera de las herramientas", () => {
  it("ningún archivo de tools/ toca la base, los servicios ni internet", () => {
    const files = sourceFiles(TOOLS_DIR).map((path) => ({
      path: relative(process.cwd(), path),
      source: readFileSync(path, "utf8"),
    }));
    expect(files.length).toBeGreaterThan(0);

    const offenders = offendersIn(files);
    expect(
      offenders,
      `Estos archivos de herramientas cruzan la frontera:\n${offenders.join("\n")}\n\n` +
        `Una herramienta no accede a los datos por su cuenta: lo que lee se lo da el ` +
        `núcleo como dato, y lo que escribe pasa por una Server Action existente ` +
        `declarada en su manifiesto (tools/README.md).`,
    ).toEqual([]);
  });

  it("la prueba atrapa de verdad cada forma de cruzarla", () => {
    const cases = [
      'import { createClient } from "@supabase/supabase-js";',
      // Partida en dos a propósito: la prueba hermana del service role busca
      // esta importación con `git grep`, y escrita entera aquí la encontraría.
      `import { createAdminClient } from "@/lib/supabase/${"admin"}";`,
      'import { OrderService } from "@/services/orders/order-service";',
      '"use server";\nexport async function x() {}',
      'await db.from("orders").select("*");',
      'await db.rpc("update_order", {});',
      'await fetch("https://example.com");',
    ];
    for (const source of cases) {
      expect(offendersIn([{ path: "tools/x/y.ts", source }]), source).toHaveLength(1);
    }
    // Lo permitido: una acción del núcleo, y `Array.from`, que no es una consulta.
    expect(
      offendersIn([
        {
          path: "tools/x/ok.tsx",
          source: 'import { addOrderLine } from "@/actions/orders";\nArray.from({ length: 2 });',
        },
      ]),
    ).toEqual([]);
  });
});
