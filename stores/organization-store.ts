import { create } from "zustand";

import type { MembershipWithOrganization, Organization } from "@/types";

type OrganizationState = {
  organization: Organization | null;
  memberships: MembershipWithOrganization[];
  setOrganization: (
    organization: Organization | null,
    memberships: MembershipWithOrganization[],
  ) => void;
};

/** Organización activa y membresías del usuario (para el cambio de organización). */
export const useOrganizationStore = create<OrganizationState>()((set) => ({
  organization: null,
  memberships: [],
  setOrganization: (organization, memberships) =>
    set({ organization, memberships }),
}));
