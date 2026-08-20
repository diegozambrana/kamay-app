import { beforeEach, describe, expect, it } from "vitest";

import { useUserStore } from "@/stores/user-store";

const USER = { id: "u1", email: "owner@kamay.test" };
const MEMBERSHIP = {
  id: "m1",
  organizationId: "o1",
  role: "owner" as const,
  displayName: "Dueña",
};

describe("useUserStore", () => {
  beforeEach(() => {
    useUserStore.setState({ user: null, membership: null });
  });

  it("starts empty", () => {
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().membership).toBeNull();
  });

  it("setUser stores user and membership", () => {
    useUserStore.getState().setUser(USER, MEMBERSHIP);
    expect(useUserStore.getState().user).toEqual(USER);
    expect(useUserStore.getState().membership).toEqual(MEMBERSHIP);
  });

  it("setUser can clear the session", () => {
    useUserStore.getState().setUser(USER, MEMBERSHIP);
    useUserStore.getState().setUser(null, null);
    expect(useUserStore.getState().user).toBeNull();
  });
});
