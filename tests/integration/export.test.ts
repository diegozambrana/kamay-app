import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ws from "ws";

import { zipStream } from "@/lib/export/archive";
import { EXPORT_TABLES } from "@/lib/export/tables";
import { ExportService } from "@/services/export/export-service";
import type { Role } from "@/types";

import { GEEKO, localSupabaseEnv, signIn } from "./fair-support";

/**
 * KAM-23 · La exportación completa contra la base local sembrada, con la
 * sesión de cada persona (spec `data-export`).
 *
 * Escenarios: *A full export produces every table the requester can read* →
 * «Every table is present in the export», «A large table is exported whole»,
 * «An empty table still appears»; *The export never exceeds what the
 * requester may read* → «Cross-organization data never leaks into an
 * export», «An assistant exports without cost information»; *The export
 * includes the activity detail already purged by retention* → «Purged detail
 * travels with the export».
 */

const PERFORMANCE = {
  organizationId: "10000000-0000-0000-0000-000000000005",
  owner: { email: "rendimiento@kamay.test", password: "kamay123" },
};
const TALLER = {
  organizationId: "10000000-0000-0000-0000-000000000001",
  owner: { email: "owner@kamay.test", password: "kamay123" },
};

const PURGE_FILE = `${PERFORMANCE.organizationId}/kam23-prueba-bitacora-hasta-2025-01-01.csv`;
const PURGE_CONTENT = "﻿evento,antes,después\r\nDueña editó el pedido #1,45.00,50.00\r\n";

async function exportFor(
  db: SupabaseClient,
  organizationId: string,
  role: Role,
): Promise<Record<string, string>> {
  return decode(await exportBytes(db, organizationId, role));
}

function decode(files: Record<string, Uint8Array>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([name, bytes]) => [name, strFromU8(bytes)]),
  );
}

async function exportBytes(
  db: SupabaseClient,
  organizationId: string,
  role: Role,
): Promise<Record<string, Uint8Array>> {
  const stream = zipStream(new ExportService(db).entries(organizationId, role));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const zip = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    zip.set(chunk, offset);
    offset += chunk.length;
  }
  return unzipSync(zip);
}

/**
 * Las filas de un CSV, RFC 4180: una descripción con comas o saltos viaja
 * entre comillas, y partir por coma a secas la descuadraría.
 */
function parseCsv(csv: string): string[][] {
  const text = csv.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) rows.push([...row, cell]);
  return rows;
}

/** Las filas de datos, sin el encabezado. */
function dataRows(csv: string): string[][] {
  return parseCsv(csv).slice(1);
}

function headers(csv: string): string[] {
  return parseCsv(csv)[0];
}

function admin(): SupabaseClient {
  const env = execSync("supabase status -o env", { encoding: "utf8" });
  const secret =
    env.match(/^SECRET_KEY="?([^"\n]+)"?$/m)?.[1] ??
    env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m)?.[1];
  if (!secret) throw new Error("No se pudo resolver la clave de servicio local.");
  return createClient(localSupabaseEnv().url, secret, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

let geekoOwner: Record<string, string>;
let geekoAssistant: Record<string, string>;
let performance: Record<string, string>;
let performanceRaw: Record<string, Uint8Array>;
let taller: Record<string, string>;
let performanceDb: SupabaseClient;

beforeAll(async () => {
  // La purga la escribe el sistema: se simula con la clave de servicio, como
  // lo haría `RetentionService.run()`.
  const { error } = await admin()
    .storage.from("activity-exports")
    .upload(PURGE_FILE, new Blob([PURGE_CONTENT], { type: "text/csv" }), { upsert: true });
  if (error) throw new Error(`No se pudo sembrar la purga: ${error.message}`);

  performanceDb = await signIn(PERFORMANCE.owner);
  [geekoOwner, geekoAssistant, performance, taller] = await Promise.all([
    signIn(GEEKO.owner).then((db) => exportFor(db, GEEKO.organizationId, "owner")),
    signIn(GEEKO.assistant).then((db) => exportFor(db, GEEKO.organizationId, "assistant")),
    exportBytes(performanceDb, PERFORMANCE.organizationId, "owner").then((raw) => {
      performanceRaw = raw;
      return decode(raw);
    }),
    signIn(TALLER.owner).then((db) => exportFor(db, TALLER.organizationId, "owner")),
  ]);
}, 120_000);

afterAll(async () => {
  await admin().storage.from("activity-exports").remove([PURGE_FILE]);
});

describe("exportación completa", () => {
  it("la dueña recibe un CSV por cada tabla, con sus encabezados", () => {
    for (const table of EXPORT_TABLES) {
      const csv = geekoOwner[`${table.file}.csv`];
      expect(csv, table.file).toBeDefined();
      expect(headers(csv), table.file).toEqual([...table.columns]);
    }
  });

  it("una tabla sin filas aparece igual, solo con sus encabezados", () => {
    // Taller Kamay no tiene egresos en la semilla.
    const csv = taller["egresos.csv"];
    expect(csv).toBeDefined();
    expect(dataRows(csv)).toEqual([]);
  });

  it("ninguna fila es de otra organización", () => {
    for (const table of EXPORT_TABLES) {
      const csv = geekoOwner[`${table.file}.csv`];
      const column = table.table === "organizations" ? "id" : "organization_id";
      const index = headers(csv).indexOf(column);
      for (const row of dataRows(csv)) {
        // El UUID de la organización, leído con el analizador RFC 4180.
        expect(row[index], table.file).toBe(GEEKO.organizationId);
      }
    }
  });

  it("el ayudante no recibe egresos, activos, bitácora ni invitaciones", () => {
    for (const file of ["egresos", "lineas-de-compra", "activos", "bitacora", "invitaciones"]) {
      expect(geekoAssistant[`${file}.csv`], file).toBeUndefined();
    }
    // Y sí lo que su rol lee.
    expect(geekoAssistant["pedidos.csv"]).toBeDefined();
    expect(Object.keys(geekoAssistant).some((name) => name.startsWith("bitacora-purgada/"))).toBe(
      false,
    );
  });

  it("una tabla de más de una página sale entera, sin tope", async () => {
    const { count, error } = await performanceDb
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", PERFORMANCE.organizationId);
    expect(error).toBeNull();
    expect(count).toBeGreaterThan(1000);

    expect(dataRows(performance["bitacora.csv"]).length).toBe(count);
  });

  it("la purga de la bitácora viaja intacta con la exportación de la dueña", () => {
    const name = `bitacora-purgada/${PURGE_FILE.split("/")[1]}`;
    // Byte a byte, con su BOM: se entrega tal como la retención la escribió.
    expect(performanceRaw[name]).toEqual(new TextEncoder().encode(PURGE_CONTENT));
  });

  it("el resumen de la llave de una invitación no sale nunca", () => {
    const columns = headers(geekoOwner["invitaciones.csv"]);
    expect(columns).not.toContain("token_hash");
    // Y el resto de la invitación sí: el correo, el rol, su vigencia.
    expect(columns).toEqual(expect.arrayContaining(["email", "role", "expires_at"]));
  });
});
