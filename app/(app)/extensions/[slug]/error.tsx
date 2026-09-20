"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ExtensionsSlugError(props: RouteErrorProps) {
  return <RouteError title="Herramienta" {...props} />;
}
