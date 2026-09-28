import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FairProduct } from "@/services/fair/fair-sale-service";

/**
 * `fair-product-photos-visibility-cart-drawer` · La sesión de feria y sus
 * miniaturas. Requisito «El modo feria abre sin red desde el catálogo
 * capturado»: guardar las miniaturas no retrasa la cuadrícula, y al abrir sin
 * red se rescatan las guardadas.
 */

const captura = vi.hoisted(() => ({
  pendiente: null as null | (() => void),
  fotos: new Map<string, { attachmentId: string; blob: Blob }>(),
  capturadas: [] as unknown[],
  snapshot: null as unknown,
}));

vi.mock("./sync/warm-shell", () => ({ warmFairShell: async () => {} }));

vi.mock("@/lib/fair/snapshot", () => ({
  saveSnapshot: async (snapshot: unknown) => {
    captura.snapshot = snapshot;
  },
  readSnapshot: async () => captura.snapshot,
  readLatestSnapshot: async () => captura.snapshot,
  // La descarga queda colgada hasta que la prueba la suelte.
  captureFairPhotos: (_org: string, _line: string, products: unknown[]) => {
    captura.capturadas.push(products);
    return new Promise<void>((resolve) => {
      captura.pendiente = resolve;
    });
  },
  readFairPhotos: async () => captura.fotos,
}));

import { useFairSessionStore } from "./fair-session-store";

const taza: FairProduct = {
  id: "taza",
  name: "Taza de barro",
  salePrice: 35,
  quantitySold: 3,
  businessLineId: "line",
  photoUrl: "https://firmada/taza",
  photoAttachmentId: "foto-taza",
  businessLineName: null,
};

