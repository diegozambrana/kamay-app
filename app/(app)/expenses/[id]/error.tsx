"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ExpensesIdError(props: RouteErrorProps) {
  return <RouteError title="Egreso" {...props} />;
}
