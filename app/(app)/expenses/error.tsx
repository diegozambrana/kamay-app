"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ExpensesError(props: RouteErrorProps) {
  return <RouteError title="Egresos" {...props} />;
}
