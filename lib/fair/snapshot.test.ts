import { beforeEach, describe, expect, it } from "vitest";

import { freshOutbox } from "@/lib/offline/test-support";
import type { OutboxDatabase } from "@/lib/offline";

import {
  captureFairPhotos,
  readFairPhotos,
  readLatestSnapshot,
  readSnapshot,
  saveSnapshot,
  snapshotAgeLabel,
  snapshotAgeMinutes,
} from "./snapshot";

const ORG = "org-a";
const LINE = "line-alfareria";
const OTRA_LINEA = "line-sublimacion";

const productos = [
  { id: "taza", name: "Taza de barro", salePrice: 35, quantitySold: 30 },
  { id: "maceta", name: "Maceta", salePrice: 60, quantitySold: 4 },
];

let db: OutboxDatabase;

beforeEach(() => {
  db = freshOutbox();
});

// Escenario: Entrar con red captura el catálogo
describe("saveSnapshot y readSnapshot", () => {
  it("guarda catálogo, línea, canal y la hora de la captura", async () => {
    await saveSnapshot(
      {
        organizationId: ORG,
        businessLineId: LINE,
        salesChannelId: "canal-feria",
        products: productos,
        capturedAt: "2026-09-01T15:00:00.000Z",
      },
      db,
    );

    const leido = await readSnapshot(ORG, LINE, db);

    expect(leido).toMatchObject({
      businessLineId: LINE,
      salesChannelId: "canal-feria",
      capturedAt: "2026-09-01T15:00:00.000Z",
    });
    expect(leido?.products).toHaveLength(2);
  });

  // Escenario: Sin red y sin captura previa
  it("devuelve null cuando esa feria nunca se abrió con red", async () => {
    expect(await readSnapshot(ORG, LINE, db)).toBeNull();
  });

  it("cada línea es una feria distinta", async () => {
    await saveSnapshot(
      {
        organizationId: ORG,
        businessLineId: LINE,
        salesChannelId: null,
        products: productos,
        capturedAt: "2026-09-01T15:00:00.000Z",
      },
      db,
    );

    expect(await readSnapshot(ORG, OTRA_LINEA, db)).toBeNull();
  });

  // Escenario: Volver a entrar con red renueva la captura
  it("volver a guardar reemplaza el snapshot de esa feria, no acumula", async () => {
    const base = {
      organizationId: ORG,
      businessLineId: LINE,
      salesChannelId: null,
      products: productos,
    };

    await saveSnapshot({ ...base, capturedAt: "2026-09-01T15:00:00.000Z" }, db);
    await saveSnapshot(
      {
        ...base,
        products: [{ id: "taza", name: "Taza de barro", salePrice: 40, quantitySold: 31 }],
        capturedAt: "2026-09-02T09:00:00.000Z",
      },
      db,
    );

    const leido = await readSnapshot(ORG, LINE, db);

    expect(await db.fairSnapshots.count()).toBe(1);
    expect(leido?.capturedAt).toBe("2026-09-02T09:00:00.000Z");
    expect(leido?.products[0].salePrice).toBe(40);
  });

  // Escenario: Un cambio hecho sin señal no altera la captura
  it("un cambio de catálogo hecho fuera no toca lo capturado", async () => {
    await saveSnapshot(
      {
        organizationId: ORG,
        businessLineId: LINE,
        salesChannelId: null,
        products: productos,
        capturedAt: "2026-09-01T15:00:00.000Z",
      },
      db,
    );

    // Nadie escribe: es lo que pasa mientras la feria está sin señal.
    const leido = await readSnapshot(ORG, LINE, db);

    expect(leido?.products.map((p) => p.id)).toEqual(["taza", "maceta"]);
    expect(leido?.capturedAt).toBe("2026-09-01T15:00:00.000Z");
  });

  it("no cruza organizaciones", async () => {
    await saveSnapshot(
      {
        organizationId: ORG,
        businessLineId: LINE,
        salesChannelId: null,
        products: productos,
        capturedAt: "2026-09-01T15:00:00.000Z",
      },
      db,
    );

    expect(await readSnapshot("org-b", LINE, db)).toBeNull();
  });
});

