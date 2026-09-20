import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EXPORT_TABLES } from "@/lib/export/tables";
import { describeSchema, schemaKeys } from "@/tools/describe-schema";
import { TOOLS } from "@/tools/registry";
import { TOOL_HOOKS } from "@/tools/types";

/**
 * KAM-27 · El contrato de herramienta, verificado sobre **todo** el registro
 * (spec `tenant-tools` → *Cada herramienta declara su contrato*, *Cada
 * herramienta trae su documentación y sus pruebas* y *Los puntos de enganche
 * son una lista cerrada*).
 *
 * Esta prueba es lo que abarata la segunda herramienta: quien la añada no
 * escribe ninguna prueba de contrato. Si su README se queda atrás, si declara
 * una tabla que no existe o si usa una acción del núcleo sin decirlo, lo dice
 * esta prueba y nombra la herramienta.
 */

const TOOLS_DIR = join(process.cwd(), "tools");

/** Encabezados obligatorios del README, en este orden. */
const README_SECTIONS = [
  "Qué hace",
  "Parámetros",
  "Entradas",
  "Salidas",
  "Tablas relacionadas",
  "Puntos de enganche",
  "Cómo se prueba",
] as const;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** El texto de una sección `## Título`, hasta el siguiente `## `. */
function section(readme: string, title: string): string | null {
  const start = readme.indexOf(`\n## ${title}\n`);
  if (start === -1) return null;
  const from = start + title.length + 5;
  const next = readme.indexOf("\n## ", from);
  return readme.slice(from, next === -1 ? undefined : next);
}

/** Las acciones del núcleo que el código de la herramienta importa de verdad. */
function importedActions(dir: string): string[] {
  const names = new Set<string>();
  for (const file of filesUnder(dir)) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/actions\/[^"']+["']/g)) {
      for (const name of match[1].split(",")) {
        const clean = name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
        if (clean) names.add(clean);
      }
    }
  }
  return [...names].sort();
}

describe("el registro", () => {
  it("no repite identificadores", () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(slugs, "hay un slug repetido en tools/registry.ts").toEqual([...new Set(slugs)]);
  });

  it("cada carpeta de herramienta está en el registro, y al revés", () => {
    const folders = readdirSync(TOOLS_DIR)
      .filter((entry) => statSync(join(TOOLS_DIR, entry)).isDirectory())
      .sort();
    expect(folders).toEqual(TOOLS.map((tool) => tool.slug).sort());
  });
});

describe.each(TOOLS.map((tool) => [tool.slug, tool] as const))("contrato de %s", (slug, tool) => {
  const dir = join(TOOLS_DIR, slug);

  it("su identificador tiene forma de slug, el mismo patrón que exige la base", () => {
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("tiene nombre, descripción y dice qué produce", () => {
    expect(tool.name.trim()).not.toBe("");
    expect(tool.description.trim()).not.toBe("");
    expect(tool.capabilities.produces.trim()).not.toBe("");
  });

  it("no sale a internet ni guarda credenciales (fuera de alcance en KAM-27)", () => {
    expect(tool.capabilities.network).toBe(false);
    expect(tool.capabilities.credentials).toBe(false);
  });

  it("sus puntos de enganche pertenecen a la lista cerrada", () => {
    expect(tool.hooks.length).toBeGreaterThan(0);
    for (const hook of tool.hooks) {
      expect(TOOL_HOOKS, `enganche desconocido: ${hook}`).toContain(hook);
    }
  });

  it("sus valores por defecto cumplen su propio esquema de parámetros", () => {
    const parsed = tool.configSchema.safeParse(tool.defaults);
    expect(parsed.error?.issues, "defaults inválidos").toBeUndefined();
  });

  it("unos parámetros vacíos se completan con los valores por defecto", () => {
    expect(tool.configSchema.parse({})).toEqual(tool.defaults);
  });

  it("el formulario de parámetros sabe pintar todos sus campos", () => {
    expect(() => describeSchema(tool.configSchema)).not.toThrow();
  });

  it("trae casos de referencia, y con cada uno la salida cumple el esquema de salidas", () => {
    expect(tool.fixtures.length, "fixtures.ts está vacío").toBeGreaterThan(0);
    for (const fixture of tool.fixtures) {
      const input = tool.inputSchema.safeParse(fixture.input);
      expect(input.error?.issues, `entrada inválida en «${fixture.name}»`).toBeUndefined();
      const output = tool.outputSchema.safeParse(tool.run(tool.defaults, input.data));
      expect(output.error?.issues, `salida inválida en «${fixture.name}»`).toBeUndefined();
    }
  });

  it("toda tabla relacionada existe en el manifiesto de exportación", () => {
    const known = new Set(EXPORT_TABLES.map((table) => table.table));
    for (const { table } of [...tool.tables.reads, ...tool.tables.writes]) {
      expect(known.has(table), `tabla desconocida: ${table}`).toBe(true);
    }
  });

  it("usa exactamente las acciones del núcleo que declara", () => {
    const declared = [...new Set(tool.tables.writes.map((write) => write.via))].sort();
    expect(importedActions(dir), "acciones importadas ≠ acciones declaradas en tables.writes").toEqual(
      declared,
    );
  });

  it("trae pruebas propias de su lógica y un archivo de casos de referencia", () => {
    const files = filesUnder(dir);
    expect(files.some((file) => /\.test\.tsx?$/.test(file)), "sin ningún *.test.ts").toBe(true);
    expect(existsSync(join(dir, "fixtures.ts")), "sin fixtures.ts").toBe(true);
  });

  describe("README.md", () => {
    const path = join(dir, "README.md");
    const readme = existsSync(path) ? `\n${readFileSync(path, "utf8")}` : null;

    it("existe", () => {
      expect(readme, `falta tools/${slug}/README.md`).not.toBeNull();
    });

    it("tiene las siete secciones obligatorias", () => {
      for (const title of README_SECTIONS) {
        expect(section(readme ?? "", title), `falta la sección «## ${title}»`).not.toBeNull();
      }
    });

    it.each([
      ["Parámetros", "configSchema"],
      ["Entradas", "inputSchema"],
      ["Salidas", "outputSchema"],
    ] as const)("la sección «%s» nombra todos los campos de %s", (title, schemaName) => {
      const text = section(readme ?? "", title) ?? "";
      const missing = schemaKeys(tool[schemaName]).filter((key) => !text.includes(`\`${key}\``));
      expect(missing, `campos sin documentar en «${title}»`).toEqual([]);
    });

    it("la sección «Tablas relacionadas» nombra cada tabla y cada acción", () => {
      const text = section(readme ?? "", "Tablas relacionadas") ?? "";
      const names = [
        ...tool.tables.reads.map((read) => read.table),
        ...tool.tables.writes.flatMap((write) => [write.table, write.via]),
      ];
      expect(names.filter((name) => !text.includes(`\`${name}\``))).toEqual([]);
    });

    it("la sección «Puntos de enganche» nombra cada enganche", () => {
      const text = section(readme ?? "", "Puntos de enganche") ?? "";
      expect(tool.hooks.filter((hook) => !text.includes(`\`${hook}\``))).toEqual([]);
    });
  });
});
