"use client";

import { useHydrateStore } from "@/components/providers/use-hydrate-store";
import { setBrowserMonitoringScope } from "@/lib/monitoring/report-error";
import { useOrganizationStore } from "@/stores/organization-store";
import type { MembershipWithOrganization, Organization } from "@/types";

/**
 * Hidrata `OrganizationStore` con la organización activa resuelta en el
 * servidor. `null` cuando un administrador de la plataforma no eligió ninguna
 * (KAM-26).
 */
export function OrganizationProvider({
  organization,
  memberships,
  children,
}: {
  organization: Organization | null;
  memberships: MembershipWithOrganization[];
  children: React.ReactNode;
}) {
  useHydrateStore(() => {
    useOrganizationStore.setState({ organization, memberships });
    // Cada reporte de error del navegador lleva la organización activa.
    setBrowserMonitoringScope(organization ? { organizationId: organization.id } : {});
  }, [organization, memberships]);

  return children;
}
