import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { MyTasksScreen } from "@/features/tasks/my-tasks/my-tasks-screen";
import type { PendingTask } from "@/features/tasks/my-tasks/pending-row";
import { getSessionContext } from "@/lib/auth/session-context";
import { todayInTimezone } from "@/lib/orders/overdue";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { TaskService } from "@/services/tasks/task-service";

export const metadata = { title: "Mis pendientes · Kamay" };

/**
 * V20 · Mis pendientes.
 *
 * En el celular es *la* pantalla de tareas —la tercera ranura de la barra
 * inferior lleva aquí y no al tablero (mapa §4.2)—: allí interesa «qué hago
 * hoy», no la vista de gestión.
 *
 * **Sin filtro de línea a propósito.** Es una de las dos únicas vistas que
 * ignoran el selector (mapa §2), así que esta página no lee la cookie de línea
 * y por eso tampoco puede equivocarse con ella.
 *
 * El alcance por rol lo aplicó la RLS al leer: el ayudante recibe solo las de
 * su línea y las asignadas a él, y aquí no se repite esa condición.
 */
export default async function MyTasksPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { supabase, organizationId, membership } = context;
  const timezone = membership.organization.timezone;

  // "Hoy" y "mañana" en la zona del taller y resueltos en el servidor: sin
  // esto, posponer a las 23:50 saltaría dos días y la agrupación cambiaría
  // según dónde estuviera el portátil.
  const today = todayInTimezone(timezone);
  const tomorrow = nextDay(today);

  const [tasks, lines] = await Promise.all([
    new TaskService(supabase).listPending(organizationId),
    new BusinessLineService(supabase).listActive(organizationId),
  ]);

  const lineById = new Map(lines.map((line) => [line.id, line]));

  const pending: PendingTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueAt ? task.dueAt.slice(0, 10) : null,
    statusId: task.statusId,
    lineName: lineById.get(task.businessLineId)?.name ?? "",
    lineColor: lineById.get(task.businessLineId)?.color ?? "zinc",
  }));

  return (
    <MainContainer
      title="Mis pendientes"
      description="Todas tus líneas, agrupadas por fecha."
    >
      <MyTasksScreen tasks={pending} today={today} tomorrow={tomorrow} />
    </MainContainer>
  );
}

/** El día siguiente a una fecha `YYYY-MM-DD`, sin salir de UTC. */
function nextDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}
