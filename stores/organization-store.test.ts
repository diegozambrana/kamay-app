import { beforeEach, describe, expect, it } from "vitest";

import { useOrganizationStore } from "@/stores/organization-store";

const ORG = {
  id: "o1",
  name: "Taller Kamay",
  logoPath: null,
  currency: "BOB",
  timezone: "America/La_Paz",
};
const MEMBERSHIPS = [
  {
    id: "m1",
    organizationId: "o1",
    role: "owner" as const,
    displayName: null,
    organization: ORG,
  },
];

describe("useOrganizationStore", () => {
  beforeEach(() => {
    useOrganizationStore.setState({ organization: null, memberships: [] });
  });

  it("starts empty", () => {
    expect(useOrganizationStore.getState().organization).toBeNull();
    expect(useOrganizationStore.getState().memberships).toEqual([]);
  });

  it("setOrganization stores the active organization and memberships", () => {
    useOrganizationStore.getState().setOrganization(ORG, MEMBERSHIPS);
    expect(useOrganizationStore.getState().organization).toEqual(ORG);
    expect(useOrganizationStore.getState().memberships).toHaveLength(1);
  });
});