describe("readLatestSnapshot", () => {
  it("devuelve el más reciente de la organización", async () => {
    const base = { organizationId: ORG, salesChannelId: null, products: productos };

    await saveSnapshot({ ...base, businessLineId: LINE, capturedAt: "2026-09-01T15:00:00.000Z" }, db);
    await saveSnapshot(
      { ...base, businessLineId: OTRA_LINEA, capturedAt: "2026-09-02T15:00:00.000Z" },
      db,
    );

    expect((await readLatestSnapshot(ORG, db))?.businessLineId).toBe(OTRA_LINEA);
  });

  it("devuelve null si la organización no tiene ninguno", async () => {
    expect(await readLatestSnapshot(ORG, db)).toBeNull();
  });
});

// Escenario: La antigüedad del catálogo está a la vista
describe("snapshotAgeMinutes y snapshotAgeLabel", () => {
  const ahora = new Date("2026-09-01T21:00:00.000Z");

  it("cuenta los minutos desde la captura", () => {
    expect(snapshotAgeMinutes({ capturedAt: "2026-09-01T15:00:00.000Z" }, ahora)).toBe(360);
  });

  it("nunca devuelve negativo si el reloj del dispositivo va atrasado", () => {
    expect(snapshotAgeMinutes({ capturedAt: "2026-09-02T00:00:00.000Z" }, ahora)).toBe(0);
  });

  it("una fecha ilegible no rompe la cuadrícula", () => {
    expect(snapshotAgeMinutes({ capturedAt: "no es una fecha" }, ahora)).toBe(0);
  });

  it("dice «ahora mismo» en vez de «hace 0 minutos»", () => {
    expect(snapshotAgeLabel({ capturedAt: "2026-09-01T20:59:40.000Z" }, ahora)).toBe(
      "Catálogo cargado ahora mismo",
    );
  });

  it("dice los minutos dentro de la primera hora", () => {
    expect(snapshotAgeLabel({ capturedAt: "2026-09-01T20:25:00.000Z" }, ahora)).toBe(
      "Catálogo cargado hace 35 min",
    );
  });

  it("dice las horas dentro del día", () => {
    expect(snapshotAgeLabel({ capturedAt: "2026-09-01T15:00:00.000Z" }, ahora)).toBe(
      "Catálogo cargado hace 6 h",
    );
  });

  it("dice «ayer» y luego los días", () => {
    expect(snapshotAgeLabel({ capturedAt: "2026-08-31T15:00:00.000Z" }, ahora)).toBe(
      "Catálogo cargado ayer",
    );
    expect(snapshotAgeLabel({ capturedAt: "2026-08-29T15:00:00.000Z" }, ahora)).toBe(
      "Catálogo cargado hace 3 días",
    );
  });
});

/**
 * `fair-product-photos-visibility-cart-drawer` · Las miniaturas que se guardan
 * al capturar, para verlas sin señal. Escenarios del delta `fair-mode`:
 * «Entrar con red captura el catálogo», «Una miniatura que no se pudo
 * guardar» y «Volver a entrar con red renueva la captura».
 */
