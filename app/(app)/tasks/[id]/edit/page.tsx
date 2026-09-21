import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { TaskForm } from "@/features/tasks/task-form";
import { getSessionContext } from "@/lib/auth/session-context";
import { originCrumb, withFrom } from "@/lib/tasks/list-href";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { TagService } from "@/services/tasks/tag-service";
import { TaskService } from "@/services/tasks/task-service";

export const metadata = { title: "Editar tarea · Kamay" };

/**
 * V18-edit · Edición de tarea (KAM-29).
 *
 * Reúne los datos que **describen** la tarea. Lo que se hace mientras se
 * trabaja —estado, cuerpo, casillas, adjuntos, vínculos y entregables— se
 * queda en el detalle y no se ofrece aquí.
 *
 * Página delgada: carga la tarea y los juegos de valores que el formulario
 * necesita. RLS decide qué tarea es alcanzable: una de otra organización —o de
 * una línea que el ayudante no ve— llega como `null` y la página no existe, ni
 * para leerla ni para editarla.
 *
 * En móvil ocupa la pantalla completa: `/tasks/[id]/edit` está en las rutas
 * donde la barra inferior no se rinde.
 */
export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `from` conserva la vista de origen (design D5). */
  searchParams: Promise<{ from?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;
  const { from } = await searchParams;

  const task = await new TaskService(context.supabase).getById(
    context.organizationId,
    id,
  );
  if (!task) notFound();

  const listCrumb = originCrumb(from);
  const detailHref = withFrom(`/tasks/${task.id}`, from);

  const breadcrumbs = [
    { label: listCrumb.label, href: listCrumb.href },
    { label: task.title, href: detailHref },
    { label: "Editar" },
  ];

  if (task.archivedAt) {
    return (
      <MainContainer
        breadcrumbs={breadcrumbs}
        title={task.title}
        description="Esta tarea está archivada."
      >
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Una tarea archivada no se edita</EmptyTitle>
            <EmptyDescription>
              Desarchívala desde el tablero, con «Ver archivados» activo, y
              vuelve a intentarlo.{" "}
              <Link href={detailHref} className="underline">
                Ver la tarea
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </MainContainer>
    );
  }

  const [lines, assignees, tags] = await Promise.all([
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new TaskService(context.supabase).assignees(context.organizationId),
    new TagService(context.supabase).listAll(context.organizationId),
  ]);

  return (
    <TaskForm
      mode="edit"
      task={{
        id: task.id,
        title: task.title,
        businessLineId: task.businessLineId,
        assigneeId: task.assigneeId,
        // El input nativo de fecha pide `YYYY-MM-DD`.
        dueDate: task.dueAt ? task.dueAt.slice(0, 10) : null,
        remindAt: task.remindAt,
        tagNames: task.tags.map((tag) => tag.name),
      }}
      lines={lines}
      assignees={assignees}
      tags={tags}
      from={from ?? null}
    />
  );
}
