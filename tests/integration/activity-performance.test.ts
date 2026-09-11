import { execSync } from "node:child_process";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import ws from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ActivityService } from "@/services/activity/activity-service";

import { signIn } from "./fair-support";

/**
 * KAM-22 · Cien mil eventos, respuesta bajo dos segundos.
 *
 * Escenario de `activity-screen` § La pantalla nunca carga la bitácora entera
 * → «Respuesta bajo dos segundos con cien mil eventos», y su otra mitad: que
 * la consulta se resuelva **por índice** y la paginación no recorra lo ya
 * leído (design D2, D3).
 *
 * El criterio 7 del backlog es verificable, no una aspiración. Esta prueba
 * siembra el volumen de verdad: sin él, medir no dice nada.
 */

const DB =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const EVENTOS = 100_000;
const TZ = "America/La_Paz";

const ORG = "10000000-0000-0000-0000-0000000000ff";
const CREDENCIALES = { email: "volumen@kamay.test", password: "kamay123" };

/** Lo asigna la API de administración al crear el usuario. */
let ownerId = "";

function adminClient(): SupabaseClient {
  const out = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (n: string) =>
    out.match(new RegExp(`^${n}="?([^"\n]+)"?$`, "m"))?.[1];

  return createClient(
    process.env.SUPABASE_URL ?? get("API_URL")!,
    process.env.SUPABASE_SECRET_KEY ?? get("SECRET_KEY") ?? get("SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws as unknown as typeof WebSocket },
    },
  );
}

/** Por la entrada estándar y no con `-c`: el SQL lleva saltos de línea. */
const sql = (query: string) =>
  execSync(`psql "${DB}" -tAq -v ON_ERROR_STOP=1 -f -`, {
    encoding: "utf8",
    input: query,
    maxBuffer: 32 * 1024 * 1024,
  }).trim();

const filtrosVacios = {
  from: null,
  to: null,
  line: "all",
  actor: "all",
  table: "all",
  action: "all",
  search: "",
  cursor: null,
} as const;

let db: SupabaseClient;

beforeAll(async () => {
  // La organización de volumen es propia y con su propio dueño: sembrar cien
  // mil eventos en Geeko dejaría el resto de las pruebas midiendo otra cosa.
  //
  // El usuario se crea por la API de administración y no con un `insert`
  // directo: hace falta que pueda **iniciar sesión**, y una fila en
  // `auth.users` sin contraseña cifrada no puede.
  const admin = adminClient();
  await admin.auth.admin.createUser({
    email: CREDENCIALES.email,
    password: CREDENCIALES.password,
    email_confirm: true,
  });

  const { data: usuarios } = await admin.auth.admin.listUsers();
  const owner = usuarios.users.find((u) => u.email === CREDENCIALES.email);
  if (!owner) throw new Error("No se pudo crear el usuario de volumen.");
  ownerId = owner.id;

  sql(`
    insert into organizations (id, name)
      values ('${ORG}', 'Volumen KAM-22')
      on conflict (id) do nothing;
    insert into memberships (organization_id, user_id, role)
      values ('${ORG}', '${ownerId}', 'owner')
      on conflict do nothing;
  `);

  const yaHay = Number(
    sql(`select count(*) from activity_log where organization_id = '${ORG}'`),
  );

  if (yaHay < EVENTOS) {
    // Directo a la tabla como `postgres`: el trigger escribe uno por
    // operación, y cien mil operaciones reales tardarían minutos.
    sql(`
      insert into activity_log
        (organization_id, business_line_id, actor_id, table_name, record_id,
         action, changes, origin, occurred_at)
      select '${ORG}',
             null,
             '${ownerId}',
             (array['orders','items','contacts','tasks','payments'])[1 + (g % 5)],
             gen_random_uuid(),
             (array['created','updated','status_changed','archived','unarchived'])[1 + (g % 5)],
             jsonb_build_object('name', jsonb_build_object('antes', 'a', 'despues', 'b' || g)),
             'desktop',
             now() - (g || ' minutes')::interval
        from generate_series(1, ${EVENTOS - yaHay}) g;
    `);
    sql(`analyze activity_log;`);
  }

  db = await signIn(CREDENCIALES);
}, 180_000);

