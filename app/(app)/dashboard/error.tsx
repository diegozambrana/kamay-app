"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function DashboardError(props: RouteErrorProps) {
  return <RouteError title="Panel" {...props} />;
}
