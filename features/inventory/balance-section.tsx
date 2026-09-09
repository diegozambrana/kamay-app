"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Item, ItemBalance, Unit } from "@/types";

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
 */
export function BalanceSection({
  item,
  balance,
  unit,
  readOnly = false,
}: {
  item: Item;
  balance: ItemBalance;
  unit?: Unit;
  /** Un ítem archivado se mira, no se mueve. */
  readOnly?: boolean;
}) {
  const [consuming, setConsuming] = useState(false);
  const [counting, setCounting] = useState(false);

  const suffix = unit ? ` ${unit.code}` : "";

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

        {!readOnly && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setConsuming(true)}>
              Registrar consumo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCounting(true)}>
              Ajuste por conteo
            </Button>
          </div>
        )}

        <ConsumptionDialog
          open={consuming}
          onOpenChange={setConsuming}
          item={item}
        />
        <CountDialog
          open={counting}
          onOpenChange={setCounting}
          item={item}
          balance={balance.balance}
        />
      </CardContent>
    </Card>
  );
}
