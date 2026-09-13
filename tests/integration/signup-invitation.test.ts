import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import ws from "ws";

import { generateInvitationToken, hashInvitationToken } from "@/lib/invitations/token";
import { InvitationService } from "@/services/invitation-service";

import { GEEKO, localSupabaseEnv, signIn } from "./fair-support";

/**
 * KAM-23 · Solo una invitación vigente crea una cuenta, contra la API de Auth
 * local de verdad —con el hook `before_user_created` que registra
 * `supabase/config.toml`— (spec `production-operations` → *Only a pending
 * invitation can create an account*).
 *
 * Escenarios: «Signing up without an invitation is rejected», «A spent
 * invitation does not open the door», «A pending invitation lets the invitee
 * sign up», «Existing users are unaffected».
 */

function anon(): SupabaseClient {
  const { url, publishableKey } = localSupabaseEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

const GEEKO_OWNER_ID = "20000000-0000-0000-0000-000000000004";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@kamay.test`;
}

/**
 * Una invitación sembrada como la dejaría la persona dueña desde V15: con su
 * sesión y bajo RLS —el service role ni siquiera puede escribir aquí—.
 */
async function invite(email: string, overrides: Record<string, unknown> = {}) {
  const token = generateInvitationToken();
  const owner = await signIn(GEEKO.owner);
  const { error } = await owner
    .from("invitations")
    .insert({
      organization_id: GEEKO.organizationId,
      email,
      role: "assistant",
      token_hash: hashInvitationToken(token),
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      invited_by: GEEKO_OWNER_ID,
      ...overrides,
    });
  if (error) throw new Error(`No se pudo sembrar la invitación: ${error.message}`);
  return token;
}

describe("alta de cuentas limitada a invitaciones", () => {
  it("sin invitación, la API de Auth rechaza el alta y no crea cuenta", async () => {
    const email = uniqueEmail("intruso");
    const { data, error } = await anon().auth.signUp({ email, password: "kamay12345" });

    expect(error?.status).toBe(403);
    expect(error?.message).toContain("no tiene registro público");
    expect(data.user).toBeNull();
  });

  it("una invitación vencida no abre la puerta", async () => {
    const email = uniqueEmail("vencida");
    await invite(email, { expires_at: new Date(Date.now() - 86_400_000).toISOString() });

    const { error } = await anon().auth.signUp({ email, password: "kamay12345" });
    expect(error?.status).toBe(403);
  });

  it("con una invitación vigente, la persona crea su cuenta y acepta la invitación", async () => {
    const email = uniqueEmail("invitada");
    const token = await invite(email);

    const client = anon();
    const { data, error } = await client.auth.signUp({ email, password: "kamay12345" });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();

    // El mismo camino que `signUpAndAccept`: con su sesión, canjea el token.
    const organizationId = await new InvitationService(client).accept(token);
    expect(organizationId).toBe(GEEKO.organizationId);
  });

  it("quien ya tiene cuenta sigue entrando como siempre", async () => {
    await expect(signIn(GEEKO.owner)).resolves.toBeDefined();
  });
});
