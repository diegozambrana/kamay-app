import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { TasksScreen } from "@/features/tasks/board/tasks-screen";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { resolveQuickAddLine } from "@/lib/tasks/quick-add-line";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { StatusService } from "@/services/configuration/status-service";
import { TagService } from "@/services/tasks/tag-service";
import { TaskService } from "@/services/tasks/task-service";
import { ALL_LINES, type Status } from "@/types";

export const metadata = { title: "Tareas · Kamay" };

const VIEWS = ["board", "list", "calendar"] as const;
type View = (typeof VIEWS)[number];

/**
 * V17 · Tablero de tareas. Las columnas no están escritas en ninguna parte:
 * salen del juego de estados de la línea activa en el flujo `task`, resuelto
 * por la base con el mismo `resolve_statuses` que sirve a los pedidos.
 *
 * En el celular esta pantalla es alcanzable pero no es la puerta: la ranura
 * *Tareas* de la barra inferior lleva a *Mis pendientes* (mapa §4.2 y §11).
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    assignee?: string;
    tag?: string;
    status?: string;
    archived?: string;
  }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View)
    ? (params.view as View)
    : "board";
  const search = params.q ?? "";
  const assigneeId = params.assignee ?? "";
  const tagId = params.tag ?? "";
  const statusId = params.status ?? "";
  const includeArchived = params.archived === "1";

  const lines = await new BusinessLineService(context.supabase).listActive(
    context.organizationId,
  );

  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );
  const activeLineId = activeLine === ALL_LINES ? null : activeLine;

  // Con "Todas" activa no hay un juego único de columnas; el tablero pide
  // elegir línea, y lista y calendario sí cruzan todas.
  const statuses: Status[] = activeLineId
    ? await new StatusService(context.supabase).resolve(
        context.organizationId,
        activeLineId,
        "task",
      )
    : [];

  const allStatuses = await new StatusService(context.supabase).listAllForFlow(
    context.organizationId,
    "task",
  );

  const taskService = new TaskService(context.supabase);
  const [tasks, assignees, tags] = await Promise.all([
    taskService.listForBoard(context.organizationId, {
      businessLineId: activeLineId,
      assigneeId: assigneeId || undefined,
      tagId: tagId || undefined,
      statusId: statusId || undefined,
      search,
      includeArchived,
    }),
    taskService.assignees(context.organizationId),
    new TagService(context.supabase).listAll(context.organizationId),
  ]);

  const lineById = new Map(lines.map((line) => [line.id, line]));
  const assigneeNames = new Map(
    assignees.map((person) => [person.userId, person.displayName]),
  );

  // La línea del alta rápida: la activa, o la compartida cuando el selector
  // está en «Todas». Se resuelve en el servidor porque es donde están las
  // líneas, y viaja ya decidida (design D7).
  const quickAdd = resolveQuickAddLine(activeLine, lines);

  return (
    <TasksScreen
      tasks={tasks.map((task) => {
        const line = lineById.get(task.businessLineId);
        return {
          id: task.id,
          statusId: task.statusId,
          title: task.title,
          // La fecha llega como `YYYY-MM-DD`: el semáforo compara cadenas y no
          // debe reintroducir el huso horario por detrás.
          dueDate: task.dueAt ? task.dueAt.slice(0, 10) : null,
          closedAt: task.closedAt,
          assigneeName: task.assigneeId
            ? (assigneeNames.get(task.assigneeId) ?? null)
            : null,
          tags: task.tags,
          lineName: line?.name ?? "—",
          lineColor: line?.color ?? "zinc",
        };
      })}
      statuses={statuses}
      allStatuses={allStatuses}
      assignees={assignees}
      tags={tags}
      activeLineId={activeLineId}
      quickAddLineId={
        quickAdd.kind === "resolved" ? quickAdd.businessLineId : null
      }
      view={view}
      search={search}
      assigneeId={assigneeId}
      tagId={tagId}
      statusId={statusId}
      includeArchived={includeArchived}
      // "Hoy" en la zona horaria de la organización, no en la del navegador.
      today={todayInTimezone(context.membership.organization.timezone)}
    />
  );
}
