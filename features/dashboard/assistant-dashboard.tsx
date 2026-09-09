import { LowStockCard, type LowStockItem } from "./low-stock-card";
import { PendingTasksCard, type PendingCounts } from "./pending-tasks-card";
import { UpcomingDeliveries, type DeliveryItem } from "./upcoming-deliveries";

export type AssistantDashboardProps = {
  deliveries: readonly DeliveryItem[];
  today: string;
  /**
   * Los conteos del ayudante son los suyos: la RLS ya recortó las tareas a su
   * línea y a lo asignado a él antes de que se contaran.
   */
  pending: PendingCounts;
  lowStock: readonly LowStockItem[];
};

/**
 * V2 para el ayudante: qué hay que entregar y qué está pendiente.
 *
 * **Es un diseño propio, no el del dueño con piezas ocultas.** Esa es la
 * exigencia entera del criterio 4 del backlog, y de ahí salen las tres
 * decisiones de esta composición:
 *
 * 1. **Sin dinero, y no por omisión.** Este componente no recibe ninguna
 *    cifra: no hay una prop de importes que alguien pueda pasar por error.
 *    Y no es la única defensa —la vista de caja del mes le devuelve cero
 *    filas por su propia condición `is_owner`, así que tampoco podría
 *    obtenerlo por consulta directa (design D4)—.
 * 2. **Sin bitácora.** Ausente, no vacía: `activity_log` no le devuelve una
 *    fila y una sección rotulada y vacía sería peor que no tenerla.
 * 3. **Las entregas mandan.** Donde la persona dueña tiene cuatro tarjetas de
 *    dinero, aquí va lo único que el ayudante necesita saber al llegar: qué
 *    hay comprometido. Va a ancho completo y con más detalle —modo de entrega
 *    y línea— porque tiene el sitio que el dinero ocupaba, no porque sobre
 *    espacio.
 */
export function AssistantDashboard({
  deliveries,
  today,
  pending,
  lowStock,
}: AssistantDashboardProps) {
  return (
    <div data-testid="assistant-dashboard" className="flex flex-col gap-4">
      <UpcomingDeliveries deliveries={deliveries} today={today} emphasis />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PendingTasksCard counts={pending} />
        <LowStockCard items={lowStock} />
      </div>
    </div>
  );
}
