/**
 * KAM-26 · Concede, retira y lista administradores de la plataforma.
 *
 * Es la **única** puerta: ninguna pantalla ni acción de la aplicación nombra
 * super admins (spec `platform-administration` → *Only the operator grants and
 * revokes platform admin*). Una cuenta super admin comprometida no puede
 * fabricar otras, porque la tabla no admite escrituras con sesión.
 *
 *   node scripts/platform-admin.mjs grant  <correo> [--note "motivo"]
 *   node scripts/platform-admin.mjs revoke <correo>
 *   node scripts/platform-admin.mjs list
 *
 * Si la cuenta no existe, `grant` la crea con la contraseña de
 * `PLATFORM_ADMIN_PASSWORD` —nunca como argumento, para que no quede en el
 * historial de la shell—. Revocar archiva la fila, no la borra, y surte
 * efecto en la siguiente petición de esa cuenta.
 *
 * **Usa la clave de servicio, y aquí sí corresponde** (ARCHITECTURE.md
 * §Supabase, design D10): es una herramienta del operador que corre fuera de
 * la aplicación, con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
 * del entorno. No importa `lib/supabase/admin.ts`, así que la frontera que
 * vigila `service-role-boundary.test.ts` no se mueve.
 */
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const PAGE_SIZE = 1000;

/** El cliente del operador, a partir del entorno. */
export function operatorClient(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node 20 no trae WebSocket nativo; realtime-js lo exige al construir.
    realtime: { transport: ws },
  });
}

/** La cuenta con ese correo, o `null`. La API de Auth no busca por correo. */
export async function findUserByEmail(admin, email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`No se pudieron leer las cuentas: ${error.message}`);
    const hit = data.users.find((user) => user.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < PAGE_SIZE) return null;
  }
}

/**
 * Nombra super admin a la cuenta del correo, creándola si hace falta.
 * Volver a conceder a un revocado reactiva su fila.
 */
export async function grantPlatformAdmin(admin, email, { password, note } = {}) {
  let user = await findUserByEmail(admin, email);
  let created = false;

  if (!user) {
    if (!password) {
      throw new Error(
        `No existe una cuenta con ${email}. Define PLATFORM_ADMIN_PASSWORD para crearla.`,
      );
    }
    if (password.length < 6) {
      throw new Error("La contraseña necesita al menos 6 caracteres.");
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    user = data.user;
    created = true;
  }

  const row = { user_id: user.id, archived_at: null, granted_at: new Date().toISOString() };
  if (note) row.note = note;

  const { error } = await admin.from("platform_admins").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`No se pudo registrar al administrador: ${error.message}`);

  return { userId: user.id, created };
}

/** Retira la condición de super admin: archiva la fila, nunca la borra. */
export async function revokePlatformAdmin(admin, email) {
  const user = await findUserByEmail(admin, email);
  if (!user) throw new Error(`No existe una cuenta con ${email}.`);

  const { data, error } = await admin
    .from("platform_admins")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("archived_at", null)
    .select("user_id");
  if (error) throw new Error(`No se pudo revocar: ${error.message}`);
  if (!data?.length) throw new Error(`${email} no es administrador de la plataforma.`);

  return { userId: user.id };
}

/** Los super admins vigentes, con su correo. */
export async function listPlatformAdmins(admin) {
  const { data, error } = await admin
    .from("platform_admins")
    .select("user_id, granted_at, note")
    .is("archived_at", null)
    .order("granted_at");
  if (error) throw new Error(`No se pudo leer el registro: ${error.message}`);

  const rows = [];
  for (const row of data) {
    const { data: found } = await admin.auth.admin.getUserById(row.user_id);
    rows.push({ email: found?.user?.email ?? row.user_id, grantedAt: row.granted_at, note: row.note });
  }
  return rows;
}

/** `--note "motivo"` → `{ note }`; lo demás son posicionales. */
export function parseArgs(argv) {
  const positional = [];
  let note;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--note") {
      note = argv[i + 1];
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  const [command, email] = positional;
  return { command, email, note };
}

const USAGE = `Uso:
  node scripts/platform-admin.mjs grant  <correo> [--note "motivo"]
  node scripts/platform-admin.mjs revoke <correo>
  node scripts/platform-admin.mjs list`;

async function main() {
  const { command, email, note } = parseArgs(process.argv.slice(2));
  const admin = operatorClient();

  if (command === "grant" && email) {
    const { created } = await grantPlatformAdmin(admin, email, {
      password: process.env.PLATFORM_ADMIN_PASSWORD,
      note,
    });
    console.log(
      created
        ? `${email}: cuenta creada y nombrada administradora de la plataforma.`
        : `${email}: ahora es administradora de la plataforma.`,
    );
  } else if (command === "revoke" && email) {
    await revokePlatformAdmin(admin, email);
    console.log(`${email}: ya no es administradora de la plataforma.`);
  } else if (command === "list") {
    const rows = await listPlatformAdmins(admin);
    if (rows.length === 0) console.log("No hay administradores de la plataforma.");
    for (const row of rows) {
      console.log(`${row.email}\tdesde ${row.grantedAt}${row.note ? `\t${row.note}` : ""}`);
    }
  } else {
    console.error(USAGE);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
