import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { OrderShareService } from "./order-share-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const ORDER = "22222222-2222-2222-2222-222222222222";
const USER = "33333333-3333-3333-3333-333333333333";
const SHARE = "44444444-4444-4444-4444-444444444444";
const COMMENT = "55555555-5555-5555-5555-555555555555";

const shareRow = {
  id: SHARE,
  organization_id: ORG,
  order_id: ORDER,
  expires_at: "2027-03-19T10:00:00.000Z",
  created_by: USER,
  created_at: "2026-09-20T10:00:00.000Z",
  archived_at: null,
};

describe("OrderShareService.getActive", () => {
  it("mapea el enlace vigente", async () => {
    const client = new FakeClient([{ data: shareRow, error: null }]);

    const share = await new OrderShareService(client.asSupabase()).getActive(ORG, ORDER);

    expect(share?.id).toBe(SHARE);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("null cuando no hay ninguno vigente", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    const share = await new OrderShareService(client.asSupabase()).getActive(ORG, ORDER);

    expect(share).toBeNull();
  });
});

describe("OrderShareService.create", () => {
  it("guarda el hash y devuelve el token en claro una sola vez", async () => {
    const client = new FakeClient([{ data: shareRow, error: null }]);

    const { token, share } = await new OrderShareService(client.asSupabase()).create(ORG, {
      orderId: ORDER,
      createdBy: USER,
    });

    expect(share.id).toBe(SHARE);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);

    const inserted = client.queries[0].argsOf("insert")?.[0] as Record<string, unknown>;
    expect(inserted.token_hash).not.toBe(token);
    expect(inserted.token_hash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("un pedido con enlace vigente da un mensaje claro", async () => {
    const client = new FakeClient([{ data: null, error: { message: "duplicate", code: "23505" } }]);

    await expect(
      new OrderShareService(client.asSupabase()).create(ORG, { orderId: ORDER, createdBy: USER }),
    ).rejects.toThrow(/ya tiene un enlace vigente/);
  });
});

describe("OrderShareService.regenerate", () => {
  it("rota el token si el enlace no está revocado", async () => {
    const client = new FakeClient([{ data: { id: SHARE }, error: null }]);

    const token = await new OrderShareService(client.asSupabase()).regenerate(ORG, SHARE);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("lanza un mensaje claro si ya está revocado", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await expect(
      new OrderShareService(client.asSupabase()).regenerate(ORG, SHARE),
    ).rejects.toThrow(/ya no está vigente/);
  });
});

describe("OrderShareService.revoke", () => {
  it("fija archived_at, nunca borra", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new OrderShareService(client.asSupabase()).revoke(ORG, SHARE);

    const updated = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(updated.archived_at).toEqual(expect.any(String));
  });
});

describe("OrderShareService.listComments / archiveComment", () => {
  it("lista solo los vigentes, del más reciente al más viejo", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            id: COMMENT,
            organization_id: ORG,
            order_id: ORDER,
            author_name: "Cliente",
            body: "Un comentario",
            occurred_at: "2026-09-20T10:00:00.000Z",
            archived_at: null,
          },
        ],
        error: null,
      },
    ]);

    const comments = await new OrderShareService(client.asSupabase()).listComments(ORG, ORDER);

    expect(comments).toHaveLength(1);
    expect(comments[0].authorName).toBe("Cliente");
    expect(client.queries[0].has("is", "archived_at", null)).toBe(true);
  });

  it("archivar un comentario fija archived_at", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new OrderShareService(client.asSupabase()).archiveComment(ORG, COMMENT);

    const updated = client.queries[0].argsOf("update")?.[0] as Record<string, unknown>;
    expect(updated.archived_at).toEqual(expect.any(String));
  });
});
