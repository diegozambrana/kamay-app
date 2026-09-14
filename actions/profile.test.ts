import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const EMAIL = "marcela@geeko.test";

/** Estado que las dobles leen y escriben, reiniciado en cada prueba. */
const estado = vi.hoisted(() => ({
  haySesion: true,
  nombresGuardados: [] as { organizationId: string; displayName: string }[],
  falloNombre: null as Error | null,
  email: "marcela@geeko.test" as string | null,
  contraseñaValida: true,
  falloUpdateUser: null as { message: string } | null,
  revalidadas: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    estado.revalidadas.push(path);
  },
}));

const supabaseDouble = {
  auth: {
    getUser: async () => ({ data: { user: estado.email ? { email: estado.email } : null } }),
    updateUser: async () => ({
      error: estado.falloUpdateUser,
    }),
  },
};

vi.mock("@/lib/auth/session-context", () => ({
  getSessionContext: async () =>
    estado.haySesion
      ? {
          supabase: supabaseDouble,
          userId: USER,
          organizationId: ORG,
          membership: { role: "assistant" },
        }
      : null,
}));

vi.mock("@/lib/supabase/verify-password", () => ({
  verifyCurrentPassword: async () => estado.contraseñaValida,
}));

vi.mock("@/services/membership-service", () => ({
  MembershipService: class {
    async setOwnDisplayName(organizationId: string, displayName: string) {
      if (estado.falloNombre) throw estado.falloNombre;
      estado.nombresGuardados.push({ organizationId, displayName });
    }
  },
}));

const { updateDisplayName, changePassword } = await import("./profile");

beforeEach(() => {
  estado.haySesion = true;
  estado.nombresGuardados = [];
  estado.falloNombre = null;
  estado.email = EMAIL;
  estado.contraseñaValida = true;
  estado.falloUpdateUser = null;
  estado.revalidadas = [];
});

describe("updateDisplayName", () => {
  it("guarda el nombre recortado y revalida el layout", async () => {
    const result = await updateDisplayName({ displayName: "  Marcela Cruz  " });

    expect(result).toBeUndefined();
    expect(estado.nombresGuardados).toEqual([
      { organizationId: ORG, displayName: "Marcela Cruz" },
    ]);
    expect(estado.revalidadas).toContain("/");
  });

  it("rechaza un nombre vacío sin llamar al servicio", async () => {
    const result = await updateDisplayName({ displayName: "   " });

    expect(result).toEqual({ error: expect.stringContaining("Ingresa un nombre") });
    expect(estado.nombresGuardados).toHaveLength(0);
  });

  it("sin sesión no escribe nada", async () => {
    estado.haySesion = false;
    const result = await updateDisplayName({ displayName: "Marcela" });

    expect(result).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
    expect(estado.nombresGuardados).toHaveLength(0);
  });

  it("traduce el fallo del servicio a su mensaje de dominio", async () => {
    estado.falloNombre = new Error("No se pudo guardar el nombre. Intenta de nuevo.");
    const result = await updateDisplayName({ displayName: "Marcela" });

    expect(result).toEqual({
      error: "No se pudo guardar el nombre. Intenta de nuevo.",
    });
  });
});

describe("changePassword", () => {
  const input = { currentPassword: "vieja123", newPassword: "nueva123" };

  it("verifica la contraseña actual y actualiza la sesión", async () => {
    const result = await changePassword(input);

    expect(result).toBeUndefined();
    expect(estado.revalidadas).toContain("/");
  });

  it("rechaza una contraseña nueva demasiado corta sin verificar la actual", async () => {
    const result = await changePassword({ ...input, newPassword: "abc" });

    expect(result).toEqual({
      error: expect.stringContaining("al menos 6 caracteres"),
    });
  });

  it("la contraseña actual incorrecta rechaza sin llamar a updateUser", async () => {
    estado.contraseñaValida = false;
    const updateUserSpy = vi.spyOn(supabaseDouble.auth, "updateUser");

    const result = await changePassword(input);

    expect(result).toEqual({ error: "La contraseña actual no es correcta." });
    expect(updateUserSpy).not.toHaveBeenCalled();
    expect(estado.revalidadas).toHaveLength(0);
  });

  it("sin sesión no escribe nada", async () => {
    estado.haySesion = false;
    const result = await changePassword(input);

    expect(result).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
  });

  it("sin correo en la sesión pide volver a entrar", async () => {
    estado.email = null;
    const result = await changePassword(input);

    expect(result).toEqual({ error: "Tu sesión terminó. Vuelve a entrar." });
  });

  it("traduce el fallo de updateUser a un mensaje entendible", async () => {
    estado.falloUpdateUser = { message: "algo raro de Postgres" };
    const result = await changePassword(input);

    expect(result).toEqual({
      error: "No se pudo actualizar la contraseña. Intenta de nuevo.",
    });
  });
});
