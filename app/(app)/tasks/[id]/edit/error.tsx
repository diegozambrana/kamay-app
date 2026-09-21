"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function TasksIdEditError(props: RouteErrorProps) {
  return <RouteError title="Editar tarea" {...props} />;
}
