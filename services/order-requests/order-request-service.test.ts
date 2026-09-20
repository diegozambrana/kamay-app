import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { OrderRequestService } from "./order-request-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const LINE = "22222222-2222-2222-2222-222222222222";
const USER = "33333333-3333-3333-3333-333333333333";
const REQUEST = "44444444-4444-4444-4444-444444444444";
const ORDER = "55555555-5555-5555-5555-555555555555";

const row = {
  id: REQUEST,
  organization_id: ORG,
  business_line_id: LINE,
  contact_id: null,
  prefilled_name: "Cliente Real",
  prefilled_phone: "70099999",
  declared_name: null,
  declared_phone: null,
  declared_note: null,
  expires_at: "2026-09-27T10:00:00.000Z",
  submitted_at: null,
  order_id: null,
  created_by: USER,
  created_at: "2026-09-20T10:00:00.000Z",
  archived_at: null,
};

describe("OrderRequestService.list", () => {
  it("mapea las filas a la forma de la entidad", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);

    const requests = await new OrderRequestService(client.asSupabase()).list(ORG);

    expect(requests).toEqual([
      {
        id: REQUEST,
        organizationId: ORG,
        businessLineId: LINE,
        contactId: null,
        prefilledName: "Cliente Real",
        prefilledPhone: "70099999",
        declaredName: null,
        declaredPhone: null,
        declaredNote: null,
        expiresAt: "2026-09-27T10:00:00.000Z",
        submittedAt: null,
        orderId: null,
        createdBy: USER,
        createdAt: "2026-09-20T10:00:00.000Z",
        archivedAt: null,
      },
    ]);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });
});

describe("OrderRequestService.create", () => {
  it("guarda el hash del token y devuelve el token en claro una sola vez", async () => {
    const client = new FakeClient([{ data: row, error: null }]);

    const { token, orderRequest } = await new OrderRequestService(
      client.asSupabase(),
    ).create(ORG, {
      id: REQUEST,
      businessLineId: LINE,
      contactId: null,
      prefilledName: "Cliente Real",
      prefilledPhone: "70099999",
      createdBy: USER,
    });

    expect(orderRequest.id).toBe(REQUEST);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);

    const inserted = client.queries[0].argsOf("insert")?.[0] as Record<
      string,
      unknown
    >;
    expect(inserted.token_hash).not.toBe(token);
    expect(inserted.token_hash).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(inserted.organization_id).toBe(ORG);
  });
});

describe("OrderRequestService.regenerate", () => {
  it("rota el token solo si la fila sigue esperando al cliente", async () => {
    const client = new FakeClient([{ data: { id: REQUEST }, error: null }]);

    const token = await new OrderRequestService(client.asSupabase()).regenerate(
      ORG,
      REQUEST,
    );

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(client.queries[0].has("is", "submitted_at", null)).toBe(true);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("lanza un mensaje claro si ya no está esperando al cliente", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await expect(
      new OrderRequestService(client.asSupabase()).regenerate(ORG, REQUEST),
    ).rejects.toThrow(/ya no está esperando al cliente/);
  });
});

describe("OrderRequestService.discard", () => {
  it("fija archived_at, nunca borra", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new OrderRequestService(client.asSupabase()).discard(ORG, REQUEST);

    const updated = client.queries[0].argsOf("update")?.[0] as Record<
      string,
      unknown
    >;
    expect(updated.archived_at).toEqual(expect.any(String));
  });
});

describe("OrderRequestService.quarantineImages", () => {
  it("lista los objetos de la carpeta y firma sus URLs", async () => {
    const client = new FakeClient([]);
    client.storageResults.list = {
      data: [{ id: "obj-1", name: "foto.jpg" }],
      error: null,
    };
    client.storageResults.signed = {
      data: [{ path: `${ORG}/${REQUEST}/foto.jpg`, signedUrl: "https://signed" }],
      error: null,
    };

    const images = await new OrderRequestService(client.asSupabase()).quarantineImages(
      ORG,
      REQUEST,
    );

    expect(images).toEqual([
      { path: `${ORG}/${REQUEST}/foto.jpg`, name: "foto.jpg", signedUrl: "https://signed" },
    ]);
    expect(client.storageCalls[0]).toMatchObject({
      bucket: "order-requests",
      method: "list",
      args: [`${ORG}/${REQUEST}`],
    });
  });

  it("una carpeta vacía no pide URLs firmadas", async () => {
    const client = new FakeClient([]);
    client.storageResults.list = { data: [], error: null };

    const images = await new OrderRequestService(client.asSupabase()).quarantineImages(
      ORG,
      REQUEST,
    );

    expect(images).toEqual([]);
    expect(client.storageCalls.some((call) => call.method === "createSignedUrls")).toBe(
      false,
    );
  });
});

describe("OrderRequestService.accept", () => {
  it("copia cada imagen a attachments y fija order_id al final", async () => {
    const client = new FakeClient([
      // insert de attachments para cada imagen, y el update final de order_requests.
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    client.storageResults.list = {
      data: [
        { id: "obj-1", name: "una.jpg" },
        { id: "obj-2", name: "dos.jpg" },
      ],
      error: null,
    };

    await new OrderRequestService(client.asSupabase()).accept(ORG, REQUEST, ORDER, USER);

    const copies = client.storageCalls.filter((call) => call.method === "copy");
    expect(copies).toHaveLength(2);
    expect(copies[0].args[2]).toEqual({ destinationBucket: "attachments" });

    expect(client.tables.filter((t) => t === "attachments")).toHaveLength(2);

    const finalUpdate = client.queries.at(-1)!;
    expect(finalUpdate.argsOf("update")?.[0]).toEqual({ order_id: ORDER });
    expect(finalUpdate.has("eq", "id", REQUEST)).toBe(true);
  });

  it("una copia ya hecha (reintento) no interrumpe el resto", async () => {
    const client = new FakeClient([
      { data: null, error: null }, // insert de attachments
      { data: null, error: null }, // update final
    ]);
    client.storageResults.list = {
      data: [{ id: "obj-1", name: "una.jpg" }],
      error: null,
    };
    client.storageResults.copy = { error: { message: "The resource already exists" } };

    await expect(
      new OrderRequestService(client.asSupabase()).accept(ORG, REQUEST, ORDER, USER),
    ).resolves.toBeUndefined();
  });

  it("sin imágenes, solo fija order_id", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    client.storageResults.list = { data: [], error: null };

    await new OrderRequestService(client.asSupabase()).accept(ORG, REQUEST, ORDER, USER);

    expect(client.storageCalls.some((call) => call.method === "copy")).toBe(false);
    expect(client.tables).toEqual(["order_requests"]);
  });
});
