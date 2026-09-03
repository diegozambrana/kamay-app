import { IMAGE_ACCEPT, MAX_FILE_SIZE } from "@/lib/catalog/photos";

/**
 * Compresión de imágenes en el navegador, sin dependencia nueva (design D4).
 *
 * Una foto de comprobante sale del celular con 8 MB y el límite de subida es
 * 5 MB (regla de crecimiento de la especificación). Reducir el lado mayor a
 * 1600 px y recodificar basta para cualquier comprobante legible; si aun así
 * no cabe, se baja la calidad por escalones.
 */

/** Tope de cordura para la foto original: no se intenta decodificar más. */
export const RECEIPT_INPUT_MAX_BYTES = 20 * 1024 * 1024;

/** Lado mayor tras comprimir: suficiente para leer un comprobante. */
export const DEFAULT_MAX_EDGE = 1600;

/** Calidades que se prueban en orden hasta que el resultado cabe. */
export const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.45] as const;

const ACCEPTED_TYPES = new Set(IMAGE_ACCEPT.split(","));

export const UNSUPPORTED_FORMAT_MESSAGE =
  "Formato no admitido. Usa una foto JPEG, PNG, WebP o AVIF.";

export function isAcceptedImage(type: string): boolean {
  return ACCEPTED_TYPES.has(type);
}

export type ImageSize = { width: number; height: number };

/**
 * Tamaño destino: se encoge el lado mayor a `maxEdge` conservando la
 * proporción; una imagen ya pequeña no se agranda.
 */
export function targetSize(size: ImageSize, maxEdge: number): ImageSize {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return { width: size.width, height: size.height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Lo que la compresión necesita del navegador, separado para poder probarla
 * sin canvas: leer las dimensiones y codificar a un tamaño y calidad.
 */
export type ImageCodec = {
  dimensions(file: File): Promise<ImageSize>;
  encode(file: File, size: ImageSize, quality: number): Promise<Blob>;
};

/** Codec real: `createImageBitmap` + `canvas.toBlob`, WebP con reserva JPEG. */
export const browserCodec: ImageCodec = {
  async dimensions(file) {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  },

  async encode(file, size, quality) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen.");
      context.drawImage(bitmap, 0, 0, size.width, size.height);

      const webp = await toBlob(canvas, "image/webp", quality);
      // Un navegador sin WebP devuelve otro tipo (PNG, normalmente): se
      // recodifica en JPEG, que sí es universal.
      if (webp && webp.type === "image/webp") return webp;

      const jpeg = await toBlob(canvas, "image/jpeg", quality);
      if (!jpeg) throw new Error("No se pudo comprimir la imagen.");
      return jpeg;
    } finally {
      bitmap.close();
    }
  },
};

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

export type CompressOptions = {
  maxEdge?: number;
  maxBytes?: number;
  codec?: ImageCodec;
};

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

function renamed(name: string, type: string): string {
  const extension = EXTENSIONS[type];
  if (!extension) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${extension}`;
}

/**
 * Devuelve un archivo que pesa `maxBytes` o menos.
 *
 * Una imagen que ya cabe y no supera `maxEdge` se devuelve tal cual: no hay
 * motivo para recodificar (y perder calidad) lo que ya está bien. En
 * cualquier otro caso se recodifica, probando calidades decrecientes hasta
 * caber; si ninguna cabe, se lanza un error comprensible en vez de subir un
 * archivo que el bucket rechazaría.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const maxBytes = options.maxBytes ?? MAX_FILE_SIZE;
  const codec = options.codec ?? browserCodec;

  if (!isAcceptedImage(file.type)) {
    throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  }
  if (file.size > RECEIPT_INPUT_MAX_BYTES) {
    throw new Error("La foto es demasiado grande para procesarla: elige otra.");
  }

  const original = await codec.dimensions(file);
  const size = targetSize(original, maxEdge);
  const needsResize = size.width !== original.width || size.height !== original.height;

  if (!needsResize && file.size <= maxBytes) return file;

  for (const quality of QUALITY_STEPS) {
    const blob = await codec.encode(file, size, quality);
    if (blob.size <= maxBytes) {
      return new File([blob], renamed(file.name, blob.type), {
        type: blob.type,
        lastModified: file.lastModified,
      });
    }
  }

  throw new Error("No se pudo reducir la foto a 5 MB: prueba con otra.");
}
