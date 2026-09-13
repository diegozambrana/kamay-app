import type { SupabaseClient } from "@supabase/supabase-js";

import type { ArchiveEntry } from "@/lib/export/archive";
import { CSV_BOM, csvLine } from "@/lib/export/csv";
import { EXPORT_TABLES, type ExportTable } from "@/lib/export/tables";
import type { Role } from "@/types";

/** Cuántas filas se leen por vuelta. */
const READ_PAGE = 1000;

/** El bucket donde la rutina de retención deja la purga (KAM-22, design D8). */
const PURGE_BUCKET = "activity-exports";

type Row = Record<string, unknown>;

/** Una celda: JSON para lo estructurado, texto tal cual para `numeric`. */
function cell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

/**
 * La exportación completa de una organización (KAM-23, spec `data-export`,
 * design D5).
 *
 * **Con la sesión de quien la pide, nunca con la clave de servicio.** Lo que
 * sale es exactamente lo que RLS deja leer a esa persona: la otra
 * organización no aparece, y al ayudante no le salen las tablas que su rol no
 * lee (`ownerOnly`), igual que no le salen sus pantallas. La exportación no
 * reimplementa ningún permiso: los hereda.
 *
 * **Toda la tabla, sin tope.** A diferencia de la exportación filtrada de la
 * bitácora (KAM-22), que corta en 5.000 filas y lo avisa, esta es un respaldo,
 * y un respaldo cortado es peor que ninguno. Se lee por páginas y cada página
 * se entrega apenas llega, para que ni la función ni el archivo tengan que
 * contener la tabla entera.
 *
 * **Con la purga.** El detalle que la retención ya vació solo vive en las
 * exportaciones de `activity-exports`; a la persona dueña se le entregan tal
 * cual, dentro de `bitacora-purgada/`. La política que se lo permite es la de
 * `20260911100000_activity_exports_owner_read.sql`.
 */
export class ExportService {
  constructor(private readonly supabase: SupabaseClient) {}

  async *entries(organizationId: string, role: Role): AsyncGenerator<ArchiveEntry> {
    for (const table of EXPORT_TABLES) {
      if (table.ownerOnly && role !== "owner") continue;
      yield { name: `${table.file}.csv`, content: this.tableCsv(table, organizationId) };
    }

    if (role === "owner") yield* this.purgeExports(organizationId);
  }

  private async *tableCsv(table: ExportTable, organizationId: string): AsyncGenerator<string> {
    yield CSV_BOM + csvLine([...table.columns]) + "\r\n";

    for await (const rows of this.pages(table, organizationId)) {
      yield rows
        .map((row) => csvLine(table.columns.map((column) => cell(row[column]))) + "\r\n")
        .join("");
    }
  }

  /**
   * Las filas de una tabla, página a página, hasta agotarla.
   *
   * Por clave (`id > último`) donde hay `id`: saltar por desplazamiento en una
   * bitácora de cien mil eventos obliga a la base a recorrer lo que ya entregó
   * en cada vuelta. La tabla de unión sin `id` va por desplazamiento, que en
   * su tamaño no pesa.
   */
  private async *pages(table: ExportTable, organizationId: string): AsyncGenerator<Row[]> {
    // `organizations` es la organización misma: su filtro es su `id`.
    const scope = table.table === "organizations" ? "id" : "organization_id";
    const byKey = table.columns.includes("id");
    const select = table.columns.join(",");

    let lastId: unknown = null;
    let offset = 0;

    for (;;) {
      let query = this.supabase.from(table.table).select(select).eq(scope, organizationId);

      if (byKey) {
        if (lastId !== null) query = query.gt("id", lastId as string);
        query = query.order("id", { ascending: true }).limit(READ_PAGE);
      } else {
        query = query
          .order(table.columns[0], { ascending: true })
          .order(table.columns[1], { ascending: true })
          .range(offset, offset + READ_PAGE - 1);
      }

      const { data, error } = await query;
      if (error) throw new Error(`No se pudo exportar ${table.file}: ${error.message}`);

      const rows = (data ?? []) as unknown as Row[];
      if (rows.length === 0) return;
      yield rows;
      if (rows.length < READ_PAGE) return;

      if (byKey) lastId = rows[rows.length - 1].id;
      else offset += READ_PAGE;
    }
  }

  /**
   * Deja en la bitácora que esta persona exportó la organización. Lo escribe
   * `record_export()`, porque `activity_log` es inmutable para quien llama.
   */
  async recordExport(organizationId: string): Promise<void> {
    const { error } = await this.supabase.rpc("record_export", {
      p_organization: organizationId,
    });
    if (error) throw new Error(`No se pudo registrar la exportación: ${error.message}`);
  }

  /** Las exportaciones que la retención dejó en `activity-exports`, tal cual. */
  private async *purgeExports(organizationId: string): AsyncGenerator<ArchiveEntry> {
    const storage = this.supabase.storage.from(PURGE_BUCKET);
    const { data: files, error } = await storage.list(organizationId, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`No se pudo listar la bitácora purgada: ${error.message}`);

    for (const file of files ?? []) {
      // `list` también devuelve carpetas: no traen `id`.
      if (!file.id) continue;
      const { data: blob, error: downloadError } = await storage.download(
        `${organizationId}/${file.name}`,
      );
      if (downloadError || !blob) {
        throw new Error(`No se pudo leer ${file.name}: ${downloadError?.message ?? "vacío"}`);
      }
      yield {
        name: `bitacora-purgada/${file.name}`,
        content: new Uint8Array(await blob.arrayBuffer()),
      };
    }
  }
}
