import type { TaskInput } from "./schema";
import { suggestedDueDate } from "./suggested-due-date";

/** Lo que se sabe del pedido al abrir *Crear tarea para este pedido*. */
export type OrderContext = {
  id: string;
  code: number;
  businessLineId: string;
  /** Fecha comprometida en `YYYY-MM-DD`, o `null`. */
  dueDate: string | null;
  /** Nombre del cliente, para el contexto visible. Puede faltar. */
  customerName: string | null;
};

export type TaskPrefill = Pick<
  TaskInput,
  "title" | "businessLineId" | "dueDate" | "link"
> & {
  /** El cliente se muestra como contexto; no es un campo de la tarea. */
  customerName: string | null;
};

/**
 * Los valores iniciales del formulario de alta cuando se llega desde un pedido.
 *
 * Todo esto es una **propuesta**: el formulario los deja modificar, incluido
 * quitar el vínculo. La decisión de crear la tarea, y con qué, es siempre de la
 * persona — es la misma regla que impide que un pedido genere tareas solo
 * (convención nº 10).
 *
 * El cliente viaja como contexto y no como dato de la tarea: una tarea no tiene
 * cliente, lo tiene el pedido al que apunta. Copiarlo dentro convertiría el
 * vínculo en una copia, que es justamente lo que §6.3 prohíbe.
 */
export function prefillFromOrder(
  order: OrderContext,
  today: string,
): TaskPrefill {
  return {
    title: `Diseñar arte pedido #${order.code}`,
    businessLineId: order.businessLineId,
    dueDate: suggestedDueDate(order.dueDate, today),
    link: { entityType: "order", entityId: order.id },
    customerName: order.customerName,
  };
}
