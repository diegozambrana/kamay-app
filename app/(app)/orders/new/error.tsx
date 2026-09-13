"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrdersNewError(props: RouteErrorProps) {
  return <RouteError title="Nuevo pedido" {...props} />;
}
