import { notFound, redirect } from "next/navigation";

import { TaskDetail } from "@/features/tasks/detail/task-detail";
import { getSessionContext } from "@/lib/auth/session-context";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ContactService } from "@/services/catalog/contact-service";
import { ItemService } from "@/services/catalog/item-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { StatusService } from "@/services/configuration/status-service";
import { loadRecordHistory } from "@/services/activity/record-history";
import { TaskService } from "@/services/tasks/task-service";

export const metadata = { title: "Tarea · Kamay" };

/**
 * V18 · Detalle de tarea.
 *
 * Página delgada (design D8): carga la tarea, sus adjuntos ya firmados y su
 * historial, y se los pasa a los componentes de cliente. Firmar aquí evita que
 * el navegador pida quince firmas tras hidratar, y leer el historial aquí
 * evita una cascada sobre `activity_log` que para el ayudante devuelve vacío
 * de todos modos.
 *
 * En móvil ocupa la pantalla completa: `/tasks/[id]` está en las rutas donde
 * la barra inferior no se rinde.
 */
export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `close=<statusId>` abre el asistente de cierre (KAM-21, design D7). */
  searchParams: Promise<{ close?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;

  const tasks = new TaskService(context.supabase);
  // RLS decide qué tarea es alcanzable: una de otra organización —o de una
  // línea que el ayudante no ve— llega como `null` y la página no existe.
  const task = await tasks.getById(context.organizationId, id);
  if (!task) notFound();

  const statusService = new StatusService(context.supabase);

  const isOwner = context.membership.role === "owner";

  const [statuses, allStatuses, businessLines, assignees, history, links, deliverables] =
    await Promise.all([
      // El juego de la línea de ESTA tarea: es lo que puede ofrecerse como
      // destino al cambiar de estado desde el detalle.
      statusService.resolve(context.organizationId, task.businessLineId, "task"),
      // El estado actual puede estar archivado y no aparecer en el juego
      // vigente: se busca aparte para poder nombrarlo igualmente.
      statusService.listAllForFlow(context.organizationId, "task"),
      new BusinessLineService(context.supabase).listActive(context.organizationId),
      tasks.assignees(context.organizationId),
      // Un solo historial (convención nº 7): sale de `activity_log`. Para el
      // ayudante llega vacío por RLS, y el bloque lo dice sin dar error.
      // La misma lectura que `/activity` filtrada por esta tarea.
      loadRecordHistory(context.supabase, {
        organizationId: context.organizationId,
        tableName: "tasks",
        recordId: task.id,
        timezone: context.membership.organization.timezone,
        currency: context.membership.organization.currency,
      }),
      // Los vínculos se resuelven contra sus destinos al leer: nada de lo que
      // se muestra está copiado en `task_links` (D2). El activo se omite para
      // quien no es dueño (D9).
      tasks.links(context.organizationId, task.id, isOwner),
      tasks.deliverables(context.organizationId, task.id),
    ]);

  // Los buckets son privados: nada se muestra por URL pública, se firma cada
  // lectura, y en lote porque el panel necesita todas las miniaturas a la vez.
  const attachmentService = new AttachmentService(context.supabase);
  const files = await attachmentService.listForEntity(
    context.organizationId,
    "task",
    task.id,
  );
  const signed = await attachmentService.signedUrls(files);

  /**
   * Lo que los formularios de egreso del asistente necesitan y la tarea no
   * sabe: `create_expense` exige proveedor y líneas para una compra, y
   * categoría e importe para un gasto.
   *
   * Solo se cargan si hay un cierre en curso: la pantalla se abre muchas veces
   * al día y estas tres consultas solo sirven para el diálogo.
   */
  const closingStatusId = (await searchParams).close ?? null;

  const [suppliers, expenseCategories, supplies] = closingStatusId
    ? await Promise.all([
        new ContactService(context.supabase).list(context.organizationId, {
          role: "supplier",
        }),
        new ExpenseCategoryService(context.supabase).listActive(
          context.organizationId,
        ),
        new ItemService(context.supabase).list(context.organizationId, {
          kind: "supply",
        }),
      ])
    : [[], [], []];

  const assigneeNames = new Map(
    assignees.map((person) => [person.userId, person.displayName]),
  );

  // El estado actual puede haberse archivado: se añade al juego para que el
  // selector pueda nombrarlo en vez de aparecer vacío.
  const currentStatus = allStatuses.find((status) => status.id === task.statusId);
  const statusOptions =
    currentStatus && !statuses.some((status) => status.id === task.statusId)
      ? [...statuses, currentStatus]
      : statuses;

  return (
    <TaskDetail
      task={task}
      statuses={statusOptions}
      businessLines={businessLines}
      assignees={assignees}
      attachments={files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        uploadedByName: file.uploadedBy
          ? (assigneeNames.get(file.uploadedBy) ?? null)
          : null,
        url: signed.get(file.id) ?? null,
      }))}
      links={links}
      deliverables={deliverables}
      isOwner={isOwner}
      suppliers={suppliers.map((c) => ({ id: c.id, name: c.name }))}
      expenseCategories={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
      supplies={supplies.map((i) => ({ id: i.id, name: i.name }))}
      closingStatusId={closingStatusId}
      history={history}
      timezone={context.membership.organization.timezone}
    />
  );
}