afterAll(async () => {
  sql(`
    delete from activity_log where organization_id = '${ORG}';
    delete from memberships where organization_id = '${ORG}';
    delete from organizations where id = '${ORG}';
  `);
  if (ownerId) await adminClient().auth.admin.deleteUser(ownerId);
});

describe("cien mil eventos", () => {
  it("la organización de volumen tiene el volumen", () => {
    expect(
      Number(sql(`select count(*) from activity_log where organization_id = '${ORG}'`)),
    ).toBe(EVENTOS);
  });

  // Escenario: Respuesta bajo dos segundos con cien mil eventos
  it("la primera página responde en menos de dos segundos", async () => {
    const inicio = performance.now();
    const page = await new ActivityService(db).search(ORG, filtrosVacios, {
      timezone: TZ,
    });
    const ms = performance.now() - inicio;

    expect(page.entries).toHaveLength(50);
    expect(ms).toBeLessThan(2000);
  });

  it("cada filtro responde en menos de dos segundos", async () => {
    const casos = [
      { ...filtrosVacios, action: "archived" as const },
      { ...filtrosVacios, actor: ownerId },
      { ...filtrosVacios, table: "orders" },
      {
        ...filtrosVacios,
        from: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      },
    ];

    for (const filtros of casos) {
      const inicio = performance.now();
      await new ActivityService(db).search(ORG, filtros, { timezone: TZ });
      expect(performance.now() - inicio).toBeLessThan(2000);
    }
  });

  // La segunda mitad del escenario: por índice y por cursor, no por
  // desplazamiento ni por recorrido completo.
  it("la lista base se resuelve por índice, sin ordenación en memoria", () => {
    const plan = sql(`
      explain (analyze, buffers)
      select id from activity_log
       where organization_id = '${ORG}'
       order by occurred_at desc, id desc
       limit 51;
    `);

    expect(plan).toMatch(/Index (Only )?Scan/);
    expect(plan).not.toMatch(/Seq Scan on activity_log/);
    // Un `Sort` aquí significaría que el índice no da el orden y que el motor
    // ordena cien mil filas para devolver cincuenta.
    expect(plan).not.toMatch(/\bSort\b/);
  });

  it("el filtro por acción también usa índice", () => {
    const plan = sql(`
      explain (analyze)
      select id from activity_log
       where organization_id = '${ORG}' and action = 'archived'
       order by occurred_at desc, id desc
       limit 51;
    `);

    expect(plan).toMatch(/Index (Only )?Scan/);
    expect(plan).not.toMatch(/Seq Scan on activity_log/);
  });

  it("el cursor no recorre lo ya leído", async () => {
    const primera = await new ActivityService(db).search(ORG, filtrosVacios, {
      timezone: TZ,
    });
    expect(primera.nextCursor).not.toBeNull();

    const inicio = performance.now();
    const segunda = await new ActivityService(db).search(
      ORG,
      { ...filtrosVacios, cursor: primera.nextCursor },
      { timezone: TZ },
    );
    const ms = performance.now() - inicio;

    expect(segunda.entries).toHaveLength(50);
    expect(ms).toBeLessThan(2000);

    // Ni repite ni se salta: los identificadores no se solapan.
    const ids = new Set(primera.entries.map((e) => e.id));
    for (const entry of segunda.entries) expect(ids.has(entry.id)).toBe(false);
  });

  // Escenario: La primera página está acotada
  it("nunca se piden más de cincuenta y una filas, pase lo que pase", async () => {
    const page = await new ActivityService(db).search(ORG, filtrosVacios, {
      timezone: TZ,
      limit: 100_000,
    });

    expect(page.entries).toHaveLength(50);
  });
});
