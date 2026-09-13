"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ReportsError(props: RouteErrorProps) {
  return <RouteError title="Reportes" {...props} />;
}
