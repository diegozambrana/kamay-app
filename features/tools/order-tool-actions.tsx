"use client";

import { ToolOrderAction } from "@/features/tools/tool-components";

/**
 * KAM-27 · Las acciones de herramientas en el detalle del pedido (spec
 * `orders` → *El detalle del pedido ofrece las acciones de las herramientas
 * activas*).
 *
 * La lista llega **ya decidida por el servidor**: en el registro, activa para
 * la organización, con el enganche `order-detail` y al alcance del rol. Aquí
 * solo se monta. Lista vacía → no se pinta nada, ni un contenedor: el detalle
 * se ve exactamente como sin herramientas.
 */
export type OrderToolAction = {
  slug: string;
  /** Los parámetros guardados; cada herramienta los valida. */
  config: unknown;
};

export function OrderToolActions({
  orderId,
  currency,
  actions,
}: {
  orderId: string;
  currency: string;
  actions: readonly OrderToolAction[];
}) {
  if (actions.length === 0) return null;

  return (
    <>
      {actions.map((action) => (
        <ToolOrderAction
          key={action.slug}
          slug={action.slug}
          orderId={orderId}
          config={action.config}
          currency={currency}
        />
      ))}
    </>
  );
}
