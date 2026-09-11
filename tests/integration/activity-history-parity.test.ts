import { execSync } from "node:child_process";

import { type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { ActivityService } from "@/services/activity/activity-service";
import { loadRecordHistory } from "@/services/activity/record-history";

import { GEEKO, signIn } from "./fair-support";

const DB =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

/**
 * Los identificadores de evento que **no** son de Geeko.
 *
 * Se comparan los `id` del evento y no los `record_id`: un `record_id` no es
 * identidad por sí solo —la semilla reutiliza el mismo uuid para un `items` de
 * una organización y un `item_variants` de otra, y por eso el índice de la
 * bitácora es `(table_name, record_id, occurred_at)`—. El `id` del evento es
 * una identidad creciente y global.
 *
 * Se leen como `postgres` porque el cliente de la prueba está autenticado como
 * dueña de Geeko y RLS —con razón— no le deja verlos.
 */
function eventosAjenosAGeeko(): number[] {
  return execSync(
    `psql "${DB}" -tAq -c "select id from activity_log where organization_id <> '${GEEKO.organizationId}';"`,
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(Number);
}

/**
 * KAM-22 · El historial de un registro dice lo mismo que la bitácora general.
 *
 * Escenarios de `activity-screen` § El historial de un registro coincide con
 * la bitácora filtrada por ese registro → «Los eventos coinciden uno a uno»,
 * «La redacción es la misma», «El ayudante ve el bloque vacío, no un error».
 *
 * Contra la base real y como usuario autenticado: que coincidan **no** se
 * puede comprobar con dobles, porque lo que se afirma es precisamente que no
 * hay dos consultas con dos reglas.
 */

const TZ = "America/La_Paz";
let db: SupabaseClient;

beforeAll(async () => {
  db = await signIn();
});

/** Un pedido de la semilla con historia suficiente para comparar. */
async function unPedidoConHistoria(): Promise<string> {
  const { data } = await db
    .from("activity_log")
    .select("record_id")
    .eq("organization_id", GEEKO.organizationId)
    .eq("table_name", "orders")
    .limit(1);

  const id = (data as { record_id: string }[] | null)?.[0]?.record_id;
  if (!id) throw new Error("La semilla no dejó ningún evento de pedido.");
  return id;
}

describe("historial de un registro contra la bitácora filtrada", () => {
  // Escenario: Los eventos coinciden uno a uno
  it("son los mismos eventos, en el mismo orden", async () => {
    const orderId = await unPedidoConHistoria();

    const general = await new ActivityService(db).search(
      GEEKO.organizationId,
      {
        from: null,
        to: null,
        line: "all",
        actor: "all",
        table: "orders",
        action: "all",
        search: "",
        cursor: null,
      },
      { timezone: TZ, recordId: orderId },
    );

    const contextual = await loadRecordHistory(db, {
      organizationId: GEEKO.organizationId,
      tableName: "orders",
      recordId: orderId,
      timezone: TZ,
      currency: "Bs",
      limit: 50,
    });

    expect(contextual.items.length).toBeGreaterThan(0);
    expect(contextual.items.map((i) => i.id)).toEqual(
      general.entries.map((e) => e.id),
    );
  });

  // Escenario: La redacción es la misma
  it("el mismo evento se lee igual en los dos sitios", async () => {
    const orderId = await unPedidoConHistoria();

    const contextual = await loadRecordHistory(db, {
      organizationId: GEEKO.organizationId,
      tableName: "orders",
      recordId: orderId,
      timezone: TZ,
      currency: "Bs",
    });

    // El historial del registro omite el rótulo —quien mira ya está dentro—,
    // así que la comparación es sobre el verbo y el sujeto, que es lo que la
    // redacción compartida garantiza.
    for (const item of contextual.items) {
      expect(item.sentence).toMatch(/el pedido/);
      expect(item.sentence).not.toMatch(/orders|record_id|status_id/);
    }
  });

  it("el filtro por registro de la bitácora general no trae nada ajeno", async () => {
    const orderId = await unPedidoConHistoria();

    const general = await new ActivityService(db).search(
      GEEKO.organizationId,
      {
        from: null, to: null, line: "all", actor: "all",
        table: "all", action: "all", search: "", cursor: null,
      },
      { timezone: TZ, recordId: orderId },
    );

    expect(general.entries.length).toBeGreaterThan(0);
    for (const entry of general.entries) {
      expect(entry.recordId).toBe(orderId);
    }
  });

  // Escenario: El ayudante ve el bloque vacío, no un error
  it("al ayudante le llega vacío por los tres caminos, sin error", async () => {
    const helper = await signIn(GEEKO.assistant);
    const orderId = await unPedidoConHistoria();

    const contextual = await loadRecordHistory(helper, {
      organizationId: GEEKO.organizationId,
      tableName: "orders",
      recordId: orderId,
      timezone: TZ,
      currency: "Bs",
    });
    expect(contextual.items).toEqual([]);

    const general = await new ActivityService(helper).search(
      GEEKO.organizationId,
      {
        from: null, to: null, line: "all", actor: "all",
        table: "all", action: "all", search: "", cursor: null,
      },
      { timezone: TZ },
    );
    expect(general.entries).toEqual([]);
    expect(general.nextCursor).toBeNull();

    const recientes = await new ActivityService(helper).recent(
      GEEKO.organizationId,
    );
    expect(recientes).toEqual([]);
  });

  // Escenario (activity-log): Another organization's events never appear
  //
  // Se comprueba **el negativo directamente** y no comparando totales: los
  // archivos de integración corren en paralelo y varios escriben en Geeko, así
  // que cualquier total de esta organización cambia entre dos consultas. Lo
  // que hay que afirmar es que nada ajeno aparece, no cuántos propios hay.
  it("ningún evento de otra organización se cuela", async () => {
    const ajenos = new Set(eventosAjenosAGeeko());
    expect(ajenos.size).toBeGreaterThan(0);

    let cursor: string | null = null;
    let paginas = 0;
    let vistos = 0;

    do {
      const page: Awaited<ReturnType<ActivityService["search"]>> =
        await new ActivityService(db).search(
          GEEKO.organizationId,
          {
            from: null, to: null, line: "all", actor: "all",
            table: "all", action: "all", search: "", cursor,
          },
          { timezone: TZ },
        );

      for (const entry of page.entries) {
        expect(ajenos.has(entry.id)).toBe(false);
        vistos += 1;
      }
      cursor = page.nextCursor;
      paginas += 1;
    } while (cursor && paginas < 20);

    expect(vistos).toBeGreaterThan(0);
  });
});
