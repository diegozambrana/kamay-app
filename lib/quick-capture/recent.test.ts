import { beforeEach, describe, expect, it } from "vitest";

import { clearOperations, registerOperation } from "@/lib/offline";
import type { SyncItem } from "@/stores/sync-store";

import {
  dayBoundsInTimezone,
  dayOfInstant,
  mergeRecentCaptures,
  pendingCapturesToday,
  type RecentCapture,
} from "./recent";

function synced(over: Partial<RecentCapture> = {}): RecentCapture {
  return {
    kind: "order",
    id: "a0000000-0000-4000-8000-000000000001",
    label: "Pedido #12",
    lineId: "l1",
    occurredAt: "2026-09-05T16:10:00.000Z",
    href: "/orders/a0000000-0000-4000-8000-000000000001",
    pending: false,
    ...over,
  };
}

function queued(over: Partial<SyncItem["entry"]> = {}): SyncItem {
  return {
    entry: {
      seq: 1,
      recordId: "b0000000-0000-4000-8000-000000000001",
      operation: "order.create",
      payload: { businessLineId: "l1", items: [{ quantity: 1 }] },
      organizationId: "o1",
      userId: "u1",
      dependsOn: [],
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      enqueuedAt: "2026-09-05T15:40:00.000Z",
      schemaVersion: 1,
      ...over,
    },
    hold: null,
  };
}

const TODAY = "2026-09-05";
/** La Paz: UTC−4 todo el año. El desfase con UTC es justo el que rompía. */
const TZ = "America/La_Paz";

