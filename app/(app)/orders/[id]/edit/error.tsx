"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrdersIdEditError(props: RouteErrorProps) {
  return <RouteError title="Editar pedido" {...props} />;
}
