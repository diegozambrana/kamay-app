import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/** La contraseña común de desarrollo de `supabase/seed.sql`. */
export const E2E_PASSWORD = "kamay123";

/**
 * El cliente de service role del Supabase local, para **preparar** datos de
 * una prueba. Nunca para afirmar nada: lo que se comprueba se comprueba en el
 * navegador, con la sesión de la persona.
 */
export function adminClient(): SupabaseClient {
  const { url, secret } = localSupabase();
  return client(url, secret);
}

/**
 * Una persona con sesión, bajo RLS: para preparar un estado que la interfaz
 * no ofrece —archivar un pedido, por ejemplo— por el mismo camino que usaría
 * la acción del servidor, sin privilegio elevado.
 */
export async function signedInClient(email: string): Promise<SupabaseClient> {
  const session = anonClient();
  const { error } = await session.auth.signInWithPassword({
    email,
    password: E2E_PASSWORD,
  });
  if (error) throw new Error(`sesión de ${email}: ${error.message}`);
  return session;
}

/** Un cliente con la llave pública: entra como una persona, bajo RLS. */
function anonClient(): SupabaseClient {
  const { url, publishable } = localSupabase();
  return client(url, publishable);
}

function localSupabase() {
  const env = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) =>
    env.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];
  const url = get("API_URL");
  const secret = get("SECRET_KEY") ?? get("SERVICE_ROLE_KEY");
  const publishable = get("PUBLISHABLE_KEY") ?? get("ANON_KEY");
  if (!url || !secret || !publishable) {
    throw new Error("No se pudo resolver Supabase local.");
  }
  return { url, secret, publishable };
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node 20 no trae WebSocket nativo; realtime-js lo exige al construir.
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

export type FreshOrganization = {
  email: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  lineName: string;
};

const LINE_NAME = "Sublimación";

/**
 * Una organización recién creada y **vacía**: una línea, sus juegos de estados
 * por omisión y su dueña, sin un solo pedido, egreso ni tarea.
 *
 * Es lo que necesitan las pruebas del vacío inicial: la organización de Geeko
 * ya tiene datos, y esperar que otra siga vacía mientras las demás pruebas
 * corren en paralelo sería apostar. Cada llamada crea la suya.
 */
export async function createFreshOrganization(): Promise<FreshOrganization> {
  const admin = adminClient();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `vacia-${suffix}@kamay.test`;
  const organizationName = `Taller vacío ${suffix}`;

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (userError) throw new Error(`usuario: ${userError.message}`);

  const organizationId = await addOrganization(created.user.id, email, organizationName);
  return { email, userId: created.user.id, organizationId, organizationName, lineName: LINE_NAME };
}

/**
 * Una cuenta que puede entrar pero no pertenece a ninguna organización
 * (KAM-25): nunca la invitaron. Es lo que ve el aviso "sin organización".
 */
export async function createAccountWithoutOrganization(): Promise<{ email: string }> {
  const email = `sin-org-${Date.now()}-${Math.floor(Math.random() * 100_000)}@kamay.test`;
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`usuario: ${error.message}`);
  return { email };
}

/**
 * Otra organización, también vacía, para la misma dueña: quien pertenece a
 * dos organizaciones elige una al entrar (`/auth/select-org`).
 */
export async function addOrganizationFor(
  owner: FreshOrganization,
  organizationName: string,
): Promise<string> {
  return addOrganization(owner.userId, owner.email, organizationName);
}

async function addOrganization(userId: string, email: string, name: string): Promise<string> {
  const admin = adminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();
  if (orgError) throw new Error(`organización: ${orgError.message}`);

  const { error: membershipError } = await admin.from("memberships").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });
  if (membershipError) throw new Error(`membresía: ${membershipError.message}`);

  // La configuración la siembra la propia dueña, con su sesión y bajo RLS,
  // como lo haría desde V15: el service role ni siquiera tiene permiso de
  // escribir en las tablas de configuración.
  const owner = await signedInClient(email);
  const steps = [
    owner.from("business_lines").insert({
      organization_id: org.id,
      name: LINE_NAME,
      position: 1,
    }),
    owner.from("statuses").insert([
      { organization_id: org.id, flow: "order", name: "Registrado", kind: "initial", position: 1 },
      { organization_id: org.id, flow: "order", name: "Entregado", kind: "final", position: 2 },
      { organization_id: org.id, flow: "order", name: "Cancelado", kind: "cancelled", position: 3 },
      { organization_id: org.id, flow: "task", name: "Por hacer", kind: "initial", position: 1 },
      { organization_id: org.id, flow: "task", name: "Hecho", kind: "final", position: 2 },
    ]),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw new Error(`semilla: ${error.message}`);
  }

  return org.id;
}
