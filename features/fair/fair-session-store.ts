"use client";

import { create } from "zustand";

import {
  captureFairPhotos,
  readFairPhotos,
  readLatestSnapshot,
  readSnapshot,
  saveSnapshot,
  type FairSnapshot,
  type StoredPhoto,
} from "@/lib/fair/snapshot";
import type { FairProduct } from "@/services/fair/fair-sale-service";

import { warmFairShell } from "./sync/warm-shell";

/**
 * La sesión de feria: qué línea y qué canal se están atendiendo, y con qué
 * catálogo (design.md, decisiones 8, 9 y 12).
 *
 * Se elige **una vez al abrir el puesto**, no en cada venta, y sobrevive a
 * cerrar la aplicación: volver a configurarla en mitad de una feria es
 * exactamente la fricción que este modo existe para eliminar.
 *
 * Vive en el snapshot de Dexie y no en `localStorage` aparte porque es el
 * mismo hecho que el catálogo capturado —«esta es la feria que estoy
 * atendiendo»—, y partirlo en dos almacenes abre la puerta a que uno
 * sobreviva sin el otro: línea elegida y catálogo ausente, o al revés.
 */

type FairSessionState = {
  businessLineId: string | null;
  salesChannelId: string | null;
  products: FairProduct[];
  /**
   * Las miniaturas guardadas en el dispositivo, por producto, ya como URL
   * local (`blob:`). Llegan después de la cuadrícula: con red, `photoUrl` la
   * cubre mientras tanto.
   */
  photos: Map<string, LocalPhoto>;
  capturedAt: string | null;
  /** Si la feria se abrió con «Venta rápida con todas las líneas». */
  allLines: boolean;
  /** `true` mientras no se sabe todavía si hay snapshot que rescatar. */
  loading: boolean;
  start: (input: {
    organizationId: string;
    businessLineId: string;
    salesChannelId: string | null;
    products: FairProduct[];
    allLines?: boolean;
  }) => Promise<void>;
  restore: (organizationId: string, businessLineId: string | null) => Promise<void>;
  hydrate: (snapshot: FairSnapshot) => void;
};

/** Una miniatura guardada, lista para `<img src>`. */
export type LocalPhoto = { attachmentId: string; url: string };

/**
 * Convertir las miniaturas guardadas en URLs locales, revocando las del juego
 * anterior. Se hace aquí y no en un componente: la sesión es la dueña de las
 * fotos, vive lo que dura la pestaña, y así cada `blob:` se crea una vez y se
 * libera al reemplazarse —no en cada montaje de la cuadrícula—.
 */
function localPhotos(
  stored: ReadonlyMap<string, StoredPhoto>,
  previous: ReadonlyMap<string, LocalPhoto>,
): Map<string, LocalPhoto> {
  for (const photo of previous.values()) URL.revokeObjectURL(photo.url);

  return new Map(
    [...stored].map(([itemId, photo]) => [
      itemId,
      { attachmentId: photo.attachmentId, url: URL.createObjectURL(photo.blob) },
    ]),
  );
}

export const useFairSessionStore = create<FairSessionState>()((set, get) => ({
  businessLineId: null,
  salesChannelId: null,
  products: [],
  photos: new Map(),
  capturedAt: null,
  allLines: false,
  loading: true,

  /** Abrir la feria con red: fija la sesión y captura el catálogo. */
  start: async ({ organizationId, businessLineId, salesChannelId, products, allLines = false }) => {
    const capturedAt = new Date().toISOString();

    set({ businessLineId, salesChannelId, products, capturedAt, allLines, loading: false });

    await saveSnapshot({
      organizationId,
      businessLineId,
      salesChannelId,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        salePrice: product.salePrice,
        quantitySold: product.quantitySold,
        // Qué foto es, no su URL: la firma caduca a la hora.
        photoAttachmentId: product.photoAttachmentId,
        // Con todas las líneas, cada producto se registra en la suya.
        businessLineId: product.businessLineId,
        businessLineName: product.businessLineName,
      })),
      capturedAt,
      allLines,
    });

    // Las miniaturas, sin esperarlas: la cuadrícula ya está pintada con las
    // URLs firmadas, y una descarga lenta no puede retener el puesto. Al
    // terminar, lo guardado reemplaza a la firma, que caduca a la hora.
    void captureFairPhotos(organizationId, businessLineId, products)
      .then(() => readFairPhotos(organizationId, businessLineId))
      .then((photos) => {
        // Si mientras tanto se cambió de feria, estas fotos ya no son suyas.
        if (get().businessLineId === businessLineId) {
          set({ photos: localPhotos(photos, get().photos) });
        }
      })
      .catch(() => {});

    // El catálogo sin el cascarón no sirve de nada: sin señal no habría
    // pantalla donde mostrarlo (decisión 12). Se capturan juntos.
    await warmFairShell();
  },

  /**
   * Abrir la feria sin saber si hay red: rescata lo capturado. Deja la sesión
   * sin línea si nunca se capturó nada — no es un error, es la señal de que
   * hay que decir que se abra la feria una vez con señal.
   *
   * Sin línea conocida se rescata **el último snapshot de la organización**, y
   * no se abandona. Es deliberado: sin red, el documento que sirve el service
   * worker puede haberse renderizado antes de elegir la línea, y en ese caso
   * la línea que trae es la vieja o ninguna. El snapshot sabe qué feria se
   * estaba atendiendo; el HTML cacheado, no necesariamente. Confiar en el HTML
   * dejaría a quien llega al puesto sin señal frente al paso de inicio, que es
   * exactamente lo que la decisión 12 evita.
   */
  restore: async (organizationId, businessLineId) => {
    const snapshot = businessLineId
      ? await readSnapshot(organizationId, businessLineId)
      : await readLatestSnapshot(organizationId);

    if (!snapshot) {
      set({ loading: false });
      return;
    }

    const photos = await readFairPhotos(organizationId, snapshot.businessLineId).catch(
      () => new Map<string, StoredPhoto>(),
    );

    set({ ...fromSnapshot(snapshot), photos: localPhotos(photos, get().photos) });
  },

  hydrate: (snapshot) => set(fromSnapshot(snapshot)),
}));

/**
 * La sesión que describe un snapshot. Sin red no hay URL firmada que valga:
 * la foto de cada producto sale de lo guardado (`photos`), si lo hay.
 */
function fromSnapshot(snapshot: FairSnapshot) {
  return {
    businessLineId: snapshot.businessLineId,
    salesChannelId: snapshot.salesChannelId,
    products: snapshot.products.map(
      (product): FairProduct => ({
        ...product,
        // Un snapshot anterior no guardaba la línea de cada producto: eran
        // todos de la línea de la feria o compartidos, y registrarlos en la
        // de la feria da lo mismo que antes.
        businessLineId:
          product.businessLineId === undefined ? snapshot.businessLineId : product.businessLineId,
        businessLineName: product.businessLineName ?? null,
        photoUrl: null,
        photoAttachmentId: product.photoAttachmentId ?? null,
      }),
    ),
    capturedAt: snapshot.capturedAt,
    allLines: snapshot.allLines ?? false,
    loading: false,
  };
}
