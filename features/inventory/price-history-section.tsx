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

/**
 * Un precio pagado por este insumo, con su fecha y su proveedor.
 *
 * Sale de `expense_items` unida a su egreso. No hay tipo compartido para esto
 * en `types/`: es la forma de esta sección y de ninguna otra.
 */
export type PurchasePrice = {
  expenseId: string;
  unitPrice: number;
  occurredAt: string;
  supplierName: string | null;
};

/**
 * V11 · Evolución de precios de compra.
 *
 * **Solo la ve la persona dueña, y no por un `if` de rol.** La página consulta
 * `item_last_cost` y `expense_items`; para el ayudante RLS devuelve cero filas
 * —no tiene política de lectura sobre `expenses`—, así que el servidor
 * compone sin esta sección y nunca la envía (design D9).
 *
 * Por eso este componente no recibe `role` ni lo consulta: si está en pantalla
 * es porque había datos que mostrar.
 */
export function PriceHistorySection({
  prices,
  lastCost,
  timeZone,
}: {
  prices: PurchasePrice[];
  /** El último costo conocido, por fecha del hecho y no de registro. */
  lastCost: number | null;
  timeZone: string;
}) {
  return (
    <Card data-testid="item-price-history">
      <CardHeader>
        <CardTitle>Evolución de precios de compra</CardTitle>
      </CardHeader>
      <CardContent>
        {lastCost !== null && (
          <p className="mb-4 text-sm">
            <span className="text-muted-foreground">Último costo conocido: </span>
            <span className="font-medium tabular-nums" data-testid="last-cost">
              {lastCost.toFixed(2)}
            </span>
          </p>
        )}

        {prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este insumo todavía no se ha comprado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead>
                <TableHead className="text-right">Cuándo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((price) => (
                <TableRow key={price.expenseId}>
                  <TableCell>{price.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {price.unitPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <time dateTime={price.occurredAt}>
                      {formatDateTime(price.occurredAt, timeZone)}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
