import { execFileSync } from "node:child_process";

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import ws from "ws";

import { emitOrderRequestReceived } from "@/services/notifications/emit-order-request-events";

import { signIn } from "./fair-support";
import { adminClient, countNotifications } from "./notifications-support";

/**
 * `createAdminClient()` (dentro de `emitOrderRequestReceived`) lee las
 * variables del entorno del proceso, que `next dev` carga de `.env.local`
 * pero que `vitest` no carga por sí solo. Se leen aquí de la misma fuente
 * que ya usa `notifications-support.ts` (`supabase status -o env`), y solo
 * si todavía no están puestas — no pisar lo que ya trajera el entorno real.
 *
 * También completa el `WebSocket` global: `createAdminClient()` no pasa un
 * `transport` como `adminClient()` de este mismo directorio, y Node 20 —el
 * que corre esta suite— no trae uno nativo. Es lo mismo que ese archivo ya
 * resuelve por su cuenta, hecho aquí porque este camino pasa por el cliente
 * de la aplicación y no por el de apoyo de las pruebas.
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
 * KAM-28 · El aviso de «solicitud de pedido recibida», contra la base real.
 *
 * Escenarios de la delta spec `notifications` de `public-order-intake` —
 * "El envío público genera el aviso de solicitud recibida, solo a los
 * dueños": «El dueño se entera sin abrir la bandeja», «El ayudante no la
 * recibe», «Apagado, no generado», «Un solo aviso por solicitud».
 *
 * Organización propia y desechable (nunca Geeko): la prueba apaga y prende
 * una preferencia real, y hacerlo sobre la organización compartida afectaría
 * a cualquier otra sesión que esté corriendo pruebas o e2e al mismo tiempo.
 * Sin limpieza posible (convención nº 3): todo se mide en deltas.
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

  ownerEmail = `it-orq-owner-${RUN}@kamay.test`;
  ownerId = await createUser(ownerEmail);
  assistantId = await createUser(`it-orq-assistant-${RUN}@kamay.test`);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `IT solicitudes ${RUN}` })
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

describe("aviso de solicitud de pedido recibida", () => {
  // Scenario: El dueño se entera sin abrir la bandeja
  it("el dueño recibe el aviso con el tipo order_request_received", async () => {
    const requestId = `00000000-0000-0000-0000-${(RUN % 1_000_000_000).toString().padStart(12, "0")}`;
    const before = await countNotifications(admin, {
      userId: ownerId,
      type: "order_request_received",
    });

    await emitOrderRequestReceived({
      organizationId,
      requestId,
      title: "Nueva solicitud de pedido",
      body: "Cliente Prueba mandó sus datos por el enlace público.",
    });

    const after = await countNotifications(admin, {
      userId: ownerId,
      type: "order_request_received",
    });
    expect(after).toBe(before + 1);
  });

  // Scenario: El ayudante no la recibe
  it("el ayudante no recibe ninguno, aunque sea la misma organización", async () => {
    const requestId = `00000000-0000-0000-0000-${((RUN + 1) % 1_000_000_000).toString().padStart(12, "0")}`;

    await emitOrderRequestReceived({
      organizationId,
      requestId,
      title: "Nueva solicitud de pedido",
      body: "Otro cliente mandó sus datos.",
    });

    expect(
      await countNotifications(admin, {
        userId: assistantId,
        type: "order_request_received",
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
          order_request_received: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      );
    if (error) throw new Error(`preferencia: ${error.message}`);

    const requestId = `00000000-0000-0000-0000-${((RUN + 2) % 1_000_000_000).toString().padStart(12, "0")}`;
    const before = await countNotifications(admin, {
      userId: ownerId,
      type: "order_request_received",
    });

    await emitOrderRequestReceived({
      organizationId,
      requestId,
      title: "Nueva solicitud de pedido",
      body: "Un tercer cliente mandó sus datos.",
    });

    expect(
      await countNotifications(admin, {
        userId: ownerId,
        type: "order_request_received",
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
          order_request_received: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      );
  });

  // Scenario: Un solo aviso por solicitud
  it("procesar la misma solicitud dos veces no duplica el aviso", async () => {
    const requestId = `00000000-0000-0000-0000-${((RUN + 3) % 1_000_000_000).toString().padStart(12, "0")}`;

    await emitOrderRequestReceived({
      organizationId,
      requestId,
      title: "Nueva solicitud de pedido",
      body: "Cliente repetido.",
    });
    const afterFirst = await countNotifications(admin, {
      userId: ownerId,
      type: "order_request_received",
    });

    await emitOrderRequestReceived({
      organizationId,
      requestId,
      title: "Nueva solicitud de pedido",
      body: "Cliente repetido.",
    });
    const afterSecond = await countNotifications(admin, {
      userId: ownerId,
      type: "order_request_received",
    });

    expect(afterSecond).toBe(afterFirst);
  });

  // Scenario: Un fallo al avisar no deshace la recepción
  it("nunca lanza, aunque la organización no exista", async () => {
    await expect(
      emitOrderRequestReceived({
        organizationId: "00000000-0000-0000-0000-000000000000",
        requestId: "00000000-0000-0000-0000-000000000000",
        title: "Nueva solicitud de pedido",
        body: null,
      }),
    ).resolves.toBeUndefined();
  });
});
