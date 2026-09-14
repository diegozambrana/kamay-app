import { describe, expect, it } from "vitest";

import type { ActiveAccess } from "@/lib/auth/access";

import { profileView } from "./profile-view";

const organization = {
  id: "b",
  name: "Taller B",
  logoPath: null,
  currency: "BOB",
  timezone: "America/La_Paz",
};

const access = (overrides: Partial<ActiveAccess> = {}): ActiveAccess => ({
  organizationId: "b",
  organization,
  role: "owner",
  membership: null,
  platformAdmin: true,
  ...overrides,
});

describe("profileView", () => {
  it("dentro de una organización ajena: su nombre, acceso de plataforma y sin renombrar", () => {
    // Escenario «Profile inside a foreign organization».
    expect(profileView(access(), true)).toEqual({
      organizationName: "Taller B",
      roleLabel: "Administrador de la plataforma",
      canRename: false,
      displayName: null,
    });
  });

  it("sin organización activa: sin nombre de organización", () => {
    // Escenario «Profile without an active organization».
    expect(profileView(null, true)).toEqual({
      organizationName: null,
      roleLabel: "Administrador de la plataforma",
      canRename: false,
      displayName: null,
    });
  });

  it("con membresía en la organización activa puede renombrarse", () => {
    const view = profileView(
      access({
        membership: {
          id: "m1",
          organizationId: "b",
          role: "assistant",
          displayName: "Ana",
          organization,
        },
      }),
      true,
    );
    expect(view.canRename).toBe(true);
    expect(view.displayName).toBe("Ana");
  });

  it("para el resto, el rol de siempre", () => {
    const view = profileView(
      access({
        role: "assistant",
        platformAdmin: false,
        membership: {
          id: "m1",
          organizationId: "b",
          role: "assistant",
          displayName: "Ana",
          organization,
        },
      }),
      false,
    );
    expect(view.roleLabel).toBe("Ayudante");
    expect(view.canRename).toBe(true);
  });
});
