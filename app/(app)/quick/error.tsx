"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function QuickError(props: RouteErrorProps) {
  return <RouteError title="Registro rápido" {...props} />;
}
