"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function UsersError(props: RouteErrorProps) {
  return <RouteError title="Usuarios" {...props} />;
}
