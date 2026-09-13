"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function CatalogIdError(props: RouteErrorProps) {
  return <RouteError title="Ítem" {...props} />;
}
