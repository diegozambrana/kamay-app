import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/datetime";
import { movementLabel, signedQuantity, sortByRecency } from "@/lib/inventory/movements";
import type { InventoryMovement } from "@/types";

/**
 * V11 · Movimientos de un insumo.
 *
 * Es la sección que resuelve el flujo F de la especificación —«este número no
 * cuadra»—: cada entrada, consumo y ajuste con su cantidad, su origen y su
 * fecha, para poder encontrar el consumo anotado dos veces.
 *
 * No hay acciones de fila. Un movimiento no se edita ni se archiva, y ofrecer
 * un botón que la base va a rechazar sería mentir sobre lo que se puede hacer:
 * la corrección es un ajuste nuevo, y ese botón está en el saldo, arriba.
 */
export function MovementsSection({
  movements,
  timeZone,
  hasMore = false,
}: {
  movements: InventoryMovement[];
  /** Zona horaria de la organización: la historia se cuenta en hora del taller. */
  timeZone: string;
  /** Hay más páginas de las que caben aquí. */
  hasMore?: boolean;
}) {
  const rows = sortByRecency(movements);

  return (
    <Card data-testid="item-movements">
      <CardHeader>
        <CardTitle>Movimientos</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay movimientos de este insumo.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Qué pasó</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Cuándo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">
                      {movementLabel(movement)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {signedQuantity(movement)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <time dateTime={movement.occurredAt}>
                        {formatDateTime(movement.occurredAt, timeZone)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasMore && (
              <p className="mt-3 text-sm text-muted-foreground">
                Se muestran los más recientes. El historial completo está en la
                bitácora.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
