import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { ORG_COOKIE } from "@/constants/auth";
import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";
import type { MembershipWithOrganization } from "@/types";

export type SessionContext = {
  supabase: SupabaseClient;
  userId: string;
  organizationId: string;
  membership: MembershipWithOrganization;
};

/**
 * Sesión, organización activa y rol para una Server Action. La autorización
 * real vive en RLS; esto evita disparar consultas que la base va a rechazar y
 * permite devolver un mensaje entendible en vez de un error de Postgres.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const memberships = await new MembershipService(supabase).listActiveForUser(
    user.id,
  );
  if (memberships.length === 0) return null;

  const cookieOrgId = (await cookies()).get(ORG_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.organizationId === cookieOrgId) ??
    (memberships.length === 1 ? memberships[0] : undefined);
  if (!membership) return null;

  return {
    supabase,
    userId: user.id,
    organizationId: membership.organizationId,
    membership,
  };
}

/** Contexto de un dueño. Devuelve `null` si no hay sesión o el rol no alcanza. */
export async function getOwnerContext(): Promise<SessionContext | null> {
  const context = await getSessionContext();
  if (!context || context.membership.role !== "owner") return null;
  return context;
}
