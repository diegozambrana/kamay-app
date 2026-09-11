import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { SUBJECTS_FOR_TESTS } from "@/lib/activity/describe";
import { FIELDS, HIDDEN_REASON, fieldSpec } from "@/lib/activity/fields";

/**
 * KAM-22 · El diccionario de la bitácora no se queda atrás.
 *
 * **Contra la base y no contra una lista escrita a mano** (design D5). Una
 * lista a mano solo comprobaría que coincide consigo misma; lo que hay que
 * detectar es la columna que alguien añade en la tarea siguiente sin tocar la
 * redacción — que es exactamente lo que pasó entre KAM-17 y KAM-21, cuando la
 * bitácora empezó a auditar siete tablas más y `tasks` acabó leyéndose como
 * «un registro».
 *
 * Si esta prueba falla, no se relaja: se añade el rótulo que falta a
 * `lib/activity/fields.ts` o el sujeto a `lib/activity/describe.ts`.
 */

const DB =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const sql = (query: string) =>
  execSync(`psql "${DB}" -tAqF'|' -v ON_ERROR_STOP=1 -f -`, {
    encoding: "utf8",
    input: query,
  }).trim();

/** Las tablas que hoy llevan el trigger `audit`. */
function tablasAuditadas(): string[] {
  return sql(`
    select c.relname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where t.tgname = 'audit' and not t.tgisinternal
     order by 1;
  `)
    .split("\n")
    .filter(Boolean);
}

/**
 * Las columnas que el trigger puede guardar en `changes`.
 *
 * Fuera: `created_at` y `updated_at`, que `log_activity()` excluye del diff de
 * una edición y `buildDetail` descarta también en un alta; y `id` y
 * `organization_id`, que no son un cambio que contar.
 */
function columnasAuditables(tabla: string): string[] {
  return sql(`
    select a.attname
      from pg_attribute a
     where a.attrelid = '${tabla}'::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attname not in ('id','organization_id','created_at','updated_at')
     order by a.attnum;
  `)
    .split("\n")
    .filter(Boolean);
}

describe("cobertura del diccionario de campos", () => {
  const tablas = tablasAuditadas();

  it("hay tablas auditadas que comprobar", () => {
    expect(tablas.length).toBeGreaterThan(20);
  });

  it("toda tabla auditada tiene rótulos de campo", () => {
    const sinRotulos = tablas.filter((tabla) => !(tabla in FIELDS));

    expect(
      sinRotulos,
      `Estas tablas llevan el trigger \`audit\` y no están en lib/activity/fields.ts: ${sinRotulos.join(", ")}`,
    ).toEqual([]);
  });

  it("toda columna auditable tiene su rótulo, y ninguno es su nombre de columna", () => {
    const faltan: string[] = [];
    const filtran: string[] = [];

    for (const tabla of tablas) {
      for (const columna of columnasAuditables(tabla)) {
        const spec = fieldSpec(tabla, columna);
        if (!spec) {
          faltan.push(`${tabla}.${columna}`);
          continue;
        }
        if (spec.label === columna || spec.label.includes("_")) {
          filtran.push(`${tabla}.${columna} → "${spec.label}"`);
        }
      }
    }

    expect(
      faltan,
      `Sin rótulo en lib/activity/fields.ts: ${faltan.join(", ")}`,
    ).toEqual([]);
    expect(
      filtran,
      `Estos rótulos enseñan el nombre de la columna: ${filtran.join(", ")}`,
    ).toEqual([]);
  });

  it("todo campo oculto declara por qué lo está", () => {
    const ocultosSinRazon: string[] = [];

    for (const [tabla, columnas] of Object.entries(FIELDS)) {
      for (const [columna, spec] of Object.entries(columnas)) {
        if (spec.kind === "hidden" && !HIDDEN_REASON[`${tabla}.${columna}`]) {
          ocultosSinRazon.push(`${tabla}.${columna}`);
        }
      }
    }

    // Un campo se oculta por una razón que se puede leer —una credencial, un
    // duplicado, una estructura sin forma—, nunca porque estorbaba.
    expect(ocultosSinRazon).toEqual([]);
  });

  it("toda referencia apunta a una tabla que existe", () => {
    const rotas: string[] = [];

    for (const [tabla, columnas] of Object.entries(FIELDS)) {
      for (const [columna, spec] of Object.entries(columnas)) {
        if (spec.kind !== "reference") continue;
        if (!spec.references) {
          rotas.push(`${tabla}.${columna} sin destino`);
          continue;
        }
        const existe = sql(`select to_regclass('${spec.references}') is not null;`);
        if (existe !== "t") rotas.push(`${tabla}.${columna} → ${spec.references}`);
      }
    }

    expect(rotas).toEqual([]);
  });

  it("toda tabla auditada se nombra en una frase, no como «un registro»", () => {
    const sinSujeto = tablas.filter((tabla) => !(tabla in SUBJECTS_FOR_TESTS));

    expect(
      sinSujeto,
      `Sin sujeto en lib/activity/describe.ts: ${sinSujeto.join(", ")}`,
    ).toEqual([]);
  });
});
