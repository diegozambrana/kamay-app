import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sortByUrgency } from "@/lib/inventory/stock";
import type { ItemBalance } from "@/types";

/**
 * Un insumo bajo mínimo, listo para rendir: el saldo viene de la vista y el
 * nombre y la unidad del catálogo, unidos en la página.
 */
export type LowStockItem = ItemBalance & {
  name: string;
  unitCode: string | null;
};

/**
 * La tarjeta *Insumos bajo mínimo* del panel (V2), que hasta KAM-18 fue un
 * marcador —el último que le quedaba al panel—.
 *
 * Tres cosas que no son casuales:
 *
 * 1. **La ven los dos roles.** No contiene ningún importe, y es el ayudante
 *    quien está delante del estante: ocultarle qué se está acabando sería
 *    quitarle la información que necesita para trabajar.
 * 2. **El orden es por distancia relativa al mínimo**, no alfabético ni por
 *    saldo: 2 de 10 está peor que 40 de 50, y quien decide qué comprar
 *    necesita ese orden. La regla vive en `lib/inventory/stock.ts`.
 * 3. **La lista vacía se dice**, no se rinde como un cero. Aquí sí se sabe que
 *    no falta nada, que es justo lo que el marcador no podía afirmar.
 */
export function LowStockCard({ items }: { items: readonly LowStockItem[] }) {
  const rows = sortByUrgency([...items]) as LowStockItem[];

  return (
    <Card data-testid="low-stock-card">
      <CardHeader>
        <CardTitle>Insumos bajo mínimo</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún insumo está por debajo de su mínimo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="low-stock-list">
            {rows.map((row) => (
              <li key={row.itemId} className="flex items-baseline justify-between gap-3">
                {/* El panel es punto de partida, no destino: cada insumo abre
                    su detalle, donde están el conteo y el consumo. */}
                <Link
                  href={`/catalog/${row.itemId}`}
                  className="text-sm hover:underline"
                >
                  {row.name}
                </Link>
                <span className="text-sm tabular-nums text-muted-foreground">
                  <span className="text-destructive">{row.balance}</span>
                  {" / "}
                  {row.minStock}
                  {row.unitCode ? ` ${row.unitCode}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
