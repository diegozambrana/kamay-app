import { afterAll, describe, expect, it } from "vitest";

import {
  findUserByEmail,
  grantPlatformAdmin,
  parseArgs,
  revokePlatformAdmin,
} from "../../scripts/platform-admin.mjs";

import { GEEKO, signIn } from "./fair-support";
import { adminClient } from "./notifications-support";

/**
 * KAM-26 · El script del operador, contra la base local de verdad (spec
 * `platform-administration` → *Only the operator grants and revokes platform
 * admin*).
 *
 * Escenarios: «The operator grants an existing account», «The operator grants
 * an email with no account», «Revoking takes effect on the next request».
 *
 * Toda cuenta que una prueba nombra se revoca al terminar: la base local es
 * compartida y un super admin olvidado ve todas las organizaciones.
 */

const PASSWORD = "kamay123";
const granted: string[] = [];

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@kamay.test`;
}

afterAll(async () => {
  const admin = adminClient();
  for (const email of granted) {
    await revokePlatformAdmin(admin, email).catch(() => {});
  }
});

// Cada prueba crea cuentas y entra con ellas: en CI pasa de los 5 s por omisión.
describe("scripts/platform-admin.mjs", { timeout: 30_000 }, () => {
  it("interpreta el comando, el correo y la nota", () => {
    expect(parseArgs(["grant", "a@b.c", "--note", "soporte"])).toEqual({
      command: "grant",
      email: "a@b.c",
      note: "soporte",
    });
    expect(parseArgs(["list"])).toEqual({ command: "list", email: undefined, note: undefined });
  });

  it("nombra super admin a una cuenta que ya existe", async () => {
    const admin = adminClient();
    const email = uniqueEmail("pa-existente");
    const { error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    expect(error).toBeNull();

    const result = await grantPlatformAdmin(admin, email, { note: "prueba" });
    granted.push(email);
    expect(result.created).toBe(false);

    const session = await signIn({ email, password: PASSWORD });
    const { data } = await session.rpc("is_platform_admin");
    expect(data).toBe(true);
  });

  it("crea la cuenta cuando no existe, y entra sin organización", async () => {
    const admin = adminClient();
    const email = uniqueEmail("pa-nueva");

    await expect(grantPlatformAdmin(admin, email)).rejects.toThrow(/PLATFORM_ADMIN_PASSWORD/);

    const result = await grantPlatformAdmin(admin, email, { password: PASSWORD });
    granted.push(email);
    expect(result.created).toBe(true);

    const session = await signIn({ email, password: PASSWORD });
    const { data: isAdmin } = await session.rpc("is_platform_admin");
    expect(isAdmin).toBe(true);

    const { data: memberships } = await session
      .from("memberships")
      .select("id")
      .eq("user_id", result.userId);
    expect(memberships).toEqual([]);
  });

  it("revocar surte efecto en la siguiente petición y archiva la fila", async () => {
    const admin = adminClient();
    const email = uniqueEmail("pa-revocada");
    const { userId } = await grantPlatformAdmin(admin, email, { password: PASSWORD });
    granted.push(email);

    const session = await signIn({ email, password: PASSWORD });
    const before = await session
      .from("organizations")
      .select("id")
      .eq("id", GEEKO.organizationId);
    expect(before.data).toHaveLength(1);

    await revokePlatformAdmin(admin, email);

    // La misma sesión, el mismo token: el acceso lo decide la tabla.
    const after = await session
      .from("organizations")
      .select("id")
      .eq("id", GEEKO.organizationId);
    expect(after.data).toEqual([]);

    const { data: row } = await admin
      .from("platform_admins")
      .select("archived_at")
      .eq("user_id", userId)
      .single();
    expect(row?.archived_at).not.toBeNull();

    await expect(revokePlatformAdmin(admin, email)).rejects.toThrow(/no es administrador/);
  });

  it("encuentra una cuenta por correo sin importar mayúsculas", async () => {
    const found = await findUserByEmail(adminClient(), "GEEKO@kamay.test");
    expect(found?.email).toBe("geeko@kamay.test");
  });
});
