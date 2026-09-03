import { describe, expect, it } from "vitest";

import {
  defaultLandingPath,
  isProtectedPath,
  sanitizeNextPath,
} from "@/lib/auth/routes";

describe("isProtectedPath", () => {
  it("protects (app) routes and their subpaths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/quick")).toBe(true);
    expect(isProtectedPath("/dashboard/anything")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/lines")).toBe(true);
  });

  it("covers every section of the (app) group", () => {
    // Cada sección del grupo autenticado tiene que estar aquí: si falta, el
    // proxy deja pasar la petición y la única defensa es el layout.
    expect(isProtectedPath("/orders")).toBe(true);
    expect(isProtectedPath("/orders/a0000000-0000-0000-0000-000000000001")).toBe(
      true,
    );
    expect(isProtectedPath("/catalog")).toBe(true);
    expect(isProtectedPath("/catalog/90000000-0000-0000-0000-000000000011")).toBe(
      true,
    );
    expect(isProtectedPath("/contacts")).toBe(true);
  });

  it("leaves public routes unprotected", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/auth/login")).toBe(false);
    expect(isProtectedPath("/dashboardish")).toBe(false);
    expect(isProtectedPath("/orders-archive")).toBe(false);
  });
});

describe("sanitizeNextPath", () => {
  it("accepts internal paths", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/quick?tab=1")).toBe("/quick?tab=1");
  });

  it("rejects empty or missing values", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath("")).toBeNull();
  });

  it("rejects open redirects", () => {
    expect(sanitizeNextPath("https://evil.test")).toBeNull();
    expect(sanitizeNextPath("//evil.test")).toBeNull();
    expect(sanitizeNextPath("/\\evil.test")).toBeNull();
    expect(sanitizeNextPath("dashboard")).toBeNull();
  });

  it("rejects auth routes to avoid redirect loops", () => {
    expect(sanitizeNextPath("/auth/login")).toBeNull();
    expect(sanitizeNextPath("/auth/select-org")).toBeNull();
  });
});

describe("defaultLandingPath", () => {
  const IPHONE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const ANDROID_UA =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  const DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  it("sends mobile user agents to /quick", () => {
    expect(defaultLandingPath(IPHONE_UA)).toBe("/quick");
    expect(defaultLandingPath(ANDROID_UA)).toBe("/quick");
  });

  it("sends desktop (and unknown) user agents to /dashboard", () => {
    expect(defaultLandingPath(DESKTOP_UA)).toBe("/dashboard");
    expect(defaultLandingPath(null)).toBe("/dashboard");
    expect(defaultLandingPath("")).toBe("/dashboard");
  });
});
