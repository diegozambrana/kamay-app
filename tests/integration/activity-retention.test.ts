import { execSync } from "node:child_process";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import ws from "ws";
import { beforeAll, describe, expect, it } from "vitest";

import { readRetentionMonths, retentionCutoff } from "@/lib/activity/retention";
import {
  EXPORTS_BUCKET,
  RetentionPolicyService,
  RetentionService,
  describeRun,
} from "@/services/activity/retention-service";

import { signIn } from "./fair-support";

/**
 * KAM-22 · La retención exporta, verifica y solo entonces vacía.
 *
 * Escenarios de `activity-retention`:
 *   § La purga exporta y verifica antes de vaciar el detalle → «Primero
 *     exporta, después vacía», «La rutina informa lo que hizo».
 *   § Si la exportación falla, no se vacía nada → «Exportación fallida,
 *     bitácora intacta», «Exportación no verificable, bitácora intacta».
 *   § Solo se vacían los eventos vencidos de la organización tratada → «Cada
 *     organización se rige por su propio plazo».
 *   § Un evento purgado se sigue leyendo → «Sigue en la lista y se lee», «El
 *     detalle ausente se declara».
 *   § La retención solo la ejecuta el sistema → «Un usuario no puede purgar»,
 *     «Nada se purga sin ejecutarla».
 *
 * Contra la base real y con el cliente de service role, porque eso es lo que
 * la rutina es: un trabajo del sistema. Lo que pgTAP no puede comprobar —que
 * la exportación ocurre **antes** y que un fallo suyo detiene todo— se
 * comprueba aquí, donde vive la orquestación.
 */

function adminClient(): SupabaseClient {
  const output = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) =>
    output.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];

  const url = process.env.SUPABASE_URL ?? get("API_URL");
  const key =
    process.env.SUPABASE_SECRET_KEY ?? get("SECRET_KEY") ?? get("SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("¿Está corriendo `supabase start`?");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

/** Una organización propia por prueba: nadie pisa la bitácora de nadie. */
async function seedOrganization(
  db: SupabaseClient,
  name: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await db.from("organizations").insert({ id, name });
  if (error) throw new Error(error.message);
  return id;
}

/**
 * Eventos vencidos de verdad: el trigger los fecha con `now()`, así que hay
 * que moverlos hacia atrás, y eso solo puede hacerlo el sistema.
 */
async function ageEvents(
  _db: SupabaseClient,
  organizationId: string,
  months: number,
): Promise<void> {
  // Como `postgres` y no con el cliente: ni `authenticated` ni `service_role`
  // pueden hacer `update` sobre `activity_log`, y está bien que así sea — es
  // exactamente la inmutabilidad que esta tarea no relaja. Envejecer los
  // eventos es andamiaje de prueba, no algo que la aplicación pueda hacer.
  execSync(
    `psql "${process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres"}" -q -c ` +
      `"update activity_log set occurred_at = now() - interval '${months} months' where organization_id = '${organizationId}';"`,
    { stdio: "pipe" },
  );
}

async function detailCount(
  db: SupabaseClient,
  organizationId: string,
): Promise<{ total: number; withDetail: number }> {
  const { data, error } = await db
    .from("activity_log")
    .select("id, changes")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { id: number; changes: unknown }[];
  return {
    total: rows.length,
    withDetail: rows.filter((row) => row.changes !== null).length,
  };
}

let db: SupabaseClient;

beforeAll(() => {
  db = adminClient();
});

describe("la retención exporta antes de vaciar", () => {
  // Escenario: Primero exporta, después vacía
  // Escenario: La rutina informa lo que hizo
  it("deja el archivo legible y solo entonces suelta el detalle", async () => {
    const org = await seedOrganization(db, "Retención integración A");
    await ageEvents(db, org, 18);

    const antes = await detailCount(db, org);
    expect(antes.withDetail).toBeGreaterThan(0);

    const run = await new RetentionService(db).run(org);

    // El archivo existe y trae una línea por evento exportado.
    const { data: file, error } = await db.storage
      .from(EXPORTS_BUCKET)
      .download(run.exportPath!);
    expect(error).toBeNull();

    const text = await file!.text();
    expect(text).toContain("Bitácora — detalle liberado por retención");
    expect(run.exported).toBe(antes.withDetail);
    expect(run.purged).toBe(antes.withDetail);

    // Y solo entonces el detalle está vacío.
    const despues = await detailCount(db, org);
    expect(despues.withDetail).toBe(0);

    // Escenario: El número de eventos no cambia (activity-log: No row ever disappears)
    expect(despues.total).toBe(antes.total);

    expect(describeRun(run)).toContain(`${run.exported} eventos exportados`);
    expect(describeRun(run)).toContain(EXPORTS_BUCKET);
  });

  // Escenario: Exportación fallida, bitácora intacta
  it("si la subida falla, no vacía nada", async () => {
    const org = await seedOrganization(db, "Retención integración B");
    await ageEvents(db, org, 18);
    const antes = await detailCount(db, org);

    // Un cliente cuyo Storage siempre falla: todo lo demás es el real.
    const roto = {
      ...db,
      from: db.from.bind(db),
      rpc: db.rpc.bind(db),
      storage: {
        from: () => ({
          upload: async () => ({ error: { message: "disco lleno" } }),
          download: async () => ({ data: null, error: { message: "no existe" } }),
        }),
      },
    } as unknown as SupabaseClient;

    await expect(new RetentionService(roto).run(org)).rejects.toThrow(
      /no se pudo escribir/i,
    );

    const despues = await detailCount(db, org);
    expect(despues).toEqual(antes);
  });

  // Escenario: Exportación no verificable, bitácora intacta
  it("si el archivo se sube pero está incompleto, tampoco vacía nada", async () => {
    const org = await seedOrganization(db, "Retención integración C");
    await ageEvents(db, org, 18);
    const antes = await detailCount(db, org);

    // Se sube bien y se descarga un archivo truncado: «se subió sin error» y
    // «está ahí y es legible» no son la misma afirmación.
    const truncado = {
      ...db,
      from: db.from.bind(db),
      rpc: db.rpc.bind(db),
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          download: async () => ({
            data: new Blob(["Bitácora\r\nPeriodo,x\r\nLínea,x\r\n\r\nEvento\r\n"]),
            error: null,
          }),
        }),
      },
    } as unknown as SupabaseClient;

    await expect(new RetentionService(truncado).run(org)).rejects.toThrow(
      /incompleta/i,
    );

    const despues = await detailCount(db, org);
    expect(despues).toEqual(antes);
  });
});

