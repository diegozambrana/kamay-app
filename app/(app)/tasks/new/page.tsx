import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { lineCookieName } from "@/constants/auth";
import { TaskForm, type TaskFormPrefill } from "@/features/tasks/task-form";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { todayInTimezone } from "@/lib/orders/overdue";
import { prefillFromOrder } from "@/lib/tasks/prefill";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { OrderService } from "@/services/orders/order-service";
import { TagService } from "@/services/tasks/tag-service";
import { TaskService } from "@/services/tasks/task-service";
import { ALL_LINES } from "@/types";

export const metadata = { title: "Nueva tarea · Kamay" };

/**
 * Alta de tarea. Es lo que abre el destino *Tarea* del registro rápido y lo que
 * abre *Crear tarea para este pedido* desde el detalle del pedido.
 *
 * El contexto del pedido viaja por la dirección (`?orderId=`) y no por un
 * store: así el prellenado es enlazable y verificable sin montar la pantalla
 * anterior, y el formulario tiene una sola fuente de valores iniciales
 * (design D8).
 */
export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;

  const [lines, assignees, tags] = await Promise.all([
    new BusinessLineService(context.supabase).listActive(context.organizationId),
    new TaskService(context.supabase).assignees(context.organizationId),
    new TagService(context.supabase).listAll(context.organizationId),
  ]);

  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines,
  );

  let prefill: TaskFormPrefill = {
    businessLineId: activeLine === ALL_LINES ? undefined : activeLine,
  };

  if (params.orderId) {
    // Se lee el pedido con la sesión de quien pide: si no lo ve, no hay
    // prellenado que valga. RLS decide, no una comprobación de la aplicación.
    const order = await new OrderService(context.supabase).getById(
      context.organizationId,
      params.orderId,
    );

    if (order) {
      const customerName = order.contactId
        ? ((
            await new ContactService(context.supabase).findById(
              context.organizationId,
              order.contactId,
            )
          )?.name ?? null)
        : null;

      const fromOrder = prefillFromOrder(
        {
          id: order.id,
          code: order.code,
          businessLineId: order.businessLineId,
          dueDate: order.dueDate,
          customerName,
        },
        todayInTimezone(context.membership.organization.timezone),
      );

      prefill = {
        title: fromOrder.title,
        businessLineId: fromOrder.businessLineId,
        dueDate: fromOrder.dueDate,
        link: fromOrder.link,
        linkLabel: `el pedido #${order.code}`,
        customerName: fromOrder.customerName,
      };
    }
  }

  return (
    <MainContainer
      title="Nueva tarea"
      description="Con el título y la línea ya se guarda."
    >
      <TaskForm
        lines={lines}
        assignees={assignees}
        tags={tags}
        currentUserId={context.userId}
        prefill={prefill}
      />
    </MainContainer>
  );
}
