import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

import { localSupabaseEnv } from "./fair-support";

/**
 * Apoyo de las pruebas de integración de KAM-17.
 *
 * **Aquí sí se usa la clave de servicio**, a diferencia del resto de las
 * pruebas de integración, y por la misma razón por la que la aplicación la
 * usa: `notifications` le revoca `insert` a `authenticated`, porque los avisos
 * los crea el generador y no una sesión (design D5). Probar la generación
 * exige recorrer ese camino, que es justamente el que importa.
 *
 * **No hay limpieza y no puede haberla**: el esquema revoca `delete` a todo el
 * mundo, service role incluido (convención nº 3). Por eso estas pruebas
 * comparan **deltas** —cuántos avisos aparecieron— y nunca valores absolutos,
 * igual que hacen las de KAM-12 con los totales de línea.
 */
export function adminClient(): SupabaseClient {
  const { url } = localSupabaseEnv();

  return createClient(url, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

function serviceRoleKey(): string {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fromEnv) return fromEnv;

  const output = execSync("supabase status -o env", { encoding: "utf8" });
  const key = output.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m)?.[1];

  if (!key) {
    throw new Error(
      "No se pudo resolver la clave de servicio local. ¿Está corriendo `supabase start`?",
    );
  }
  return key;
}

/** Cuántos avisos hay, con el filtro que se pida. Se usa para medir deltas. */
export async function countNotifications(
  admin: SupabaseClient,
  filters: { userId?: string; organizationId?: string; type?: string } = {},
): Promise<number> {
  let query = admin
    .from("notifications")
    .select("id", { count: "exact", head: true });

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId);
  }
  if (filters.type) query = query.eq("type", filters.type);

  const { count, error } = await query;
  if (error) throw new Error(`No se pudo contar avisos: ${error.message}`);

  return count ?? 0;
}

/** El identificador de una persona de la semilla, por su correo. */
export async function userIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`No se pudieron listar usuarios: ${error.message}`);

  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`No existe el usuario ${email} en la semilla.`);

  return user.id;
}
