import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { AttachmentService } from "./attachment-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";
const ITEM = "33333333-3333-3333-3333-333333333333";
const ATTACHMENT = "44444444-4444-4444-4444-444444444444";

const row = {
  id: ATTACHMENT,
  organization_id: ORG,
  entity_type: "item",
  entity_id: ITEM,
  bucket: "item-photos",
  storage_path: `${ORG}/item/${ITEM}/${ATTACHMENT}.jpg`,
  file_name: "taza.jpg",
  mime_type: "image/jpeg",
  size_bytes: 120000,
  created_at: "2026-08-26T12:00:00Z",
  archived_at: null,
};

const newPhoto = {
  id: ATTACHMENT,
  entityType: "item" as const,
  entityId: ITEM,
  bucket: "item-photos",
  fileName: "taza.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 120000,
  body: new ArrayBuffer(8),
};

describe("AttachmentService.storagePath", () => {
  it("empieza por la organización: es lo que verifica la política de Storage", () => {
    const path = AttachmentService.storagePath(
      ORG,
      "item",
      ITEM,
      ATTACHMENT,
      "taza.jpg",
    );

    expect(path).toBe(`${ORG}/item/${ITEM}/${ATTACHMENT}.jpg`);
  });

  it("el nombre del archivo no llega a la ruta: solo su extensión", () => {
    // Un nombre con barras o acentos rompería la ruta y la política.
    const path = AttachmentService.storagePath(
      ORG,
      "item",
      ITEM,
      ATTACHMENT,
      "../../fotos/ñandú raro.JPEG",
    );

    expect(path).toBe(`${ORG}/item/${ITEM}/${ATTACHMENT}.jpeg`);
  });

  it("un archivo sin extensión no deja un punto suelto", () => {
    expect(
      AttachmentService.storagePath(ORG, "item", ITEM, ATTACHMENT, "sin-extension"),
    ).toBe(`${ORG}/item/${ITEM}/${ATTACHMENT}`);
  });
});

describe("AttachmentService", () => {
  it("sube al bucket y registra la fila con la ruta calculada", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    await new AttachmentService(client.asSupabase()).upload(ORG, USER, newPhoto);

    const upload = client.storageCalls[0];
    expect(upload.bucket).toBe("item-photos");
    expect(upload.args[0]).toBe(`${ORG}/item/${ITEM}/${ATTACHMENT}.jpg`);

    const inserted = client.queries[0].argsOf("insert")?.[0] as Record<
      string,
      unknown
    >;
    expect(inserted.organization_id).toBe(ORG);
    expect(inserted.uploaded_by).toBe(USER);
    expect(inserted.storage_path).toBe(`${ORG}/item/${ITEM}/${ATTACHMENT}.jpg`);
  });

  it("si la fila falla, retira el objeto: nada de basura invisible", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "violates row-level security" } },
    ]);

    await expect(
      new AttachmentService(client.asSupabase()).upload(ORG, USER, newPhoto),
    ).rejects.toThrow("No se pudo registrar el adjunto");

    expect(client.storageCalls.map((call) => call.method)).toEqual([
      "upload",
      "remove",
    ]);
  });

  it("no pide adjuntos cuando no hay registros que consultar", async () => {
    const client = new FakeClient([]);
    const found = await new AttachmentService(client.asSupabase()).listForEntities(
      ORG,
      "item",
      [],
    );

    expect(found).toEqual([]);
    expect(client.queries).toHaveLength(0);
  });

  it("pide los adjuntos vigentes de varios registros de una vez", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    await new AttachmentService(client.asSupabase()).listForEntities(ORG, "item", [
      ITEM,
    ]);

    const query = client.queries[0];
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("in", "entity_id", [ITEM])).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
  });

  it("firma las lecturas: los buckets son privados", async () => {
    const client = new FakeClient([]);
    client.storageResults.signed = {
      data: [{ path: row.storage_path, signedUrl: "https://firmada" }],
      error: null,
    };

    const urls = await new AttachmentService(client.asSupabase()).signedUrls([
      {
        id: ATTACHMENT,
        organizationId: ORG,
        entityType: "item",
        entityId: ITEM,
        bucket: "item-photos",
        storagePath: row.storage_path,
        fileName: "taza.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 120000,
        uploadedBy: null,
        createdAt: row.created_at,
        archivedAt: null,
      },
    ]);

    expect(urls.get(ATTACHMENT)).toBe("https://firmada");
  });

  it("una firma fallida deja la fila sin imagen, no tumba el listado", async () => {
    const client = new FakeClient([]);
    client.storageResults.signed = { data: null, error: { message: "nope" } };

    const urls = await new AttachmentService(client.asSupabase()).signedUrls([
      {
        id: ATTACHMENT,
        organizationId: ORG,
        entityType: "item",
        entityId: ITEM,
        bucket: "item-photos",
        storagePath: row.storage_path,
        fileName: "taza.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 120000,
        uploadedBy: null,
        createdAt: row.created_at,
        archivedAt: null,
      },
    ]);

    expect(urls.size).toBe(0);
  });
});

