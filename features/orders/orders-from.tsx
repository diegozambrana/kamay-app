"use client";

import { createContext, useContext } from "react";

/**
 * La consulta actual de la pantalla de pedidos (vista y filtros), para que las
 * tarjetas y las filas la lleven como `?from=` al abrir un pedido (spec
 * `navigation-breadcrumbs`, design D2). Fuera de `OrdersScreen` vale "" y los
 * enlaces quedan limpios.
 */
const OrdersFromContext = createContext("");

export const OrdersFromProvider = OrdersFromContext.Provider;

export function useOrdersFrom(): string {
  return useContext(OrdersFromContext);
}