describe("captureFairPhotos y readFairPhotos", () => {
  const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

  /** Un `fetch` falso que cuenta qué se pidió y responde por URL. */
  function fakeFetch(responses: Record<string, string | "fail" | number>) {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      const answer = responses[url];
      if (answer === "fail") throw new TypeError("Failed to fetch");
      if (typeof answer === "number") return new Response(null, { status: answer });
      return new Response(bytes(answer ?? ""), { headers: { "content-type": "image/webp" } });
    };
    return { fetcher, calls };
  }

  const conFoto = [
    { id: "taza", photoUrl: "https://firmada/taza", photoAttachmentId: "foto-taza" },
    { id: "maceta", photoUrl: "https://firmada/maceta", photoAttachmentId: "foto-maceta" },
    { id: "bolsa", photoUrl: null, photoAttachmentId: null },
  ];

  it("Entrar con red captura el catálogo: guarda la miniatura de cada producto con foto", async () => {
    const { fetcher } = fakeFetch({
      "https://firmada/taza": "TAZA",
      "https://firmada/maceta": "MACETA",
    });

    await captureFairPhotos(ORG, LINE, conFoto, { db, fetcher });
    const fotos = await readFairPhotos(ORG, LINE, db);

    expect([...fotos.keys()].sort()).toEqual(["maceta", "taza"]);
    expect(fotos.get("taza")?.attachmentId).toBe("foto-taza");
    expect(await fotos.get("taza")?.blob.text()).toBe("TAZA");
    expect(fotos.get("taza")?.blob.type).toBe("image/webp");
  });

  it("no vuelve a bajar una foto que ya tiene", async () => {
    const primera = fakeFetch({ "https://firmada/taza": "TAZA", "https://firmada/maceta": "M" });
    await captureFairPhotos(ORG, LINE, conFoto, { db, fetcher: primera.fetcher });

    const segunda = fakeFetch({ "https://firmada/taza": "OTRA", "https://firmada/maceta": "M" });
    await captureFairPhotos(ORG, LINE, conFoto, { db, fetcher: segunda.fetcher });

    expect(segunda.calls).toEqual([]);
    expect(await (await readFairPhotos(ORG, LINE, db)).get("taza")?.blob.text()).toBe("TAZA");
  });

  it("Volver a entrar con red renueva la captura: una foto nueva reemplaza a la vieja y lo que salió se borra", async () => {
    const primera = fakeFetch({ "https://firmada/taza": "VIEJA", "https://firmada/maceta": "M" });
    await captureFairPhotos(ORG, LINE, conFoto, { db, fetcher: primera.fetcher });

    const segunda = fakeFetch({ "https://firmada/taza-2": "NUEVA" });
    await captureFairPhotos(
      ORG,
      LINE,
      [{ id: "taza", photoUrl: "https://firmada/taza-2", photoAttachmentId: "foto-taza-2" }],
      { db, fetcher: segunda.fetcher },
    );

    const fotos = await readFairPhotos(ORG, LINE, db);
    expect([...fotos.keys()]).toEqual(["taza"]);
    expect(fotos.get("taza")?.attachmentId).toBe("foto-taza-2");
    expect(await fotos.get("taza")?.blob.text()).toBe("NUEVA");
  });

  it("Una miniatura que no se pudo guardar: el resto se guarda y no lanza", async () => {
    const { fetcher } = fakeFetch({
      "https://firmada/taza": "fail",
      "https://firmada/maceta": 403,
    });

    await expect(captureFairPhotos(ORG, LINE, conFoto, { db, fetcher })).resolves.toBeUndefined();
    expect((await readFairPhotos(ORG, LINE, db)).size).toBe(0);
  });

  it("una foto que tarda demasiado se abandona", async () => {
    const lenta = () => new Promise<Response>(() => {});

    await captureFairPhotos(ORG, LINE, conFoto.slice(0, 1), {
      db,
      fetcher: lenta,
      timeoutMs: 10,
    });
    expect((await readFairPhotos(ORG, LINE, db)).size).toBe(0);
  });

  it("las fotos de una feria no se mezclan con las de otra línea", async () => {
    const { fetcher } = fakeFetch({ "https://firmada/taza": "TAZA", "https://firmada/maceta": "M" });
    await captureFairPhotos(ORG, LINE, conFoto, { db, fetcher });

    expect((await readFairPhotos(ORG, OTRA_LINEA, db)).size).toBe(0);
  });

  it("baja como mucho cuatro a la vez", async () => {
    let enVuelo = 0;
    let maximo = 0;
    const fetcher = async () => {
      enVuelo += 1;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((resolve) => setTimeout(resolve, 5));
      enVuelo -= 1;
      return new Response(bytes("X"), { headers: { "content-type": "image/webp" } });
    };
    const muchos = Array.from({ length: 10 }, (_, index) => ({
      id: `p${index}`,
      photoUrl: `https://firmada/p${index}`,
      photoAttachmentId: `f${index}`,
    }));

    await captureFairPhotos(ORG, LINE, muchos, { db, fetcher });

    expect(maximo).toBeLessThanOrEqual(4);
    expect((await readFairPhotos(ORG, LINE, db)).size).toBe(10);
  });
});