describe("AttachmentService.listForEntity", () => {
  it("lee los adjuntos vigentes de un registro, del más nuevo al más viejo", async () => {
    const client = new FakeClient([{ data: [{ ...row, uploaded_by: USER }], error: null }]);

    const adjuntos = await new AttachmentService(client.asSupabase()).listForEntity(
      ORG,
      "task",
      ITEM,
    );

    const query = client.queries[0];
    expect(client.tables[0]).toBe("attachments");
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "entity_type", "task")).toBe(true);
    expect(query.has("eq", "entity_id", ITEM)).toBe(false);
    // Un solo registro se resuelve con el mismo `in` del caso de varios: es la
    // misma consulta, no una segunda ruta que pueda divergir.
    expect(query.has("in", "entity_id", [ITEM])).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    expect(query.has("order", "created_at", { ascending: false })).toBe(true);

    expect(adjuntos[0].uploadedBy).toBe(USER);
  });
});

describe("AttachmentService.countActive", () => {
  it("cuenta solo los vigentes del registro, sin traerse las filas", async () => {
    const client = new FakeClient([{ data: null, error: null, count: 13 }]);

    const total = await new AttachmentService(client.asSupabase()).countActive(
      ORG,
      "task",
      ITEM,
    );

    expect(total).toBe(13);

    const query = client.queries[0];
    expect(query.argsOf("select")).toEqual(["id", { count: "exact", head: true }]);
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "entity_type", "task")).toBe(true);
    expect(query.has("eq", "entity_id", ITEM)).toBe(true);
    // Sin esto, un adjunto retirado seguiría ocupando ranura.
    expect(query.has("is", "archived_at", null)).toBe(true);
  });

  it("una tarea sin adjuntos cuenta cero, no indefinido", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    expect(
      await new AttachmentService(client.asSupabase()).countActive(ORG, "task", ITEM),
    ).toBe(0);
  });

  it("un fallo al contar no se traga: el límite no puede decidirse a ciegas", async () => {
    const client = new FakeClient([{ data: null, error: { message: "sin conexión" } }]);

    await expect(
      new AttachmentService(client.asSupabase()).countActive(ORG, "task", ITEM),
    ).rejects.toThrow(/No se pudieron contar los adjuntos/);
  });
});

/**
 * KAM-21 · Llevar un adjunto de una tarea al registro que la tarea creó.
 *
 * Cubre el diseño D6: `attachments` lleva `unique (bucket, storage_path)`, así
 * que compartir el objeto entre dos filas no es posible y la copia es real.
 */
describe("AttachmentService.copyToEntity", () => {
  const source = {
    id: ATTACHMENT,
    organizationId: ORG,
    entityType: "task" as const,
    entityId: "55555555-5555-5555-5555-555555555555",
    bucket: "attachments",
    storagePath: `${ORG}/task/55555555-5555-5555-5555-555555555555/${ATTACHMENT}.jpg`,
    fileName: "taza.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 120000,
    uploadedBy: USER,
    createdAt: "2026-09-09T12:00:00Z",
    archivedAt: null,
  };

  it("copia el objeto a la carpeta del destino y no reutiliza la ruta de origen", async () => {
    const client = new FakeClient([]);
    const copied = await new AttachmentService(client.asSupabase()).copyToEntity(
      ORG,
      source,
      "item",
      ITEM,
    );

    // La ruta nueva cuelga del ítem, no de la tarea: una fila con la ruta de
    // origen chocaría contra `unique (bucket, storage_path)`.
    expect(copied.storagePath).not.toBe(source.storagePath);
    expect(copied.storagePath).toBe(`${ORG}/item/${ITEM}/${copied.id}.jpg`);
    expect(copied.id).not.toBe(source.id);
  });

  it("copia dentro del mismo bucket, de la ruta vieja a la nueva", async () => {
    const client = new FakeClient([]);
    const copied = await new AttachmentService(client.asSupabase()).copyToEntity(
      ORG,
      source,
      "item",
      ITEM,
    );

    expect(client.storageCalls).toEqual([
      {
        bucket: "attachments",
        method: "copy",
        args: [source.storagePath, copied.storagePath],
      },
      // La miniatura viaja con el original (KAM-23).
      {
        bucket: "attachments",
        method: "copy",
        args: [`${source.storagePath}.thumb.webp`, `${copied.storagePath}.thumb.webp`],
      },
    ]);
  });

  it("conserva nombre, tipo y peso del original", async () => {
    const client = new FakeClient([]);
    const copied = await new AttachmentService(client.asSupabase()).copyToEntity(
      ORG,
      source,
      "item",
      ITEM,
    );

    expect(copied.fileName).toBe("taza.jpg");
    expect(copied.mimeType).toBe("image/jpeg");
    expect(copied.sizeBytes).toBe(120000);
  });

  it("no devuelve nada que insertar si la copia falla", async () => {
    const client = new FakeClient([]);
    client.storageResults.copy = { error: { message: "sin espacio" } };

    await expect(
      new AttachmentService(client.asSupabase()).copyToEntity(
        ORG,
        source,
        "item",
        ITEM,
      ),
    ).rejects.toThrow("No se pudo copiar el adjunto");
  });
});

