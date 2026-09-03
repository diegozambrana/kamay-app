import { describe, expect, it, vi } from "vitest";

import {
  compressImage,
  isAcceptedImage,
  targetSize,
  UNSUPPORTED_FORMAT_MESSAGE,
  type ImageCodec,
  type ImageSize,
} from "./compress-image";

const MB = 1024 * 1024;

/**
 * Un archivo de entrada con el peso declarado. jsdom calcula `size` desde el
 * contenido, y aquí importa la decisión, no los bytes: se sobrescribe.
 */
function fakeFile(bytes: number, type = "image/jpeg", name = "foto.jpg"): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

/**
 * Un codec de mentira: las dimensiones son las declaradas y cada codificación
 * pesa `bytesAt(quality)` de verdad —en bytes pequeños, para que el `File`
 * resultante los cuente—, y así se puede afirmar en qué escalón cabe.
 */
function fakeCodec(
  size: ImageSize,
  bytesAt: (quality: number) => number,
): ImageCodec & { encoded: number[] } {
  const encoded: number[] = [];
  return {
    encoded,
    dimensions: vi.fn(async () => size),
    encode: vi.fn(async (_file, _size, quality) => {
      encoded.push(quality);
      return new Blob([new Uint8Array(bytesAt(quality))], { type: "image/webp" });
    }),
  };
}

describe("targetSize", () => {
  it("encoge el lado mayor a maxEdge conservando la proporción", () => {
    expect(targetSize({ width: 4000, height: 3000 }, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(targetSize({ width: 3000, height: 4000 }, 1600)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it("no agranda una imagen pequeña", () => {
    expect(targetSize({ width: 800, height: 600 }, 1600)).toEqual({
      width: 800,
      height: 600,
    });
  });
});

describe("isAcceptedImage", () => {
  it("acepta los formatos del bucket y nada más", () => {
    expect(isAcceptedImage("image/jpeg")).toBe(true);
    expect(isAcceptedImage("image/webp")).toBe(true);
    expect(isAcceptedImage("image/heic")).toBe(false);
    expect(isAcceptedImage("application/pdf")).toBe(false);
  });
});

describe("compressImage", () => {
  // El límite se escala a bytes pequeños: la lógica es la misma que con 5 MB
  // y la prueba no reserva megabytes.
  const LIMIT = 5000;

  it("rechaza un formato no admitido nombrando los válidos", async () => {
    await expect(
      compressImage(fakeFile(1 * MB, "image/heic", "foto.heic")),
    ).rejects.toThrow(UNSUPPORTED_FORMAT_MESSAGE);
  });

  it("deja pasar tal cual una foto pequeña que ya cabe", async () => {
    const codec = fakeCodec({ width: 800, height: 600 }, () => 1000);
    const file = fakeFile(1000);

    const result = await compressImage(file, { codec, maxBytes: LIMIT });

    expect(result).toBe(file);
    expect(codec.encode).not.toHaveBeenCalled();
  });

  it("una foto de 8 MB se recodifica hasta caber en el límite", async () => {
    // A 0.85 pesa 6000; a 0.75, 4500: cabe en el segundo escalón.
    const codec = fakeCodec({ width: 4000, height: 3000 }, (quality) =>
      quality >= 0.85 ? 6000 : 4500,
    );

    const result = await compressImage(fakeFile(8 * MB), { codec, maxBytes: LIMIT });

    expect(result.size).toBe(4500);
    expect(codec.encoded).toEqual([0.85, 0.75]);
    expect(codec.encode).toHaveBeenLastCalledWith(
      expect.anything(),
      { width: 1600, height: 1200 },
      0.75,
    );
  });

  it("renombra según el formato de salida", async () => {
    const codec = fakeCodec({ width: 4000, height: 3000 }, () => 1000);
    const result = await compressImage(fakeFile(8 * MB, "image/jpeg", "recibo.jpg"), {
      codec,
      maxBytes: LIMIT,
    });

    expect(result.name).toBe("recibo.webp");
    expect(result.type).toBe("image/webp");
  });

  it("una foto grande en píxeles se recodifica aunque pese poco", async () => {
    const codec = fakeCodec({ width: 5000, height: 2000 }, () => 500);
    await compressImage(fakeFile(2000), { codec, maxBytes: LIMIT });

    expect(codec.encode).toHaveBeenCalledTimes(1);
  });

  it("si ninguna calidad cabe, avisa en vez de subir algo que el bucket rechazaría", async () => {
    const codec = fakeCodec({ width: 4000, height: 3000 }, () => 9000);
    await expect(
      compressImage(fakeFile(8 * MB), { codec, maxBytes: LIMIT }),
    ).rejects.toThrow("No se pudo reducir la foto a 5 MB");
    expect(codec.encoded).toHaveLength(5);
  });

  it("rechaza una foto original por encima del tope de entrada", async () => {
    const codec = fakeCodec({ width: 4000, height: 3000 }, () => 1000);
    await expect(
      compressImage(fakeFile(25 * MB), { codec, maxBytes: LIMIT }),
    ).rejects.toThrow("demasiado grande");
    expect(codec.dimensions).not.toHaveBeenCalled();
  });
});
