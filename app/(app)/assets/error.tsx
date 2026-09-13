"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function AssetsError(props: RouteErrorProps) {
  return <RouteError title="Activos" {...props} />;
}
