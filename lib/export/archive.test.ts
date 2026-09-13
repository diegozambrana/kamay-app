import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { exportFilename, zipStream, type ArchiveEntry } from "./archive";

async function* from(entries: ArchiveEntry[]) {
  for (const entry of entries) yield entry;
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

describe("zipStream", () => {
  it("empaqueta cada entrada con su nombre y su contenido intacto", async () => {
    const zip = await collect(
      zipStream(
        from([
          { name: "pedidos.csv", content: "id,total\r\na1,45.00\r\n" },
          { name: "bitacora/purga-2025.csv", content: "evento\r\nSublimación\r\n" },
        ]),
      ),
    );

    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["bitacora/purga-2025.csv", "pedidos.csv"]);
    expect(strFromU8(files["pedidos.csv"])).toBe("id,total\r\na1,45.00\r\n");
    expect(strFromU8(files["bitacora/purga-2025.csv"])).toContain("Sublimación");
  });

  it("sin entradas produce un archivo válido y vacío", async () => {
    const files = unzipSync(await collect(zipStream(from([]))));
    expect(Object.keys(files)).toEqual([]);
  });

  it("un fallo al producir una entrada corta el flujo con error", async () => {
    async function* broken(): AsyncIterable<ArchiveEntry> {
      yield { name: "uno.csv", content: "a" };
      throw new Error("la lectura falló");
    }
    await expect(collect(zipStream(broken()))).rejects.toThrow("la lectura falló");
  });
});

describe("exportFilename", () => {
  it("lleva la organización sin acentos y la fecha", () => {
    expect(exportFilename("Geeko Store", "2026-09-11")).toBe(
      "kamay-exportacion-geeko-store-2026-09-11.zip",
    );
    expect(exportFilename("Cerámica Ñandú", "2026-09-11")).toBe(
      "kamay-exportacion-ceramica-nandu-2026-09-11.zip",
    );
  });
});

describe("zipStream · contenido por partes", () => {
  it("una entrada que llega en trozos sale entera y en orden", async () => {
    async function* parts() {
      yield "id\r\n";
      yield "a1\r\n";
      yield "a2\r\n";
    }
    const files = unzipSync(await collect(zipStream(from([{ name: "t.csv", content: parts() }]))));
    expect(strFromU8(files["t.csv"])).toBe("id\r\na1\r\na2\r\n");
  });
});
