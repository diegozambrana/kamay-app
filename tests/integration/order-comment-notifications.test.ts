import { execFileSync } from "node:child_process";

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import ws from "ws";

import { emitOrderCommentReceived } from "@/services/notifications/emit-order-comment-events";

import { signIn } from "./fair-support";
import { adminClient, countNotifications } from "./notifications-support";

/**
 * `createAdminClient()` (dentro de `emitOrderCommentReceived`) lee las
 * variables del entorno del proceso, que `next dev` carga de `.env.local`
 * pero que `vitest` no carga por sí solo. Se leen aquí de la misma fuente
 * que ya usa `notifications-support.ts` (`supabase status -o env`), y solo
 * si todavía no están puestas — no pisar lo que ya trajera el entorno real.
 *
 * También completa el `WebSocket` global: `createAdminClient()` no pasa un
 * `transport` como `adminClient()` de este mismo directorio, y Node 20 —el
 * que corre esta suite— no trae uno nativo (mismo hallazgo que
 * `order-request-notifications.test.ts` de KAM-28).
 */
function ensureAdminClientEnv(): void {
  if (!("WebSocket" in globalThis)) {
    (globalThis as { WebSocket?: unknown }).WebSocket = ws;
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  const output = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  const get = (name: string) => output.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];

  process.env.NEXT_PUBLIC_SUPABASE_URL ??= get("API_URL");
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= get("SECRET_KEY") ?? get("SERVICE_ROLE_KEY");
}

/**
 * KAM-32 · El aviso de «comentario recibido», contra la base real.
 *
 * Escenarios de la delta spec `notifications` de `public-order-share` —
 * "El comentario del cliente genera el aviso de comentario recibido, solo a
 * los dueños": «El dueño se entera sin abrir el detalle», «El ayudante no la
 * recibe», «Apagado, no generado», «Un solo aviso por comentario». Mismo
 * patrón que `order-request-notifications.test.ts` de KAM-28 — organización
 * propia y desechable, nunca Geeko, porque la prueba apaga y prende una
 * preferencia real.
 */

let admin: SupabaseClient;
let organizationId: string;
let ownerId: string;
let ownerEmail: string;
let assistantId: string;

const RUN = Date.now();

async function createUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "kamay123",
    email_confirm: true,
  });
  if (error) throw new Error(`usuario: ${error.message}`);
  return data.user.id;
}

beforeAll(async () => {
  ensureAdminClientEnv();
  admin = adminClient();

  ownerEmail = `it-orc-owner-${RUN}@kamay.test`;
  ownerId = await createUser(ownerEmail);
  assistantId = await createUser(`it-orc-assistant-${RUN}@kamay.test`);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `IT comentarios ${RUN}` })
    .select("id")
    .single();
  if (orgError) throw new Error(`organización: ${orgError.message}`);
  organizationId = org.id;

  const { error: membershipError } = await admin.from("memberships").insert([
    { organization_id: organizationId, user_id: ownerId, role: "owner" },
    { organization_id: organizationId, user_id: assistantId, role: "assistant" },
  ]);
  if (membershipError) throw new Error(`membresías: ${membershipError.message}`);
});

describe("aviso de comentario recibido", () => {
  // Scenario: El dueño se entera sin abrir el detalle
  it("el dueño recibe el aviso con el tipo order_comment_received", async () => {
    const orderId = crypto.randomUUID();
    const commentId = crypto.randomUUID();
    const before = await countNotifications(admin, {
      userId: ownerId,
      type: "order_comment_received",
    });

    await emitOrderCommentReceived({
      organizationId,
      orderId,
      commentId,
      title: "Nuevo comentario",
      body: "Cliente Prueba dejó un comentario en el enlace público.",
    });

    const after = await countNotifications(admin, {
      userId: ownerId,
      type: "order_comment_received",
    });
    expect(after).toBe(before + 1);
  });

  // Scenario: El ayudante no la recibe
  it("el ayudante no recibe ninguno, aunque sea la misma organización", async () => {
    const orderId = crypto.randomUUID();
    const commentId = crypto.randomUUID();

    await emitOrderCommentReceived({
      organizationId,
      orderId,
      commentId,
      title: "Nuevo comentario",
      body: "Otro cliente dejó un comentario.",
    });

    expect(
      await countNotifications(admin, {
        userId: assistantId,
        type: "order_comment_received",
      }),
    ).toBe(0);
  });

  // Scenario: Apagado, no generado
  it("con la preferencia apagada, no se genera nada para el dueño", async () => {
    // `notification_preferences` solo admite escritura de `authenticated`
    // (revoke general + grant explícito, ver migración de notificaciones):
    // el cliente de servicio no tiene `insert`/`update` sobre la tabla, así
    // que aquí hay que entrar como el propio dueño, igual que haría la app.
    const owner = await signIn({ email: ownerEmail, password: "kamay123" });
    const { error } = await owner
      .from("notification_preferences")
      .upsert(
        {
          organization_id: organizationId,
          user_id: ownerId,
          order_comment_received: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      );
    if (error) throw new Error(`preferencia: ${error.message}`);

    const orderId = crypto.randomUUID();
    const commentId = crypto.randomUUID();
    const before = await countNotifications(admin, {
      userId: ownerId,
      type: "order_comment_received",
    });

    await emitOrderCommentReceived({
      organizationId,
      orderId,
      commentId,
      title: "Nuevo comentario",
      body: "Un tercer cliente dejó un comentario.",
    });

    expect(
      await countNotifications(admin, {
        userId: ownerId,
        type: "order_comment_received",
      }),
    ).toBe(before);

    // Se repone para no dejar la organización de prueba apagada por si algo
    // más la reutiliza dentro de esta misma corrida.
    await owner
      .from("notification_preferences")
      .upsert(
        {
          organization_id: organizationId,
          user_id: ownerId,
          order_comment_received: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      );
  });

  // Scenario: Un solo aviso por comentario
  it("procesar el mismo comentario dos veces no duplica el aviso", async () => {
    const orderId = crypto.randomUUID();
    const commentId = crypto.randomUUID();

    await emitOrderCommentReceived({
      organizationId,
      orderId,
      commentId,
      title: "Nuevo comentario",
      body: "Cliente repetido.",
    });
    const afterFirst = await countNotifications(admin, {
      userId: ownerId,
      type: "order_comment_received",
    });

    await emitOrderCommentReceived({
      organizationId,
      orderId,
      commentId,
      title: "Nuevo comentario",
      body: "Cliente repetido.",
    });
    const afterSecond = await countNotifications(admin, {
      userId: ownerId,
      type: "order_comment_received",
    });

    expect(afterSecond).toBe(afterFirst);
  });

  // Scenario: Un fallo al avisar no deshace la recepción
  it("nunca lanza, aunque la organización no exista", async () => {
    await expect(
      emitOrderCommentReceived({
        organizationId: "00000000-0000-0000-0000-000000000000",
        orderId: "00000000-0000-0000-0000-000000000000",
        commentId: "00000000-0000-0000-0000-000000000000",
        title: "Nuevo comentario",
        body: null,
      }),
    ).resolves.toBeUndefined();
  });
});
