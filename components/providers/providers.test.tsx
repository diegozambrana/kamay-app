import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OrganizationProvider } from "@/components/providers/organization-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";

const USER = { id: "u1", email: "owner@kamay.test" };
const MEMBERSHIP = {
  id: "m1",
  organizationId: "o1",
  role: "owner" as const,
  displayName: "Dueña",
};
const ORG = {
  id: "o1",
  name: "Taller Kamay",
  logoPath: null,
  currency: "BOB",
  timezone: "America/La_Paz",
};

describe("UserProvider", () => {
  beforeEach(() => {
    useUserStore.setState({ user: null, membership: null });
  });

  it("hydrates the user store from server props", () => {
    render(
      <UserProvider user={USER} membership={MEMBERSHIP}>
        <span>contenido</span>
      </UserProvider>,
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(useUserStore.getState().user).toEqual(USER);
    expect(useUserStore.getState().membership).toEqual(MEMBERSHIP);
  });
});

describe("OrganizationProvider", () => {
  beforeEach(() => {
    useOrganizationStore.setState({ organization: null, memberships: [] });
  });

  it("hydrates the organization store from server props", () => {
    render(
      <OrganizationProvider
        organization={ORG}
        memberships={[{ ...MEMBERSHIP, organization: ORG }]}
      >
        <span>contenido</span>
      </OrganizationProvider>,
    );
    expect(useOrganizationStore.getState().organization).toEqual(ORG);
    expect(useOrganizationStore.getState().memberships).toHaveLength(1);
  });
});
