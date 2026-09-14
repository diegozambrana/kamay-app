"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function OrganizationDetailError(props: RouteErrorProps) {
  return <RouteError title="Organización" {...props} />;
}
