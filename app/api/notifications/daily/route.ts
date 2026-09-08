import { NextResponse } from "next/server";

import { resolveMailer } from "@/lib/email/resolve";
import { isAuthorizedCron } from "@/lib/notifications/cron-auth";
import { hourInTimezone } from "@/lib/notifications/local-time";
import { planScheduled } from "@/lib/notifications/plan";
import type {
  PlannableMember,
  PlannableTask,
  StatusKind,
} from "@/lib/notifications/types";
import { todayInTimezone } from "@/lib/orders/overdue";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotificationGenerator } from "@/services/notifications/generator";
import { PreferenceService } from "@/services/notifications/preference-service";

/**
 * El trabajo programado de KAM-17: resumen diario, vencidas y estancadas.
 *
 * **Corre cada hora**, y en cada pasada atiende a quien eligió esa hora en la
 * zona local de su organización (design D4). Lo vencido y lo estancado no
 * dependen de ninguna hora elegida y se revisan en todas las pasadas.
 *
 * Hace tres cosas y en este orden: **leer, planificar, escribir**. Toda la
 * regla —la agrupación del resumen, el respeto de preferencias, el umbral de
 * estancamiento, que una tarea sin fecha no genere nada— vive en la función
 * pura `planScheduled()`, que no conoce ni la base ni el reloj. Aquí solo se
 * mueven datos.
 *
 * Es la única puerta del sistema que corre con service role, y por eso lo
 * primero que hace es comprobar su credencial.
 */
export async function POST(request: Request) {
  if (
    !isAuthorizedCron(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    // Sin credencial no se ejecuta nada: ni una lectura.
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const preferences = new PreferenceService(admin);
  const generator = new NotificationGenerator(admin, resolveMailer());
  const now = new Date();

  const { data: organizations, error } = await admin
    .from("organizations")
    .select("id, timezone")
    .is("archived_at", null)
    .overrideTypes<{ id: string; timezone: string }[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let created = 0;

  for (const organization of organizations ?? []) {
    created += await runForOrganization(
      { admin, preferences, generator },
      organization,
      now,
    );
  }

  return NextResponse.json({
    organizations: organizations?.length ?? 0,
    created,
  });
}

async function runForOrganization(
  deps: {
    admin: ReturnType<typeof createAdminClient>;
    preferences: PreferenceService;
    generator: NotificationGenerator;
  },
  organization: { id: string; timezone: string },
  now: Date,
): Promise<number> {
  const { admin, preferences, generator } = deps;

  const [{ data: members }, { data: tasks }] = await Promise.all([
    admin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .overrideTypes<{ user_id: string }[]>(),
    admin
      .from("tasks")
      .select(
        "id, organization_id, title, due_at, assignee_id, closed_at, updated_at, status:statuses!inner (kind)",
      )
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .is("closed_at", null)
      .overrideTypes<TaskWithStatus[]>(),
  ]);

  const userIds = (members ?? []).map((member) => member.user_id);
  if (userIds.length === 0) return 0;

  const resolved = await preferences.forOrganization(organization.id, userIds);

  const planned = planScheduled({
    organizationId: organization.id,
    today: todayInTimezone(organization.timezone, now),
    localHour: hourInTimezone(organization.timezone, now),
    tasks: (tasks ?? []).map(toPlannable),
    members: userIds.map(
      (userId): PlannableMember => ({
        userId,
        preferences: resolved.get(userId)!,
      }),
    ),
  });

  if (planned.length === 0) return 0;

  const created = await generator.emit(planned, {
    recipients: await emailsFor(admin, planned.map((n) => n.userId)),
    emailEnabled: new Map(
      [...resolved].map(([userId, prefs]) => [userId, prefs.emailEnabled]),
    ),
  });

  return created.length;
}

type TaskWithStatus = {
  id: string;
  organization_id: string;
  title: string;
  due_at: string | null;
  assignee_id: string | null;
  closed_at: string | null;
  /**
   * Cuándo se tocó por última vez. Es lo más cercano a «desde cuándo está en
   * este estado» que el modelo ofrece hoy: `tasks` no guarda esa marca, y el
   * único movimiento que actualiza la fila es precisamente el cambio de
   * estado o de campos. Sobreestima el movimiento —editar el título parece
   * un movimiento— y esa dirección es la correcta: es preferible callar de más
   * a llamar «estancada» a una tarea que alguien acaba de tocar.
   */
  updated_at: string;
  status: { kind: StatusKind } | null;
};

function toPlannable(row: TaskWithStatus): PlannableTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    dueDate: row.due_at ? row.due_at.slice(0, 10) : null,
    assigneeId: row.assignee_id,
    statusKind: row.status?.kind ?? "initial",
    statusSince: row.updated_at,
    closed: row.closed_at !== null,
  };
}

async function emailsFor(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();

  for (const userId of [...new Set(userIds)]) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data?.user?.email) emails.set(userId, data.user.email);
  }

  return emails;
}
