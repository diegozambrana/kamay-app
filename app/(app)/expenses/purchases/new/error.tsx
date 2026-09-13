"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ExpensesPurchasesNewError(props: RouteErrorProps) {
  return <RouteError title="Nueva compra" {...props} />;
}
