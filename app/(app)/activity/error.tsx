"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ActivityError(props: RouteErrorProps) {
  return <RouteError title="Bitácora de actividad" {...props} />;
}
