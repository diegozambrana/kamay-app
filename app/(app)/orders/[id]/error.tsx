"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrdersIdError(props: RouteErrorProps) {
  return <RouteError title="Pedido" {...props} />;
}
