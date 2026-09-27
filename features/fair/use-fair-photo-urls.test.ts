import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FairProduct } from "@/services/fair/fair-sale-service";

import type { LocalPhoto } from "./fair-session-store";
import { useFairPhotoUrls } from "./use-fair-photo-urls";

/**
 * Qué imagen pinta cada tarjeta. Escenarios del delta `fair-mode`: «Abrir sin
 * red tras haber entrado con red» y «Las miniaturas no caducan durante la
 * feria».
 */

const product = (id: string, overrides: Partial<FairProduct> = {}): FairProduct => ({
  id,
  name: id,
  salePrice: 10,
  quantitySold: 0,
  businessLineId: "line",
  photoUrl: null,
  photoAttachmentId: null,
  businessLineName: null,
  ...overrides,
});

const urls = (products: FairProduct[], photos: Map<string, LocalPhoto>) =>
  renderHook(() => useFairPhotoUrls(products, photos)).result.current;

describe("useFairPhotoUrls", () => {
  it("Las miniaturas no caducan durante la feria: con la foto guardada, usa la copia local aunque haya URL firmada", () => {
    const result = urls(
      [product("taza", { photoUrl: "https://firmada/taza", photoAttachmentId: "f1" })],
      new Map([["taza", { attachmentId: "f1", url: "blob:local/1" }]]),
    );

    expect(result.get("taza")).toBe("blob:local/1");
  });

  it("Abrir sin red tras haber entrado con red: sin URL firmada, la copia local", () => {
    const result = urls(
      [product("taza", { photoAttachmentId: "f1" })],
      new Map([["taza", { attachmentId: "f1", url: "blob:local/1" }]]),
    );

    expect(result.get("taza")).toBe("blob:local/1");
  });

  it("sin copia guardada todavía, la URL firmada", () => {
    const result = urls(
      [product("taza", { photoUrl: "https://firmada/taza", photoAttachmentId: "f1" })],
      new Map(),
    );

    expect(result.get("taza")).toBe("https://firmada/taza");
  });

  it("una copia de otra foto no se usa: el producto cambió de foto", () => {
    const result = urls(
      [product("taza", { photoUrl: "https://firmada/nueva", photoAttachmentId: "nueva" })],
      new Map([["taza", { attachmentId: "vieja", url: "blob:local/1" }]]),
    );

    expect(result.get("taza")).toBe("https://firmada/nueva");
  });

  it("Producto sin foto: null", () => {
    expect(urls([product("bolsa")], new Map()).get("bolsa")).toBeNull();
  });
});
