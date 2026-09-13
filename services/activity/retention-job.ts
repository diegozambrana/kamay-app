import type { SupabaseClient } from "@supabase/supabase-js";

import { reportError } from "@/lib/monitoring/report-error";
import { OrganizationService } from "@/services/organization-service";

import { type RetentionRun, RetentionService, describeRun } from "./retention-service";

/** Lo que el trabajo mensual deja dicho de cada organización. */
export type RetentionJobResult = {
  organizations: number;
  succeeded: { organizationId: string; summary: string }[];
  failed: { organizationId: string }[];
};

type RetentionJobDeps = {
  /** Las organizaciones vivas, en el orden en que se atienden. */
  organizations: () => Promise<string[]>;
  /** La rutina de una organización: `RetentionService.run()`. */
  run: (organizationId: string) => Promise<RetentionRun>;
  report: typeof reportError;
};

/**
 * El trabajo mensual de retención: `RetentionService.run()` para cada
 * organización, **cada una en su propio `try`** (KAM-23, design D7).
 *
 * Una organización cuya exportación falla no deja sin retención a las demás, y
 * tampoco pierde nada: `run()` no vacía ningún detalle si la exportación no se
 * escribió y verificó, así que un fallo la deja exactamente como estaba hasta
 * el mes siguiente. El fallo va al monitoreo con la organización, nunca con el
 * contenido de su bitácora.
 */
export async function runRetentionJob(deps: RetentionJobDeps): Promise<RetentionJobResult> {
  const organizations = await deps.organizations();
  const result: RetentionJobResult = {
    organizations: organizations.length,
    succeeded: [],
    failed: [],
  };

  for (const organizationId of organizations) {
    try {
      const run = await deps.run(organizationId);
      result.succeeded.push({ organizationId, summary: describeRun(run) });
    } catch (error) {
      deps.report(error, { job: "activity-retention", organizationId });
      result.failed.push({ organizationId });
    }
  }

  return result;
}

/** Las dependencias reales: el cliente de service role del trabajo programado. */
export function retentionJobDeps(admin: SupabaseClient): RetentionJobDeps {
  const service = new RetentionService(admin);

  return {
    organizations: async () =>
      (await new OrganizationService(admin).listActiveForJobs()).map(
        (organization) => organization.id,
      ),
    run: (organizationId) => service.run(organizationId),
    report: reportError,
  };
}
