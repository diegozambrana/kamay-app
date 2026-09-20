"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrderRequestDetailError(props: RouteErrorProps) {
  return <RouteError title="Solicitud" {...props} />;
}