describe("mergeRecentCaptures", () => {
  it("muestra lo registrado hoy, lo más reciente primero", () => {
    const rows = mergeRecentCaptures(
      [
        synced({ id: "1", occurredAt: "2026-09-05T09:00:00.000Z" }),
        synced({ id: "2", kind: "purchase", occurredAt: "2026-09-05T11:00:00.000Z" }),
      ],
      [],
    );

    expect(rows.map((row) => row.id)).toEqual(["2", "1"]);
  });

  it("se limita a cinco", () => {
    const siete = Array.from({ length: 7 }, (_, i) =>
      synced({ id: `s${i}`, occurredAt: `2026-09-05T0${i}:00:00.000Z` }),
    );

    expect(mergeRecentCaptures(siete, [])).toHaveLength(5);
  });

  it("sin nada que mostrar devuelve una lista vacía", () => {
    // "Ayer no cuenta": el filtro por día ocurre antes, en el servicio y en
    // `pendingCapturesToday`; aquí lo que llega vacío se queda vacío.
    expect(mergeRecentCaptures([], [])).toEqual([]);
  });

  it("lo pendiente y lo enviado se ordenan en una sola lista", () => {
    const rows = mergeRecentCaptures(
      [synced({ id: "s", occurredAt: "2026-09-05T16:10:00.000Z" })],
      [
        {
          kind: "order",
          id: "p",
          label: "Pedido nuevo",
          lineId: "l1",
          occurredAt: "2026-09-05T15:40:00.000Z",
          pending: true,
        },
      ],
    );

    expect(rows.map((row) => row.id)).toEqual(["s", "p"]);
  });

  it("al sincronizarse no se duplica", () => {
    // El `uuid` lo genera el cliente y acaba siendo llave primaria, así que
    // la entrada de la cola y su fila sincronizada comparten identificador.
    const id = "c0000000-0000-4000-8000-000000000001";
    const rows = mergeRecentCaptures(
      [synced({ id })],
      [
        {
          kind: "order",
          id,
          label: "Pedido nuevo",
          lineId: "l1",
          occurredAt: "2026-09-05T15:40:00.000Z",
          pending: true,
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].pending).toBe(false);
    expect(rows[0].href).toBeDefined();
  });

  it("la lista no queda vacía por falta de red", () => {
    const rows = mergeRecentCaptures(
      [],
      [
        {
          kind: "order",
          id: "p",
          label: "Pedido nuevo",
          lineId: "l1",
          occurredAt: "2026-09-05T15:40:00.000Z",
          pending: true,
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].pending).toBe(true);
  });

  it("una fila pendiente no enlaza a ninguna parte", () => {
    const rows = mergeRecentCaptures(
      [],
      pendingCapturesToday([queued()], TODAY, TZ),
    );

    expect(rows[0].href).toBeUndefined();
  });
});

describe("pendingCapturesToday", () => {
  beforeEach(() => {
    clearOperations();
    registerOperation("order.create", {
      send: async () => ({ status: "ok" }),
      describe: () => "Pedido nuevo · 1 línea",
    });
  });

  it("una captura sin red aparece con su hora real", () => {
    const [captura] = pendingCapturesToday([queued()], TODAY, TZ);

    expect(captura).toMatchObject({
      kind: "order",
      id: "b0000000-0000-4000-8000-000000000001",
      occurredAt: "2026-09-05T15:40:00.000Z",
      lineId: "l1",
      pending: true,
    });
  });

  it("toma el rótulo del registro de operaciones, no uno propio", () => {
    // La lista y la bandeja deben llamar igual a lo mismo.
    expect(pendingCapturesToday([queued()], TODAY, TZ)[0].label).toBe(
      "Pedido nuevo · 1 línea",
    );
  });

  it("lo encolado ayer no cuenta", () => {
    const ayer = queued({ enqueuedAt: "2026-09-04T23:50:00.000Z" });

    expect(pendingCapturesToday([ayer], TODAY, TZ)).toEqual([]);
  });

  it("una operación que la lista no representa se ignora", () => {
    // La cola puede llevar cosas que esta pantalla no ofrece —una edición de
    // pedido, por ejemplo—: se ignoran, no se adivina su forma.
    const edicion = queued({ operation: "order.update" });
    const desconocida = queued({ operation: "algo.raro" });

    expect(pendingCapturesToday([edicion, desconocida], TODAY, TZ)).toEqual([]);
  });

  it("sin rótulo registrado cae en uno genérico y no revienta", () => {
    clearOperations();

    expect(pendingCapturesToday([queued()], TODAY, TZ)[0].label).toBe(
      "Registro pendiente",
    );
  });
});

describe("el día de la organización, no el de UTC", () => {
  // El fallo que esto fija: a las 20:24 en La Paz el instante ya lleva la
  // fecha del día siguiente en UTC. Filtrar por la fecha local sin tener en
  // cuenta el huso dejaba "Registrado hoy" vacío toda la tarde-noche —justo
  // la duda que la pantalla existe para disipar.
  const TARDE_EN_LA_PAZ = "2026-09-07T00:24:00.000Z"; // 20:24 del día 6

  it("un instante de la tarde pertenece al día local, no al de UTC", () => {
    expect(dayOfInstant(TARDE_EN_LA_PAZ, TZ)).toBe("2026-09-06");
    expect(dayOfInstant(TARDE_EN_LA_PAZ, "UTC")).toBe("2026-09-07");
  });

  it("una captura de las 20:24 sigue contando como de hoy", () => {
    const captura = queued({ enqueuedAt: TARDE_EN_LA_PAZ });

    expect(pendingCapturesToday([captura], "2026-09-06", TZ)).toHaveLength(1);
  });

  it("y no cuenta como del día siguiente", () => {
    const captura = queued({ enqueuedAt: TARDE_EN_LA_PAZ });

    expect(pendingCapturesToday([captura], "2026-09-07", TZ)).toEqual([]);
  });

  it("los extremos del día viajan con su desplazamiento", () => {
    // Sin el offset, la base —que guarda en UTC— acotaría el día equivocado.
    expect(dayBoundsInTimezone("2026-09-06", TZ)).toEqual({
      from: "2026-09-06T00:00:00.000-04:00",
      to: "2026-09-06T23:59:59.999-04:00",
    });
  });

  it("el instante de las 20:24 cae dentro de esos extremos", () => {
    const { from, to } = dayBoundsInTimezone("2026-09-06", TZ);
    const momento = new Date(TARDE_EN_LA_PAZ).getTime();

    expect(momento).toBeGreaterThanOrEqual(new Date(from).getTime());
    expect(momento).toBeLessThanOrEqual(new Date(to).getTime());
  });

  it("en UTC los extremos no llevan desfase", () => {
    expect(dayBoundsInTimezone("2026-09-06", "UTC")).toEqual({
      from: "2026-09-06T00:00:00.000+00:00",
      to: "2026-09-06T23:59:59.999+00:00",
    });
  });

  it("respeta el horario de verano de la zona, no una tabla fija", () => {
    // Madrid: +01:00 en enero y +02:00 en julio.
    expect(dayBoundsInTimezone("2026-01-15", "Europe/Madrid").from).toContain("+01:00");
    expect(dayBoundsInTimezone("2026-07-15", "Europe/Madrid").from).toContain("+02:00");
  });
});
