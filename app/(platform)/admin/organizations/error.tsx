"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrganizationsError(props: RouteErrorProps) {
  return <RouteError title="Organizaciones" {...props} />;
}
