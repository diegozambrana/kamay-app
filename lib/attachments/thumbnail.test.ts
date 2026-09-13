import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { makeThumbnail, THUMBNAIL_MAX_EDGE, thumbnailPath } from "./thumbnail";

/** Una foto grande con ruido: comprime mal, como una de verdad. */
async function photo(width: number, height: number): Promise<ArrayBuffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 7919) % 251;
  const jpeg = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
  return jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer;
}

describe("makeThumbnail", () => {
  it("reduce una foto grande a WebP de 480 px en su lado mayor, y mucho más liviana", async () => {
    const original = await photo(1600, 1200);
    const thumbnail = await makeThumbnail(original, "image/jpeg");

    expect(thumbnail).not.toBeNull();
    const meta = await sharp(Buffer.from(thumbnail!)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(THUMBNAIL_MAX_EDGE);
    expect(meta.height).toBe(360);
    expect(thumbnail!.byteLength).toBeLessThan(original.byteLength / 4);
  });

  it("no agranda una imagen que ya es pequeña", async () => {
    const thumbnail = await makeThumbnail(await photo(200, 100), "image/jpeg");
    const meta = await sharp(Buffer.from(thumbnail!)).metadata();
    expect([meta.width, meta.height]).toEqual([200, 100]);
  });

  it("acepta un Blob, que es lo que llega de un formulario", async () => {
    const blob = new Blob([await photo(800, 600)], { type: "image/jpeg" });
    expect(await makeThumbnail(blob, "image/jpeg")).not.toBeNull();
  });

  it("no genera nada para lo que no es una imagen, ni para un SVG", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4").buffer as ArrayBuffer;
    expect(await makeThumbnail(pdf, "application/pdf")).toBeNull();
    expect(await makeThumbnail(pdf, null)).toBeNull();
    expect(await makeThumbnail(pdf, "image/svg+xml")).toBeNull();
  });

  it("una imagen corrupta no lanza: devuelve null", async () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]).buffer as ArrayBuffer;
    await expect(makeThumbnail(broken, "image/jpeg")).resolves.toBeNull();
  });
});

describe("thumbnailPath", () => {
  it("vive junto al original, en la misma carpeta de la organización", () => {
    expect(thumbnailPath("org/item/i1/a1.jpg")).toBe("org/item/i1/a1.jpg.thumb.webp");
  });
});
