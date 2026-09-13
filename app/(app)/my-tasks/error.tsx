"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function MyTasksError(props: RouteErrorProps) {
  return <RouteError title="Mis pendientes" {...props} />;
}
