"use client";

import { create } from "zustand";

import {
  readLatestSnapshot,
  readSnapshot,
  saveSnapshot,
  type FairSnapshot,
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
  capturedAt: string | null;
  /** `true` mientras no se sabe todavía si hay snapshot que rescatar. */
  loading: boolean;
  start: (input: {
    organizationId: string;
    businessLineId: string;
    salesChannelId: string | null;
    products: FairProduct[];
  }) => Promise<void>;
  restore: (organizationId: string, businessLineId: string | null) => Promise<void>;
  hydrate: (snapshot: FairSnapshot) => void;
};

export const useFairSessionStore = create<FairSessionState>()((set) => ({
  businessLineId: null,
  salesChannelId: null,
  products: [],
  capturedAt: null,
  loading: true,

  /** Abrir la feria con red: fija la sesión y captura el catálogo. */
  start: async ({ organizationId, businessLineId, salesChannelId, products }) => {
    const capturedAt = new Date().toISOString();

    set({ businessLineId, salesChannelId, products, capturedAt, loading: false });

    await saveSnapshot({
      organizationId,
      businessLineId,
      salesChannelId,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        salePrice: product.salePrice,
        quantitySold: product.quantitySold,
      })),
      capturedAt,
    });

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

    set({
      businessLineId: snapshot.businessLineId,
      salesChannelId: snapshot.salesChannelId,
      products: snapshot.products.map((product) => ({
        ...product,
        businessLineId: snapshot.businessLineId,
      })),
      capturedAt: snapshot.capturedAt,
      loading: false,
    });
  },

  hydrate: (snapshot) =>
    set({
      businessLineId: snapshot.businessLineId,
      salesChannelId: snapshot.salesChannelId,
      products: snapshot.products.map((product) => ({
        ...product,
        businessLineId: snapshot.businessLineId,
      })),
      capturedAt: snapshot.capturedAt,
      loading: false,
    }),
}));
