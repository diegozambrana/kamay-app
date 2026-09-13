import { getSessionContext } from "@/lib/auth/session-context";
import { exportFilename, zipStream, type ArchiveEntry } from "@/lib/export/archive";
import { reportError } from "@/lib/monitoring/report-error";
import { todayInTimezone } from "@/lib/orders/overdue";
import { ExportService } from "@/services/export/export-service";

/**
 * La descarga de la exportación completa (KAM-23, design D5).
 *
 * Un Route Handler como los de informes y bitácora (KAM-20, KAM-22): devuelve
 * un archivo con sus cabeceras, escrito por flujo. Lee con la sesión de quien
 * lo pide —`getSessionContext()`, no el contexto de dueño—, porque la
 * exportación es de los dos roles y RLS decide qué sale para cada uno.
 */
export async function GET() {
  const context = await getSessionContext();
  if (!context) return new Response("Inicia sesión para exportar.", { status: 401 });

  const service = new ExportService(context.supabase);
  const { organization } = context.membership;

  /**
   * El evento de bitácora se escribe **al terminar**: una exportación que se
   * corta a medias no es una exportación. Y su fallo no deshace el archivo ya
   * entregado —la bitácora nunca frena una operación, especificación §11—:
   * se reporta y listo.
   */
  async function* withTrace(): AsyncGenerator<ArchiveEntry> {
    yield* service.entries(context!.organizationId, context!.membership.role);
    try {
      await service.recordExport(context!.organizationId);
    } catch (error) {
      reportError(error, { boundary: "exportación completa" });
    }
  }

  const filename = exportFilename(organization.name, todayInTimezone(organization.timezone));

  return new Response(zipStream(withTrace()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
