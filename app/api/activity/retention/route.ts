import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/notifications/cron-auth";
import { reportError } from "@/lib/monitoring/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { retentionJobDeps, runRetentionJob } from "@/services/activity/retention-job";

/**
 * El trabajo programado de retención de la bitácora (KAM-22, agendado en
 * KAM-23): una vez al mes, desde `vercel.json`.
 *
 * Responde a `GET` porque es el método con el que llama el Cron de Vercel, con
 * `Authorization: Bearer $CRON_SECRET`. Como el resumen diario, corre con
 * service role —la convención nº 2 lo reserva a los trabajos programados— y por
 * eso lo primero es la credencial: sin ella no se lee ni una fila.
 *
 * Responde 500 si alguna organización falló, aunque las demás se hayan
 * procesado: así el fallo se ve también en el registro del programador, además
 * de en el monitoreo.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runRetentionJob(retentionJobDeps(createAdminClient()));
    return NextResponse.json(result, { status: result.failed.length > 0 ? 500 : 200 });
  } catch (error) {
    // Ni siquiera se pudo leer la lista de organizaciones.
    reportError(error, { job: "activity-retention" });
    return NextResponse.json({ error: "La retención no pudo empezar." }, { status: 500 });
  }
}
