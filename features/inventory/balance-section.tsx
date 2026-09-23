"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Item, ItemBalance, ItemVariant, Unit, VariantBalance } from "@/types";

import { ConsumptionDialog } from "./consumption-dialog";
import { CountDialog } from "./count-dialog";

/**
 * V11 · Saldo de un insumo.
 *
 * La cifra es siempre derivada: sale de `item_balances`, que la suma de los
 * movimientos. Ninguna columna la almacena, y por eso aquí no hay nada que
 * «refrescar» —lo que se ve es lo que suman los movimientos de al lado—.
 *
 * Es también la puerta de las dos acciones que el backlog pide en tres
 * interacciones o menos, y las dos son diálogos: registrar un consumo o un
 * conteo no puede sacar a nadie del insumo que está mirando (mapa §5).
 *
 * Con variantes (`catalog-custom-attributes`, design D7), muestra además el
 * saldo de cada una —de `item_variant_balances`, que también lo deriva— y cada
 * fila trae su consumo y su conteo con la variante puesta. El conteo del ítem
 * entero desaparece: con colores, «cuánto hay» se pregunta por color. El
 * mínimo sigue siendo del ítem, así que un color agotado no enciende la
 * alerta si el ítem está sobre su mínimo.
 */

/** La fila que se está contando: una variante o la fila «Sin variante». */
type CountTarget = { variant: ItemVariant | null; balance: number };

/** Lo que el detalle dice de los movimientos que no llevan variante. */
export const UNASSIGNED_VARIANT_LABEL = "Sin variante";
export function BalanceSection({
  item,
  balance,
  unit,
  readOnly = false,
  variants = [],
  variantBalances = [],
}: {
  item: Item;
  balance: ItemBalance;
  unit?: Unit;
  /** Un ítem archivado se mira, no se mueve. */
  readOnly?: boolean;
  /** Las variantes vigentes del ítem. */
  variants?: ItemVariant[];
  /** Los saldos de `item_variant_balances` para este ítem. */
  variantBalances?: VariantBalance[];
}) {
  const [consuming, setConsuming] = useState(false);
  const [consumingVariant, setConsumingVariant] = useState<ItemVariant | null>(null);
  const [counting, setCounting] = useState(false);
  const [countTarget, setCountTarget] = useState<CountTarget | null>(null);

  const suffix = unit ? ` ${unit.code}` : "";
  const activeVariants = variants.filter((variant) => variant.archivedAt === null);
  const hasVariants = activeVariants.length > 0;
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  // Las vigentes siempre; una archivada solo si todavía tiene saldo, que es
  // cuando alguien quiere saber dónde está ese número; «Sin variante», si hay.
  const rows = variantBalances.filter((row) => {
    if (row.variantId === null) return true;
    if (row.variantArchivedAt === null) return true;
    return row.balance !== 0;
  });

  return (
    <Card data-testid="item-balance">
      <CardHeader>
        <CardTitle>Saldo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-medium tabular-nums" data-testid="balance-value">
            {balance.balance}
            {suffix}
          </span>

          {balance.minStock !== null && (
            <span className="text-sm text-muted-foreground" data-testid="balance-min">
              Mínimo {balance.minStock}
              {suffix}
            </span>
          )}

          {/* La bandera la calcula la vista, no este componente: el panel, el
              catálogo y esta sección leen la misma y no pueden discrepar. */}
          {balance.belowMin && (
            <Badge variant="destructive" data-testid="balance-below-min">
              Bajo mínimo
            </Badge>
          )}
        </div>

        {/* Un saldo negativo se muestra tal cual, sin recortarlo a cero: dice
            que faltan entradas por registrar, y eso es información. */}
        {balance.balance < 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            El saldo está en negativo: faltan entradas por registrar. Un conteo
            lo deja en su sitio.
          </p>
        )}

        {hasVariants && rows.length > 0 && (
          <Table className="mt-4" data-testid="variant-balances">
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {!readOnly && <TableHead className="sr-only">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const variant = row.variantId ? variantById.get(row.variantId) ?? null : null;
                const archived = row.variantArchivedAt !== null;
                const label = row.variantId === null ? UNASSIGNED_VARIANT_LABEL : row.variantName;
                return (
                  <TableRow key={row.variantId ?? "unassigned"} data-testid="variant-balance-row">
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {label}
                        {archived && <Badge variant="secondary">Archivada</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums" data-testid="variant-balance-value">
                      {row.balance}
                      {suffix}
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="text-right">
                        {/* Solo una variante vigente se mueve; la fila «Sin
                            variante» solo se cuenta, para ponerla en su sitio. */}
                        {variant && !archived && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConsumingVariant(variant)}
                          >
                            Registrar consumo
                          </Button>
                        )}
                        {(row.variantId === null || (variant && !archived)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCountTarget({ variant, balance: row.balance })}
                          >
                            Ajustar
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!readOnly && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setConsuming(true)}>
              Registrar consumo
            </Button>
            {!hasVariants && (
              <Button size="sm" variant="outline" onClick={() => setCounting(true)}>
                Ajuste por conteo
              </Button>
            )}
          </div>
        )}

        <ConsumptionDialog
          open={consuming}
          onOpenChange={setConsuming}
          item={item}
          variants={activeVariants}
        />
        {consumingVariant && (
          <ConsumptionDialog
            key={consumingVariant.id}
            open
            onOpenChange={(open) => !open && setConsumingVariant(null)}
            item={item}
            variant={consumingVariant}
          />
        )}
        {!hasVariants && (
          <CountDialog
            open={counting}
            onOpenChange={setCounting}
            item={item}
            balance={balance.balance}
          />
        )}
        {countTarget && (
          <CountDialog
            key={countTarget.variant?.id ?? "unassigned"}
            open
            onOpenChange={(open) => !open && setCountTarget(null)}
            item={item}
            balance={countTarget.balance}
            variant={countTarget.variant}
            unassigned={countTarget.variant === null}
          />
        )}
      </CardContent>
    </Card>
  );
}
