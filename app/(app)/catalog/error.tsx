"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function CatalogError(props: RouteErrorProps) {
  return <RouteError title="Catálogo" {...props} />;
}
