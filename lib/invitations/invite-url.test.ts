import { describe, expect, it } from "vitest";

import { inviteUrlFor } from "./invite-url";

describe("inviteUrlFor", () => {
  it("usa http en local y https en todo lo demás", () => {
    expect(inviteUrlFor("localhost:3010", "abc")).toBe("http://localhost:3010/auth/invite/abc");
    expect(inviteUrlFor("kamay.app", "abc")).toBe("https://kamay.app/auth/invite/abc");
  });
});
