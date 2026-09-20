import type { SupabaseClient } from "@supabase/supabase-js";

import { MembershipAdminService } from "@/services/platform/membership-admin-service";
import { OrganizationAdminService } from "@/services/platform/organization-admin-service";

import { signIn } from "./fair-support";
import { adminClient } from "./notifications-support";

/**
 * Apoyo de las pruebas de integración de KAM-27.
 *
 * **Cada prueba crea su propia organización**, con su dueña y su ayudante: la
 * base local es una sola para todas las sesiones y para la suite e2e, y nada
 * de aquí toca Geeko Store. Las cuentas se crean con la clave de servicio
 * (solo Auth); todo lo demás se hace **como esas cuentas**, por el mismo
 * camino que la aplicación: RLS decidiendo.
 */
const SUPER_ADMIN = { email: "superadmin@kamay.test", password: "kamay123" };
const PASSWORD = "kamay123";

function suffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
}

export type Workshop = {
  organizationId: string;
  owner: SupabaseClient;
  assistant: SupabaseClient;
};

export async function seedWorkshop(name: string): Promise<Workshop> {
  const service = adminClient();
  const admin = await signIn(SUPER_ADMIN);

  const organizationId = await new OrganizationAdminService(admin).create({
    name: `${name} ${suffix()}`,
    currency: "BOB",
    timezone: "America/La_Paz",
  });

  const accounts = await Promise.all(
    (["owner", "assistant"] as const).map(async (role) => {
      const email = `tools-${role}-${suffix()}@kamay.test`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`cuenta: ${error.message}`);
      await new MembershipAdminService(admin).assign(data.user.id, [
        { organizationId, role, displayName: role === "owner" ? "Dueña" : "Ayudante" },
      ]);
      return { role, email };
    }),
  );

  const [owner, assistant] = await Promise.all(
    accounts.map(({ email }) => signIn({ email, password: PASSWORD })),
  );
  return { organizationId, owner, assistant };
}

/** Las acciones registradas en la bitácora para una tabla, en orden. */
export async function loggedActions(
  owner: SupabaseClient,
  organizationId: string,
  table: string,
): Promise<string[]> {
  const { data, error } = await owner
    .from("activity_log")
    .select("action, id")
    .eq("organization_id", organizationId)
    .eq("table_name", table)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String(row.action));
}
