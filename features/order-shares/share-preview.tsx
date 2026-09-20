import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCalendarDate } from "@/lib/format/datetime";
import type { OrderItemWithNames } from "@/services/orders/order-item-service";
import type { OrderWithTotal } from "@/services/orders/order-service";

/**
 * KAM-32 · «Así lo verá tu cliente» — la vista previa obligatoria antes de
 * activar un enlace (criterio de aceptación 2, design D9).
 *
 * Alimentada con los datos que el detalle del pedido ya cargó, sin ida y
 * vuelta a `resolve_order_share()`: es exactamente lo que esa función
 * devolvería, calculado del mismo modo — nunca costo, margen ni proveedor,
 * porque esos campos ni siquiera llegan hasta este componente.
 */
export function SharePreview({
  order,
  lines,
  statusName,
  businessLineName,
}: {
  order: OrderWithTotal;
  lines: OrderItemWithNames[];
  statusName: string;
  businessLineName: string;
}) {
  const balance = order.total - order.paid;

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Pedido #{order.code}</p>
        <p className="text-sm text-muted-foreground">{businessLineName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">{statusName}</Badge>
        {order.dueDate && (
          <span className="text-sm text-muted-foreground">
            Fecha comprometida: {formatCalendarDate(order.dueDate)}
          </span>
        )}
      </div>

      {lines.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  {line.itemName ?? line.description ?? "Sin detalle"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.unitPrice.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="tabular-nums font-medium">{order.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Pagado</span>
          <span className="tabular-nums">{order.paid.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Saldo</span>
          <span className="tabular-nums">{balance.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Sin costo, sin margen y sin ningún dato de otro pedido — es todo lo que ve
        el cliente.
      </p>
    </div>
  );
}
