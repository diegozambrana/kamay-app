import { NextResponse } from "next/server";

import { describeEvent } from "@/lib/activity/describe";
import { buildDetail } from "@/lib/activity/diff";
import {
  EXPORT_HEADERS,
  MAX_EXPORT_ROWS,
  activityExportFilename,
  exportPeriodLabel,
} from "@/lib/activity/export";
import { parseFilters } from "@/lib/activity/filters";
import { getOwnerContext } from "@/lib/auth/session-context";
import { toCsv } from "@/lib/reports/csv";
import {
  ActivityService,
  PAGE_SIZE,
} from "@/services/activity/activity-service";
import { LabelService, resolveSearch } from "@/services/activity/label-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { OrganizationService } from "@/services/organization-service";
import { ALL_LINES } from "@/types";

/**
 * Exportación del resultado filtrado de la bitácora (KAM-22, design D6).
 *
 * Calcada de `app/(app)/reports/export/route.ts`: la misma guardia de dueño y
 * la misma decisión de **volver a ejecutar la lectura** con los parámetros de
 * la dirección en vez de serializar lo que quedó pintado. Serializar lo
 * pintado exportaría lo que hubiera en memoria y no lo que la base dice ahora,
 * y produciría un archivo que no es «el resultado filtrado».
 *
 * El serializador es el de KAM-20 —RFC 4180, BOM para Excel—: no se escribe un
 * segundo CSV al lado del que ya funciona.
 */
export async function GET(request: Request) {
  const context = await getOwnerContext();
  if (!context) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { supabase, organizationId } = context;
  const url = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(url.searchParams));

  const organization = await new OrganizationService(supabase).getById(
    organizationId,
  );
  const timezone = organization.timezone;

  const recordId = await resolveSearch(supabase, organizationId, filters.search);
  if (recordId === null && filters.search) {
    return csvOf(filters, [], organization, new Map(), new Map(), new Map());
  }

  // Se recorre por páginas hasta el techo, con el mismo cursor que la
  // pantalla: una sola consulta de cinco mil filas y una lista sin techo son
  // el mismo problema con distinto nombre.
  const activity = new ActivityService(supabase);
  const entries = [];
  let cursor: string | null = filters.cursor;

  while (entries.length <= MAX_EXPORT_ROWS) {
    const page = await activity.search(
      organizationId,
      { ...filters, cursor },
      { timezone, recordId, limit: PAGE_SIZE },
    );
    entries.push(...page.entries);
    cursor = page.nextCursor;
    if (!cursor) break;
  }

  // Se avisa **antes** de producir nada: un archivo recortado en silencio
  // parece completo, y quien lo abra no tendrá manera de saber que le faltan
  // eventos.
  if (entries.length > MAX_EXPORT_ROWS) {
    return NextResponse.json(
      {
        error: `El resultado supera las ${MAX_EXPORT_ROWS} filas que se pueden exportar de una vez. Acota el rango de fechas y vuelve a intentarlo.`,
      },
      { status: 413 },
    );
  }

  const labels = new LabelService(supabase);
  const [recordLabels, detailNames, actorNames, lines] = await Promise.all([
    labels.forRecords(organizationId, entries),
    labels.forDetails(organizationId, entries),
    labels.people(
      organizationId,
      entries.map((entry) => entry.actorId).filter((id) => id !== null),
    ),
    new BusinessLineService(supabase).listActive(organizationId),
  ]);

  return csvOf(
    filters,
    entries,
    organization,
    recordLabels,
    detailNames,
    actorNames,
    new Map(lines.map((line) => [line.id, line.name])),
  );
}

function csvOf(
  filters: ReturnType<typeof parseFilters>,
  entries: Awaited<ReturnType<ActivityService["search"]>>["entries"],
  organization: { timezone: string; currency: string },
  recordLabels: ReadonlyMap<string, string>,
  detailNames: ReadonlyMap<string, string>,
  actorNames: ReadonlyMap<string, string>,
  lineNames: ReadonlyMap<string, string> = new Map(),
): NextResponse {
  const csv = toCsv(
    {
      title: "Bitácora de actividad",
      period: exportPeriodLabel(filters),
      line:
        filters.line === ALL_LINES
          ? "Todas"
          : (lineNames.get(filters.line) ?? "Todas"),
    },
    {
      headers: [...EXPORT_HEADERS],
      rows: entries.map((entry) => {
        const actorName = entry.actorId
          ? (actorNames.get(entry.actorId) ?? null)
          : null;
        const recordLabel = recordLabels.get(entry.recordId) ?? null;

        const detail = buildDetail(entry.tableName, entry.changes, {
          timezone: organization.timezone,
          currency: organization.currency,
          names: detailNames,
        });

        return [
          entry.occurredAt,
          actorName ?? entry.actorLabel ?? "Alguien",
          describeEvent({
            action: entry.action,
            tableName: entry.tableName,
            actorName,
            actorLabel: entry.actorLabel,
            recordLabel,
          }),
          recordLabel ?? "",
          entry.businessLineId
            ? (lineNames.get(entry.businessLineId) ?? "")
            : "",
          entry.origin ?? "",
          // El detalle legible, no el `jsonb` crudo: quien abre este archivo
          // quiere leerlo, y el volcado en crudo es el de la retención.
          detail.kind === "purged"
            ? "Detalle liberado por la política de retención"
            : detail.rows
                .map((row) => `${row.label}: ${row.before} → ${row.after}`)
                .join(" · "),
        ];
      }),
    },
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${activityExportFilename(filters)}"`,
    },
  });
}