let created: Blob[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob);
    return `blob:local/${created.length}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });
  captura.pendiente = null;
  captura.fotos = new Map();
  captura.capturadas = [];
  captura.snapshot = null;
  useFairSessionStore.setState({
    businessLineId: null,
    salesChannelId: null,
    products: [],
    photos: new Map(),
    capturedAt: null,
    allLines: false,
    loading: true,
  });
});

afterEach(() => vi.restoreAllMocks());

describe("useFairSessionStore · miniaturas", () => {
  it("la cuadrícula se fija antes de que termine la descarga de fotos", async () => {
    const start = useFairSessionStore.getState().start({
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      products: [taza],
    });

    // La descarga sigue colgada y la sesión ya está lista.
    await start;
    expect(useFairSessionStore.getState().products).toEqual([taza]);
    expect(useFairSessionStore.getState().loading).toBe(false);
    expect(captura.capturadas).toEqual([[taza]]);
  });

  it("el snapshot guarda qué foto tiene cada producto", async () => {
    await useFairSessionStore.getState().start({
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      products: [taza],
    });

    expect(captura.snapshot).toMatchObject({
      products: [{ id: "taza", photoAttachmentId: "foto-taza" }],
    });
    expect(captura.snapshot).not.toMatchObject({ products: [{ photoUrl: expect.anything() }] });
  });

  it("al terminar la descarga, las fotos guardadas llegan a la sesión", async () => {
    const blob = new Blob(["TAZA"], { type: "image/webp" });
    captura.fotos = new Map([["taza", { attachmentId: "foto-taza", blob }]]);

    await useFairSessionStore.getState().start({
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      products: [taza],
    });
    expect(useFairSessionStore.getState().photos.size).toBe(0);

    captura.pendiente?.();
    await vi.waitFor(() =>
      expect(useFairSessionStore.getState().photos.get("taza")).toEqual({
        attachmentId: "foto-taza",
        url: "blob:local/1",
      }),
    );
    expect(created).toEqual([blob]);
  });

  it("Abrir sin red tras haber entrado con red: rescata las fotos guardadas", async () => {
    const blob = new Blob(["TAZA"], { type: "image/webp" });
    captura.fotos = new Map([["taza", { attachmentId: "foto-taza", blob }]]);
    captura.snapshot = {
      id: "org:line",
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      capturedAt: "2026-09-26T10:00:00.000Z",
      products: [
        { id: "taza", name: "Taza de barro", salePrice: 35, quantitySold: 3, photoAttachmentId: "foto-taza" },
      ],
    };

    await useFairSessionStore.getState().restore("org", "line");

    const state = useFairSessionStore.getState();
    // Sin red no hay URL firmada que valga: la foto sale de lo guardado.
    expect(state.products[0]).toMatchObject({ photoUrl: null, photoAttachmentId: "foto-taza" });
    expect(state.photos.get("taza")?.url).toBe("blob:local/1");
    expect(created).toEqual([blob]);
  });

  it("al reemplazar las fotos, libera las URLs locales anteriores", async () => {
    captura.fotos = new Map([
      ["taza", { attachmentId: "foto-taza", blob: new Blob(["A"]) }],
    ]);
    captura.snapshot = {
      id: "org:line",
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      capturedAt: "2026-09-26T10:00:00.000Z",
      products: [
        { id: "taza", name: "Taza de barro", salePrice: 35, quantitySold: 3, photoAttachmentId: "foto-taza" },
      ],
    };

    await useFairSessionStore.getState().restore("org", "line");
    await useFairSessionStore.getState().restore("org", "line");

    expect(revoked).toEqual(["blob:local/1"]);
    expect(useFairSessionStore.getState().photos.get("taza")?.url).toBe("blob:local/2");
  });

  it("un snapshot anterior a las fotos se lee como «sin foto»", async () => {
    captura.snapshot = {
      id: "org:line",
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      capturedAt: "2026-09-26T10:00:00.000Z",
      products: [{ id: "taza", name: "Taza de barro", salePrice: 35, quantitySold: 3 }],
    };

    await useFairSessionStore.getState().restore("org", "line");

    expect(useFairSessionStore.getState().products[0]).toMatchObject({
      photoUrl: null,
      photoAttachmentId: null,
      businessLineName: null,
    });
  });

});

// `fair-all-lines` · El snapshot guarda el alcance y la línea de cada producto.
describe("useFairSessionStore · todas las líneas", () => {
  const tazaSub: FairProduct = {
    ...taza,
    id: "taza-sub",
    businessLineId: "sublimacion",
    businessLineName: "Sublimación",
  };

  it("start guarda el alcance y la línea de cada producto", async () => {
    await useFairSessionStore.getState().start({
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      products: [tazaSub],
      allLines: true,
    });

    expect(useFairSessionStore.getState().allLines).toBe(true);
    expect(captura.snapshot).toMatchObject({
      allLines: true,
      products: [{ id: "taza-sub", businessLineId: "sublimacion", businessLineName: "Sublimación" }],
    });
  });

  it("restore conserva la línea de cada producto, no la de la feria", async () => {
    captura.snapshot = {
      id: "org:line",
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      capturedAt: "2026-09-26T10:00:00.000Z",
      allLines: true,
      products: [
        { id: "taza-sub", name: "Taza", salePrice: 45, quantitySold: 0, businessLineId: "sublimacion", businessLineName: "Sublimación" },
        { id: "bolsa", name: "Bolsa", salePrice: 5, quantitySold: 0, businessLineId: null, businessLineName: null },
      ],
    };

    await useFairSessionStore.getState().restore("org", "line");

    const state = useFairSessionStore.getState();
    expect(state.allLines).toBe(true);
    expect(state.products.map((product) => product.businessLineId)).toEqual(["sublimacion", null]);
    expect(state.products[0].businessLineName).toBe("Sublimación");
  });

  it("un snapshot anterior se lee sin la bandera y con la línea de la feria", async () => {
    captura.snapshot = {
      id: "org:line",
      organizationId: "org",
      businessLineId: "line",
      salesChannelId: null,
      capturedAt: "2026-09-26T10:00:00.000Z",
      products: [{ id: "taza", name: "Taza", salePrice: 35, quantitySold: 0 }],
    };

    await useFairSessionStore.getState().restore("org", "line");

    const state = useFairSessionStore.getState();
    expect(state.allLines).toBe(false);
    expect(state.products[0].businessLineId).toBe("line");
  });
});
