import "server-only";

import sharp from "sharp";

/**
 * La miniatura de una imagen subida (KAM-23, `performance-budget` → *Images
 * are served optimized*).
 *
 * Los listados y los detalles pintan fotos de 36 a 240 px, y hasta aquí
 * descargaban el archivo original —hasta 5 MB— para cada una. La miniatura se
 * genera **una vez, al subir**, en el servidor: funciona con cualquier plan de
 * Storage, no cuesta nada por visita y no depende de que las URLs firmadas
 * —que cambian en cada petición— se puedan guardar en caché.
 *
 * 480 px en el lado mayor cubren la foto más grande que se muestra (la de la
 * galería del ítem, ~240 px) en una pantalla de densidad 2.
 */
export const THUMBNAIL_MAX_EDGE = 480;
export const THUMBNAIL_MIME = "image/webp";

/** El sufijo de la miniatura, junto al original y en su misma carpeta. */
export function thumbnailPath(storagePath: string): string {
  return `${storagePath}.thumb.webp`;
}

/**
 * La miniatura en WebP, o `null` si el archivo no es una imagen que se pueda
 * leer. Nunca lanza: una miniatura que no se genera deja la pantalla con el
 * original, que es como estaba, y no puede tumbar la subida.
 */
export async function makeThumbnail(
  body: ArrayBuffer | Blob,
  mimeType: string | null,
): Promise<Uint8Array | null> {
  if (!mimeType?.startsWith("image/") || mimeType === "image/svg+xml") return null;

  try {
    const input = Buffer.from(body instanceof Blob ? await body.arrayBuffer() : body);
    const output = await sharp(input, { failOn: "error" })
      // Las fotos del celular vienen giradas por su EXIF: se aplica antes de
      // recortar, y el EXIF —con la ubicación— no pasa a la miniatura.
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_EDGE,
        height: THUMBNAIL_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 70 })
      .toBuffer();
    return new Uint8Array(output);
  } catch {
    return null;
  }
}
