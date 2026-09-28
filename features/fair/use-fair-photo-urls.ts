"use client";

import { useMemo } from "react";

import type { FairProduct } from "@/services/fair/fair-sale-service";

import type { LocalPhoto } from "./fair-session-store";

/**
 * Qué imagen pinta cada tarjeta de la feria: la copia guardada en el
 * dispositivo si es de la foto vigente, si no la URL firmada, y si no ninguna
 * (el sustituto). La copia local va primero aun con red: es la misma imagen,
 * no caduca a la hora y no gasta datos (design.md, decisión 2).
 *
 * Las URLs locales las crea y las libera la sesión (`useFairSessionStore`):
 * aquí solo se elige.
 */
export function useFairPhotoUrls(
  products: readonly FairProduct[],
  photos: ReadonlyMap<string, LocalPhoto>,
): Map<string, string | null> {
  return useMemo(
    () =>
      new Map(
        products.map((product) => {
          const stored = photos.get(product.id);
          const local =
            stored !== undefined && stored.attachmentId === product.photoAttachmentId
              ? stored.url
              : null;
          return [product.id, local ?? product.photoUrl];
        }),
      ),
    [products, photos],
  );
}
