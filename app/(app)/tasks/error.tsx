"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function TasksError(props: RouteErrorProps) {
  return <RouteError title="Tareas" {...props} />;
}
