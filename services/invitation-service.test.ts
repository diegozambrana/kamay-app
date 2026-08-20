import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { InvitationService } from "./invitation-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const INVITER = "22222222-2222-2222-2222-222222222222";

const invitationRow = {
  id: "33333333-3333-3333-3333-333333333333",
  organization_id: ORG,
  email: "ayudante@kamay.test",
  role: "assistant" as const,
  expires_at: "2026-08-27T00:00:00.000Z",
  accepted_at: null,
  archived_at: null,
  created_at: "2026-08-20T00:00:00.000Z",
};

describe("InvitationService", () => {
  it("lista solo las pendientes de su organización", async () => {
    const client = new FakeClient([{ data: [invitationRow], error: null }]);

    const pending = await new InvitationService(client.asSupabase()).listPending(
      ORG,
    );

    const query = client.queries[0];
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("is", "accepted_at", null)).toBe(true);
    expect(query.has("is", "archived_at", null)).toBe(true);
    expect(pending[0]).toEqual({
      id: invitationRow.id,
      organizationId: ORG,
      email: "ayudante@kamay.test",
      role: "assistant",
      expiresAt: invitationRow.expires_at,
      acceptedAt: null,
      archivedAt: null,
      createdAt: invitationRow.created_at,
    });
  });

  it("guarda el hash del token y devuelve el token una sola vez", async () => {
    const client = new FakeClient([{ data: invitationRow, error: null }]);

    const { token } = await new InvitationService(client.asSupabase()).create(
      ORG,
      { email: "ayudante@kamay.test", role: "assistant", invitedBy: INVITER },
    );

    const [payload] = client.queries[0].argsOf("insert") as [
      Record<string, unknown>,
    ];

    // Lo que viaja a la base es el hash, nunca el token.
    expect(payload.token_hash).toBe(
      `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`,
    );
    expect(payload.token_hash).not.toContain(token);
    expect(payload).toMatchObject({
      organization_id: ORG,
      email: "ayudante@kamay.test",
      role: "assistant",
      invited_by: INVITER,
    });
    expect(new Date(payload.expires_at as string).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("dos invitaciones nunca comparten token", async () => {
    const client = new FakeClient([
      { data: invitationRow, error: null },
      { data: invitationRow, error: null },
    ]);
    const service = new InvitationService(client.asSupabase());
    const input = {
      email: "ayudante@kamay.test",
      role: "assistant" as const,
      invitedBy: INVITER,
    };

    const first = await service.create(ORG, input);
    const second = await service.create(ORG, input);

    expect(first.token).not.toBe(second.token);
  });

  it("revocar archiva en lugar de borrar", async () => {
    const client = new FakeClient([{ data: null, error: null }]);

    await new InvitationService(client.asSupabase()).revoke(
      ORG,
      invitationRow.id,
    );

    const [payload] = client.queries[0].argsOf("update") as [
      { archived_at: string },
    ];
    expect(payload.archived_at).toEqual(expect.any(String));
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("aceptar delega en la función de la base y devuelve la organización", async () => {
    const client = new FakeClient([{ data: ORG, error: null }]);

    const organizationId = await new InvitationService(
      client.asSupabase(),
    ).accept("token-en-claro");

    expect(client.rpcCalls[0]).toEqual({
      name: "accept_invitation",
      params: { p_token: "token-en-claro" },
    });
    expect(organizationId).toBe(ORG);
  });

  it("no delata el motivo cuando la aceptación falla", async () => {
    const client = new FakeClient([
      { data: null, error: { message: "invitation expired at 2026-08-01" } },
    ]);

    await expect(
      new InvitationService(client.asSupabase()).accept("token"),
    ).rejects.toThrow("La invitación no es válida o ya fue utilizada.");
  });

  it("lista las membresías de la organización, archivadas incluidas", async () => {
    const client = new FakeClient([
      {
        data: [
          {
            id: "44444444-4444-4444-4444-444444444444",
            organization_id: ORG,
            user_id: "55555555-5555-5555-5555-555555555555",
            role: "assistant",
            display_name: "Ayudante Geeko",
            archived_at: null,
          },
        ],
        error: null,
      },
    ]);

    const members = await new InvitationService(
      client.asSupabase(),
    ).listMembers(ORG);

    expect(members[0]).toEqual({
      id: "44444444-4444-4444-4444-444444444444",
      organizationId: ORG,
      userId: "55555555-5555-5555-5555-555555555555",
      role: "assistant",
      displayName: "Ayudante Geeko",
      archivedAt: null,
    });
  });

  it("cambia el rol y archiva filtrando siempre por organización", async () => {
    const client = new FakeClient([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const service = new InvitationService(client.asSupabase());

    await service.changeRole(ORG, "44444444-4444-4444-4444-444444444444", "owner");
    expect(client.queries[0].argsOf("update")).toEqual([{ role: "owner" }]);
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);

    await service.archiveMembership(ORG, "44444444-4444-4444-4444-444444444444");
    const [payload] = client.queries[1].argsOf("update") as [
      { archived_at: string },
    ];
    expect(payload.archived_at).toEqual(expect.any(String));
    expect(client.queries[1].has("eq", "organization_id", ORG)).toBe(true);
  });

  it("propaga los errores de escritura con su contexto", async () => {
    const failing = { data: null, error: { message: "sin política" } };
    const service = (results: typeof failing[]) =>
      new InvitationService(new FakeClient(results).asSupabase());

    await expect(service([failing]).listPending(ORG)).rejects.toThrow(
      /No se pudieron cargar las invitaciones/,
    );
    await expect(
      service([failing]).create(ORG, {
        email: "a@b.test",
        role: "assistant",
        invitedBy: INVITER,
      }),
    ).rejects.toThrow(/No se pudo crear la invitación/);
    await expect(service([failing]).revoke(ORG, "x")).rejects.toThrow(
      /No se pudo revocar la invitación/,
    );
    await expect(service([failing]).listMembers(ORG)).rejects.toThrow(
      /No se pudieron cargar las membresías/,
    );
    await expect(
      service([failing]).changeRole(ORG, "x", "owner"),
    ).rejects.toThrow(/No se pudo cambiar el rol/);
    await expect(
      service([failing]).archiveMembership(ORG, "x"),
    ).rejects.toThrow(/No se pudo archivar la membresía/);
  });
});
