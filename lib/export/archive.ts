import { Zip, ZipDeflate, strToU8 } from "fflate";

/**
 * Un archivo dentro de la exportación: su ruta y su contenido. El contenido
 * puede llegar entero o por partes —una tabla grande se escribe página a
 * página y nunca entera en memoria—.
 */
export type ArchiveEntry = {
  name: string;
  content: string | Uint8Array | AsyncIterable<string>;
};

/**
 * El archivo comprimido de la exportación completa (KAM-23, design D5).
 *
 * **Por flujo.** Cada entrada se comprime y se entrega apenas llega, sin
 * armar el archivo entero en memoria: doce meses de bitácora de una
 * organización activa no caben cómodamente en la memoria de una función, y la
 * exportación tiene que poder pedirse en cualquier momento, también cuando hay
 * muchos datos.
 *
 * Las entradas llegan como un iterable asíncrono: quien las produce —el
 * servicio que lee tabla por tabla— puede ir leyendo la siguiente mientras
 * esta se comprime.
 *
 * Función pura sobre flujos: no sabe de Supabase ni de la petición, y se
 * prueba descomprimiendo lo que devuelve.
 */
export function zipStream(entries: AsyncIterable<ArchiveEntry>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (error) {
          controller.error(error);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      try {
        for await (const entry of entries) {
          const file = new ZipDeflate(entry.name, { level: 6 });
          zip.add(file);
          if (typeof entry.content === "string") {
            file.push(strToU8(entry.content), true);
          } else if (entry.content instanceof Uint8Array) {
            file.push(entry.content, true);
          } else {
            for await (const part of entry.content) file.push(strToU8(part));
            file.push(new Uint8Array(0), true);
          }
        }
        zip.end();
      } catch (error) {
        zip.terminate();
        controller.error(error);
      }
    },
  });
}

/** `kamay-exportacion-geeko-store-2026-09-11.zip` */
export function exportFilename(organizationName: string, date: string): string {
  const slug = organizationName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `kamay-exportacion-${slug || "organizacion"}-${date}.zip`;
}
