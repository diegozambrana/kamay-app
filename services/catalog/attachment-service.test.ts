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
        createdAt: row.created_at,
        archivedAt: null,
      },
    ]);

    expect(urls.size).toBe(0);
  });
});
