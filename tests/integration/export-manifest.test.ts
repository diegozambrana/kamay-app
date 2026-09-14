import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { EXCLUDED_COLUMNS, EXCLUDED_TABLES, EXPORT_TABLES } from "@/lib/export/tables";

/**
 * KAM-23 · La exportación completa no se queda atrás del esquema.
 *
 * **Contra la base y no contra una lista escrita a mano**, como la cobertura
 * de la bitácora (KAM-22): lo que hay que detectar es la tabla o la columna
 * que alguien añade mañana sin llevarla a `lib/export/tables.ts`, y que la
 * «exportación completa» dejaría de serlo en silencio.
 *
 * Si esta prueba falla, no se relaja: se añade la tabla o la columna al
 * manifiesto, o se declara su exclusión con su motivo.
 */

const DB =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const sql = (query: string) =>
  execSync(`psql "${DB}" -tAqF'|' -v ON_ERROR_STOP=1 -f -`, {
    encoding: "utf8",
    input: query,
  }).trim();

function catalogTables(): Map<string, string[]> {
  const rows = sql(`
    select c.relname, string_agg(a.attname, ',' order by a.attnum)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where n.nspname = 'public' and c.relkind in ('r', 'p')
     group by c.relname
     order by c.relname;
  `);
  return new Map(
    rows
      .split("\n")
      .filter(Boolean)
      .map((row) => {
        const [table, columns] = row.split("|");
        return [table, columns.split(",")];
      }),
  );
}

/** Las tablas cuya única política de lectura es `is_owner(organization_id)`. */
function ownerOnlyTables(): string[] {
  return sql(`
    select tablename
      from pg_policies
     where schemaname = 'public' and cmd = 'SELECT'
     group by tablename
    having bool_and(qual = 'is_owner(organization_id)')
     order by 1;
  `)
    .split("\n")
    .filter(Boolean);
}

describe("manifiesto de la exportación completa", () => {
  const catalog = catalogTables();

  it("exporta toda tabla de datos, y solo tablas que existen", () => {
    // Las que no son de ninguna organización se excluyen con su motivo
    // (`EXCLUDED_TABLES`), no en silencio.
    const organizationTables = [...catalog.keys()].filter((table) => !(table in EXCLUDED_TABLES));
    expect(EXPORT_TABLES.map((entry) => entry.table).sort()).toEqual(organizationTables.sort());
  });

  it("toda tabla excluida existe y no está en el manifiesto", () => {
    for (const table of Object.keys(EXCLUDED_TABLES)) {
      expect(catalog.has(table), table).toBe(true);
      expect(EXPORT_TABLES.some((entry) => entry.table === table), table).toBe(false);
    }
  });

  it("cada archivo lleva todas las columnas de su tabla, salvo las excluidas con motivo", () => {
    for (const entry of EXPORT_TABLES) {
      const excluded = EXCLUDED_COLUMNS[entry.table] ?? [];
      const expected = (catalog.get(entry.table) ?? []).filter(
        (column) => !excluded.includes(column),
      );
      expect(entry.columns, entry.table).toEqual(expected);
    }
  });

  it("marca como de la dueña exactamente las tablas que RLS le reserva", () => {
    expect(
      EXPORT_TABLES.filter((entry) => entry.ownerOnly)
        .map((entry) => entry.table)
        .sort(),
    ).toEqual(ownerOnlyTables());
  });

  it("no repite nombres de archivo", () => {
    const files = EXPORT_TABLES.map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
  });
});
