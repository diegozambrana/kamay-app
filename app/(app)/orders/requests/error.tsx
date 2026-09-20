"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrderRequestsError(props: RouteErrorProps) {
  return <RouteError title="Solicitudes de pedido" {...props} />;
}
