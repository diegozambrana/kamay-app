import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActiveAccess } from "@/lib/auth/access";
import {
  getRequestAccess,
  getRequestPlatformAdmin,
  getRequestUser,
} from "@/lib/auth/request-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Sesión, organización activa y **rol efectivo** (KAM-26, design D6).
 *
 * Toda comprobación de rol lee `role`, nunca `membership.role`: un
 * administrador de la plataforma actúa como dueño aunque su membresía diga
 * otra cosa, o aunque no tenga ninguna (`membership` es `null` entonces).
 */
export type SessionContext = {
  supabase: SupabaseClient;
  userId: string;
} & ActiveAccess;

/**
 * Sesión, organización activa y rol para una Server Action. La autorización
 * real vive en RLS; esto evita disparar consultas que la base va a rechazar y
 * permite devolver un mensaje entendible en vez de un error de Postgres.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await getRequestUser();
  if (!user) return null;

  const resolution = await getRequestAccess();
  if (resolution?.kind !== "active") return null;

  const supabase = await createClient();
  return { supabase, userId: user.id, ...resolution.access };
}

/** Contexto de un dueño. Devuelve `null` si no hay sesión o el rol no alcanza. */
export async function getOwnerContext(): Promise<SessionContext | null> {
  const context = await getSessionContext();
  if (!context || context.role !== "owner") return null;
  return context;
}

/**
 * Contexto de un administrador de la plataforma, con o sin organización
 * activa: las vistas *Organizaciones* y *Usuarios* no dependen de ninguna.
 * `null` para cualquier otra cuenta.
 */
export type PlatformAdminContext = {
  supabase: SupabaseClient;
  userId: string;
  /** La organización en la que está, si eligió una. */
  access: ActiveAccess | null;
};

export async function getPlatformAdminContext(): Promise<PlatformAdminContext | null> {
  const user = await getRequestUser();
  if (!user) return null;
  if (!(await getRequestPlatformAdmin())) return null;

  const resolution = await getRequestAccess();
  const supabase = await createClient();
  return {
    supabase,
    userId: user.id,
    access: resolution?.kind === "active" ? resolution.access : null,
  };
}
