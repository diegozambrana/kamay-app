#!/usr/bin/env node
/**
 * KAM-23 · La clave de service role no llega al navegador.
 *
 * Recorre, tras `npm run build`, todo lo que la compilación de producción sirve
 * al cliente —los recursos de `.next/static/`, `public/` con el service worker
 * compilado, y el HTML y las cargas RSC prerenderizadas— y falla si aparece la
 * clave. Una convención que nadie comprueba se rompe el día que alguien
 * antepone `NEXT_PUBLIC_` al nombre equivocado, y el fallo es silencioso y
 * total (design D14).
 *
 * Uso: `npm run check:bundle` (CI lo corre después del build).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { findServiceRoleLeaks } from "./client-bundle-secrets.mjs";

const ROOT = process.cwd();

/** Lo que se sirve al navegador, y con qué extensiones. */
const SERVED = [
  { dir: ".next/static", match: () => true },
  { dir: "public", match: () => true },
  // Las páginas prerenderizadas se sirven tal cual; el resto de
  // `.next/server` es código de servidor y no sale de él.
  { dir: ".next/server/app", match: (file) => /\.(html|rsc|body)$/.test(file) },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

function exists(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

if (!exists(join(ROOT, ".next/static"))) {
  console.error("No hay compilación que revisar: ejecuta `npm run build` primero.");
  process.exit(2);
}

const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY no está en el entorno: se buscan solo las formas reconocibles de la clave.",
  );
}

let scanned = 0;
const findings = [];

for (const { dir, match } of SERVED) {
  const base = join(ROOT, dir);
  if (!exists(base)) continue;
  for (const file of walk(base)) {
    if (!match(file)) continue;
    scanned += 1;
    const leaks = findServiceRoleLeaks(readFileSync(file, "latin1"), secret);
    if (leaks.length > 0) findings.push({ file: relative(ROOT, file), leaks });
  }
}

if (findings.length > 0) {
  console.error("La clave de service role aparece en archivos servidos al navegador:");
  for (const { file, leaks } of findings) console.error(`  ${file}: ${leaks.join(", ")}`);
  process.exit(1);
}

console.log(`Sin rastro de la clave de service role en ${scanned} archivos servidos al navegador.`);
