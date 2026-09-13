import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ws from "ws";

import type { RetentionService as RealRetentionService } from "@/services/activity/retention-service";

/**
 * KAM-23 · Los trabajos programados, llamados como los llaman sus
 * programadores: `GET` con `Authorization: Bearer $CRON_SECRET` (spec
 * `production-operations` → *Scheduled jobs run in production and only for
 * whoever holds their secret*).
 *
 * Escenarios: «A call without the secret is rejected», «A missing secret
 * closes the door», «One organization's failure does not stop the others».
 * «Retention runs on its schedule» se comprueba en producción (tarea 9.6);
 * aquí se comprueba que cada ruta programada tiene programador y `GET`: la
 * retención en `vercel.json`, el resumen diario en `pg_cron`.
 */

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  reportError: vi.fn(),
  retentionRun: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/monitoring/report-error", () => ({ reportError: mocks.reportError }));
vi.mock("@/services/activity/retention-service", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/activity/retention-service")>();
  return {
    ...real,
    // La rutina de cada organización la decide cada prueba.
    RetentionService: class {
      run(organizationId: string) {
        return mocks.retentionRun(organizationId);
      }
    },
  };
});

const SECRET = "secreto-de-prueba";

function localEnv() {
  const env = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) => env.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];
  const url = get("API_URL");
  const secret = get("SECRET_KEY") ?? get("SERVICE_ROLE_KEY");
  if (!url || !secret) throw new Error("¿Está corriendo `supabase start`?");
  return { url, secret };
}

