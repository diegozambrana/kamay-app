"use client";

import { useEffect, useRef } from "react";

import { useOrganizationStore } from "@/stores/organization-store";
import type { MembershipWithOrganization, Organization } from "@/types";

/** Hidrata `OrganizationStore` con la organización activa resuelta en el servidor. */
export function OrganizationProvider({
  organization,
  memberships,
  children,
}: {
  organization: Organization;
  memberships: MembershipWithOrganization[];
  children: React.ReactNode;
}) {
  // Hidratación síncrona una sola vez, antes del primer render de los hijos.
  const hydrated = useRef<true | null>(null);
  if (hydrated.current == null) {
    hydrated.current = true;
    useOrganizationStore.setState({ organization, memberships });
  }

  useEffect(() => {
    useOrganizationStore.setState({ organization, memberships });
  }, [organization, memberships]);

  return children;
}
