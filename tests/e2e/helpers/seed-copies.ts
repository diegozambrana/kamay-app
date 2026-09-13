import { execFileSync, execSync } from "node:child_process";

import { test } from "@playwright/test";

/**
 * Una copia de Geeko Store: la organización de la semilla, con sus líneas,
 * estados, catálogo, pedidos #1…#24, egresos, inventario y cobros, y con una
 * dueña y una ayudante propias (contraseña `kamay123`).
 */
export type GeekoCopy = {
  organizationId: string;
  /** La dueña de la copia —la `geeko@kamay.test` de la semilla—. */
  owner: string;
  /** La ayudante de la copia —la `ayudante@kamay.test` de la semilla—. */
  assistant: string;
};

/**
 * KAM-23 · Cada prueba trabaja sobre **su propia** Geeko Store (spec
 * `project-foundation` → *Tests do not interfere with each other*).
 *
 * Hasta aquí todas las suites compartían la Geeko de la semilla: una movía el
 * dinero del pedido #5, otra reordenaba la cola, otra restringía a la ayudante
 * a una línea, y la de al lado fallaba —o fallaba la segunda vuelta de la
 * misma—. Con una copia por prueba nada de eso cruza de una a otra, y las
 * pruebas pueden correr en paralelo y repetirse.
 *
 * La copia la hace `e2e.clone_geeko()` (supabase/seed.sql) a partir de la
 * misma definición que siembra Geeko, no de su estado actual: nace siempre
 * como la semilla. Lo mismo para Kamay Histórico y Kamay Rendimiento, más
 * abajo. Se crea al primer uso dentro de la prueba y se reutiliza
 * en esa prueba —dueña y ayudante son de la misma copia—.
 */
export function geeko(): GeekoCopy {
  return copyFor("geeko", testKey()) as GeekoCopy;
}

/**
 * La copia compartida por un bloque `describe.serial` cuyas pruebas dependen
 * unas de otras —la primera prepara, las siguientes comprueban—. El bloque
 * corre entero en un mismo worker y, si se reintenta, se reintenta entero:
 * con el reintento cambia la clave y el bloque empieza sobre una copia nueva.
 */
export function geekoForBlock(): GeekoCopy {
  const info = test.info();
  const block = info.titlePath.slice(0, -1).join(" › ");
  return copyFor(
    "geeko",
    `${info.project.name}|${block}|${info.repeatEachIndex}|${info.retry}`,
  ) as GeekoCopy;
}

/** Una organización de la semilla con una sola dueña. */
export type OwnerCopy = { organizationId: string; owner: string };

/**
 * La copia de Kamay Histórico de esta prueba: doce meses con un pedido por
 * línea y por mes, cobrado al mes siguiente (seed.sql, KAM-14). Es la que
 * afirma cifras exactas de los informes.
 */
export function historico(): OwnerCopy {
  return copyFor("historico", testKey());
}

/**
 * La copia de Kamay Rendimiento de esta prueba: un año de un taller real, con
 * 624 pedidos, 70 contactos y ~3.800 eventos (seeds/performance.sql).
 */
export function rendimiento(): OwnerCopy {
  return copyFor("rendimiento", testKey());
}

type Seed = "geeko" | "historico" | "rendimiento";

function testKey(): string {
  const info = test.info();
  return `${info.project.name}|${info.testId}|${info.repeatEachIndex}|${info.retry}`;
}

const copies = new Map<string, OwnerCopy>();

function copyFor(seed: Seed, key: string): OwnerCopy {
  let copy = copies.get(`${seed}|${key}`);
  if (!copy) {
    copy = clone(seed);
    copies.set(`${seed}|${key}`, copy);
  }
  return copy;
}

function clone(seed: Seed): OwnerCopy {
  // Por `psql` y no por la API: el esquema `e2e` no está expuesto, y así no
  // existe ninguna puerta por la que la aplicación pudiera llamarlo.
  const output = execFileSync(
    "psql",
    [databaseUrl(), "--no-psqlrc", "-At", "-c", `select e2e.clone_${seed}()`],
    { encoding: "utf8" },
  );
  return JSON.parse(output.trim()) as OwnerCopy;
}

let url: string | undefined;

function databaseUrl(): string {
  if (url) return url;
  url =
    process.env.SUPABASE_DB_URL ??
    execSync("supabase status -o env", { encoding: "utf8" }).match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
  if (!url) throw new Error("No se pudo resolver la base local: ¿está corriendo `supabase start`?");
  return url;
}