function adminClient(fetchImpl?: typeof fetch): SupabaseClient {
  const { url, secret } = localEnv();
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

/** Un cliente cuyo Storage siempre falla: la exportación previa no se escribe. */
function brokenStorageClient(): SupabaseClient {
  return adminClient(async (input, init) =>
    String(input instanceof Request ? input.url : input).includes("/storage/v1/")
      ? new Response(JSON.stringify({ message: "disco lleno" }), { status: 500 })
      : fetch(input, init),
  );
}

function schedulerCall(path: string, authorization?: string) {
  return new Request(`http://localhost${path}`, {
    method: "GET",
    headers: authorization ? { authorization } : {},
  });
}

async function routes() {
  const [daily, retention] = await Promise.all([
    import("@/app/api/notifications/daily/route"),
    import("@/app/api/activity/retention/route"),
  ]);
  return [
    { path: "/api/notifications/daily", GET: daily.GET },
    { path: "/api/activity/retention", GET: retention.GET },
  ];
}

/** Una organización con eventos vencidos de verdad, envejecidos como sistema. */
async function agedOrganization(db: SupabaseClient, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await db.from("organizations").insert({ id, name });
  if (error) throw new Error(error.message);
  execSync(
    `psql "${process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres"}" -q -c ` +
      `"update activity_log set occurred_at = now() - interval '18 months' where organization_id = '${id}';"`,
    { stdio: "pipe" },
  );
  return id;
}

async function detailCount(db: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await db
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .not("changes", "is", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

let db: SupabaseClient;
let RetentionService: typeof RealRetentionService;

beforeAll(async () => {
  db = adminClient();
  ({ RetentionService } = await vi.importActual<
    typeof import("@/services/activity/retention-service")
  >("@/services/activity/retention-service"));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockImplementation(() => db);
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sin el secreto no corre nada", () => {
  it.each([
    ["sin credencial", undefined],
    ["con un secreto equivocado", "Bearer otro-secreto"],
    ["con el secreto sin su esquema", SECRET],
  ])("%s, los dos trabajos responden 401 sin tocar la base", async (_, authorization) => {
    for (const route of await routes()) {
      const response = await route.GET(schedulerCall(route.path, authorization));
      expect(response.status, route.path).toBe(401);
    }
    // Ni siquiera se construyó el cliente de service role.
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("sin secreto configurado se rechaza también al propio programador", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    for (const route of await routes()) {
      for (const authorization of ["Bearer undefined", "Bearer ", `Bearer ${SECRET}`]) {
        const response = await route.GET(schedulerCall(route.path, authorization));
        expect(response.status, `${route.path} · ${authorization}`).toBe(401);
      }
    }
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe("la retención mensual, organización por organización", () => {
  it("el fallo de una no detiene a las demás, se reporta y no vacía su detalle", async () => {
    // Dos organizaciones con detalle vencido, creadas en este orden: la que
    // falla se atiende antes que la otra, así que «las demás» incluye una
    // posterior al fallo.
    const failing = await agedOrganization(db, "Retención programada · falla");
    const healthy = await agedOrganization(db, "Retención programada · sana");
    const failingBefore = await detailCount(db, failing);
    expect(failingBefore).toBeGreaterThan(0);
    expect(await detailCount(db, healthy)).toBeGreaterThan(0);

    // Las dos de esta prueba corren la rutina real —una con Storage roto—; el
    // resto de la base local se atiende con una rutina vacía, para no vaciar
    // el detalle de las semillas que usan las demás pruebas.
    const attended: string[] = [];
    mocks.retentionRun.mockImplementation(async (organizationId: string) => {
      attended.push(organizationId);
      if (organizationId === failing) {
        return new RetentionService(brokenStorageClient()).run(organizationId);
      }
      if (organizationId === healthy) return new RetentionService(db).run(organizationId);
      return { exported: 0, purged: 0, exportPath: null, cutoff: "", months: 12 };
    });

    // Las que existen antes de la llamada: otros archivos de integración crean
    // organizaciones en paralelo, y una creada a mitad del trabajo puede o no
    // haber entrado en su lectura.
    const { data: before } = await db.from("organizations").select("id").is("archived_at", null);

    const { GET } = await import("@/app/api/activity/retention/route");
    const response = await GET(schedulerCall("/api/activity/retention", `Bearer ${SECRET}`));
    const body = await response.json();

    // El programador ve el fallo…
    expect(response.status).toBe(500);
    expect(body.failed).toEqual([{ organizationId: failing }]);

    // …y las demás se procesaron igual, incluida la posterior al fallo.
    expect(attended).toHaveLength(body.organizations);
    expect(new Set(attended).size).toBe(attended.length);
    expect(attended).toEqual(expect.arrayContaining((before ?? []).map((row) => row.id)));
    expect(attended.indexOf(healthy)).toBeGreaterThan(attended.indexOf(failing));
    expect(await detailCount(db, healthy)).toBe(0);

    // La que falló conserva todo su detalle.
    expect(await detailCount(db, failing)).toBe(failingBefore);

    // Y el fallo llegó al monitoreo con su organización, una sola vez.
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
      job: "activity-retention",
      organizationId: failing,
    });
    expect(String(mocks.reportError.mock.calls[0][0])).toMatch(/no se pudo escribir/i);
  }, 60_000);
});

describe("el programador llega a cada trabajo", () => {
  it("cada ruta programada tiene un programador y un GET que atender", async () => {
    const { crons } = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const migration = readFileSync(
      "supabase/migrations/20260913113818_daily_notifications_pg_cron.sql",
      "utf8",
    );
    const declared = await routes();

    // Ninguna ruta programada se queda sin programador: la retención en
    // `vercel.json`, el resumen diario en `pg_cron` porque el plan Hobby de
    // Vercel no admite la pasada horaria (KAM-23, tarea 10.4).
    const scheduled = [...crons.map((cron) => cron.path), ...(migration.match(/\/api\/[\w/-]+/g) ?? [])];

    for (const route of declared) {
      expect(scheduled, route.path).toContain(route.path);
      expect(typeof route.GET, route.path).toBe("function");
    }

    // La retención, una vez al mes.
    expect(crons.find((cron) => cron.path === "/api/activity/retention")?.schedule).toMatch(
      /^\d+ \d+ 1 \* \*$/,
    );

    // El resumen diario, cada hora.
    expect(migration).toMatch(/cron\.schedule\(\s*'kamay-daily-notifications',\s*'0 \* \* \* \*'/);

    // Y su credencial se lee del Vault en cada pasada, no está escrita aquí.
    expect(migration).toMatch(/'Bearer ' \|\| v\.decrypted_secret/);
    expect(migration).toMatch(/from vault\.decrypted_secrets v/);
  });
});
