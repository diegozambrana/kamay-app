"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function TasksIdError(props: RouteErrorProps) {
  return <RouteError title="Tarea" {...props} />;
}