/** KAM-23 · Miniaturas (`performance-budget` → *Images are served optimized*). */
describe("AttachmentService · miniaturas", () => {
  async function jpeg(width: number, height: number): Promise<ArrayBuffer> {
    const buffer = await sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .jpeg()
      .toBuffer();
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }

  it("una foto subida deja su miniatura WebP junto al original", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    await new AttachmentService(client.asSupabase()).upload(ORG, USER, {
      ...newPhoto,
      body: await jpeg(1200, 900),
    });

    const uploads = client.storageCalls.filter((call) => call.method === "upload");
    expect(uploads.map((call) => call.args[0])).toEqual([
      `${ORG}/item/${ITEM}/${ATTACHMENT}.jpg`,
      `${ORG}/item/${ITEM}/${ATTACHMENT}.jpg.thumb.webp`,
    ]);
    expect(uploads[1].args[2]).toMatchObject({ contentType: "image/webp" });
  });

  it("un archivo que no es imagen no deja miniatura", async () => {
    const client = new FakeClient([{ data: { ...row, mime_type: "application/pdf" }, error: null }]);
    await new AttachmentService(client.asSupabase()).upload(ORG, USER, {
      ...newPhoto,
      fileName: "factura.pdf",
      mimeType: "application/pdf",
    });

    expect(client.storageCalls.filter((call) => call.method === "upload")).toHaveLength(1);
  });

  it("si la miniatura no se puede subir, la subida del original sigue valiendo", async () => {
    const client = new FakeClient([{ data: row, error: null }]);
    client.storageResults.upload = { error: null };
    let calls = 0;
    const original = client.storage.from;
    client.storage.from = (bucket: string) => {
      const api = original(bucket);
      return {
        ...api,
        upload: async (...args: unknown[]) => {
          calls += 1;
          if (calls === 2) throw new Error("Storage caído");
          return api.upload(...args);
        },
      };
    };

    await expect(
      new AttachmentService(client.asSupabase()).upload(ORG, USER, {
        ...newPhoto,
        body: await jpeg(800, 600),
      }),
    ).resolves.toMatchObject({ id: ATTACHMENT });
  });

  it("firma la miniatura si existe y el original si no", async () => {
    const withThumb = { ...row, id: "a1", storage_path: `${ORG}/item/${ITEM}/a1.jpg` };
    const withoutThumb = { ...row, id: "a2", storage_path: `${ORG}/item/${ITEM}/a2.jpg` };
    const client = new FakeClient([]);
    client.storageResults.signed = {
      data: [
        { path: `${withThumb.storage_path}.thumb.webp`, signedUrl: "https://s/a1-thumb" },
        { path: withThumb.storage_path, signedUrl: "https://s/a1" },
        // La miniatura de a2 no existe: vuelve sin URL.
        { path: `${withoutThumb.storage_path}.thumb.webp`, signedUrl: "" },
        { path: withoutThumb.storage_path, signedUrl: "https://s/a2" },
      ],
      error: null,
    };

    const service = new AttachmentService(client.asSupabase());
    const urls = await service.signedThumbnailUrls(
      [withThumb, withoutThumb].map((attachment) => ({
        id: attachment.id,
        organizationId: ORG,
        entityType: "item" as const,
        entityId: ITEM,
        bucket: attachment.bucket,
        storagePath: attachment.storage_path,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        sizeBytes: attachment.size_bytes,
        uploadedBy: USER,
        createdAt: attachment.created_at,
        archivedAt: null,
      })),
    );

    expect(urls.get("a1")).toBe("https://s/a1-thumb");
    expect(urls.get("a2")).toBe("https://s/a2");
    // Una sola petición de firma por bucket, miniatura y original juntos.
    expect(client.storageCalls.filter((call) => call.method === "createSignedUrls")).toHaveLength(1);
  });

  it("retirar objetos huérfanos se lleva también sus miniaturas", async () => {
    const client = new FakeClient([]);
    await new AttachmentService(client.asSupabase()).removeObjects("attachments", ["o/p/1.jpg"]);

    expect(client.storageCalls).toEqual([
      { bucket: "attachments", method: "remove", args: [["o/p/1.jpg", "o/p/1.jpg.thumb.webp"]] },
    ]);
  });
});
