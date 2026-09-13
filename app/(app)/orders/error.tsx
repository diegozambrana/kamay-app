"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrdersError(props: RouteErrorProps) {
  return <RouteError title="Pedidos" {...props} />;
}
