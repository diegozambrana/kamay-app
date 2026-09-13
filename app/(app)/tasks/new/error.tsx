"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function TasksNewError(props: RouteErrorProps) {
  return <RouteError title="Nueva tarea" {...props} />;
}
