"use client";

import { RouteError, type RouteErrorProps } from "@/components/shared/route-error";

export default function ContactsError(props: RouteErrorProps) {
  return <RouteError title="Contactos" {...props} />;
}
