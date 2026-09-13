"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ExpensesCostsNewError(props: RouteErrorProps) {
  return <RouteError title="Nuevo gasto" {...props} />;
}