describe("el alcance de la purga", () => {
  // Escenario: Cada organización se rige por su propio plazo
  it("purgar una organización no toca la de al lado, ni con el mismo vencimiento", async () => {
    const tratada = await seedOrganization(db, "Retención integración D");
    const vecina = await seedOrganization(db, "Retención integración E");
    await ageEvents(db, tratada, 18);
    await ageEvents(db, vecina, 18);

    const vecinaAntes = await detailCount(db, vecina);
    await new RetentionService(db).run(tratada);

    expect(await detailCount(db, tratada)).toMatchObject({ withDetail: 0 });
    expect(await detailCount(db, vecina)).toEqual(vecinaAntes);
  });

  it("un plazo más largo que la historia no vacía nada", async () => {
    const org = await seedOrganization(db, "Retención integración F");
    await ageEvents(db, org, 6);
    await new RetentionPolicyService(db).save(org, { months: 24 });

    const antes = await detailCount(db, org);
    const run = await new RetentionService(db).run(org);

    expect(run.exported).toBe(0);
    expect(run.exportPath).toBeNull();
    expect(await detailCount(db, org)).toEqual(antes);
    expect(describeRun(run)).toContain("Nada que exportar");
  });

  it("cada organización usa su propio plazo guardado", async () => {
    const org = await seedOrganization(db, "Retención integración G");
    await new RetentionPolicyService(db).save(org, { months: 3 });

    expect(await new RetentionPolicyService(db).get(org)).toBe(3);
    // Y la lectura pura dice lo mismo que la base.
    const { data } = await db
      .from("organizations")
      .select("settings")
      .eq("id", org)
      .single();
    expect(readRetentionMonths((data as { settings: unknown }).settings)).toBe(3);
  });
});

describe("después de la purga", () => {
  // Escenario: Sigue en la lista y se lee
  // Escenario: El detalle ausente se declara
  it("el evento purgado sigue ahí con su autor, su acción y su fecha", async () => {
    const org = await seedOrganization(db, "Retención integración H");
    await ageEvents(db, org, 18);
    await new RetentionService(db).run(org);

    const { data, error } = await db
      .from("activity_log")
      .select("action, table_name, record_id, occurred_at, changes")
      .eq("organization_id", org);

    expect(error).toBeNull();
    const rows = (data ?? []) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.changes).toBeNull();
      expect(row.action).toBeTruthy();
      expect(row.table_name).toBeTruthy();
      expect(row.record_id).toBeTruthy();
      expect(row.occurred_at).toBeTruthy();
    }
  });
});

describe("quién puede purgar", () => {
  // Escenario: Un usuario no puede purgar
  //
  // Se comprueba el **efecto** y no el texto del error: PostgREST responde
  // «no encuentro la función» cuando el `execute` está revocado, porque
  // literalmente no la ve, y afirmar sobre ese mensaje sería atarse a un
  // detalle de PostgREST en vez de a la regla.
  it("ni el dueño autenticado consigue vaciar nada", async () => {
    const org = await seedOrganization(db, "Retención integración J");
    await ageEvents(db, org, 18);
    const antes = await detailCount(db, org);

    const owner = await signIn();
    const { error } = await owner.rpc("purge_activity_detail", {
      p_organization: org,
      p_cutoff: retentionCutoff(12),
    });

    expect(error).not.toBeNull();
    expect(await detailCount(db, org)).toEqual(antes);
  });

  // Escenario: Nada se purga sin ejecutarla
  it("el tiempo por sí solo no vacía nada", async () => {
    const org = await seedOrganization(db, "Retención integración I");
    await ageEvents(db, org, 36);

    // Vencidísimos, y nadie llamó a la rutina.
    const estado = await detailCount(db, org);
    expect(estado.withDetail).toBeGreaterThan(0);
  });
});
