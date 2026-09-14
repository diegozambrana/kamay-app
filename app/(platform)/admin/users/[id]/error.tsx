"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function UserDetailError(props: RouteErrorProps) {
  return <RouteError title="Cuenta" {...props} />;
}
