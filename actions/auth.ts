"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ORG_COOKIE } from "@/constants/auth";
import { PLATFORM_HOME } from "@/lib/auth/access";
import { resolvePostAuthPath, setActiveOrganizationCookie } from "@/lib/auth/post-auth";
import { defaultLandingPath, sanitizeNextPath } from "@/lib/auth/routes";
import { getPlatformAdminContext } from "@/lib/auth/session-context";
import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";
import { PlatformService } from "@/services/platform/platform-service";

export type AuthActionResult = { error: string } | undefined;

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  next: z.string().nullable(),
});

export async function login(
  input: z.infer<typeof loginSchema>,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Revisa el correo y la contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect(await resolvePostAuthPath(supabase, parsed.data.next));
}

const emailSchema = z.object({ email: z.email() });

export async function requestPasswordReset(input: {
  email: string;
}): Promise<AuthActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ingresa un correo válido." };
  }

  const supabase = await createClient();
  // La plantilla de correo lleva a /auth/confirm (token_hash) → /auth/reset-password.
  // No se revela si el correo existe o no.
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  return undefined;
}

const passwordSchema = z.object({ password: z.string().min(6) });

export async function updatePassword(input: {
  password: string;
}): Promise<AuthActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "No se pudo actualizar la contraseña. Pide un enlace nuevo." };
  }

  redirect(await resolvePostAuthPath(supabase, null));
}

export async function selectOrganization(formData: FormData): Promise<void> {
  const organizationId = formData.get("organizationId");
  const next = sanitizeNextPath(formData.get("next")?.toString());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const memberships = await new MembershipService(supabase).listActiveForUser(
    user.id,
  );
  const membership = memberships.find(
    (m) => m.organizationId === organizationId,
  );
  // Solo una organización a la que el usuario pertenece activamente. El
  // administrador de la plataforma no elige aquí (KAM-26): entra por el
  // selector del menú lateral o por la vista Organizaciones.
  if (!membership) {
    if (await new PlatformService(supabase).isPlatformAdmin()) redirect(PLATFORM_HOME);
    redirect("/auth/select-org");
  }

  await setActiveOrganizationCookie(membership.organizationId);

  const userAgent = (await headers()).get("user-agent");
  redirect(next ?? defaultLandingPath(userAgent));
}

/**
 * Entrar a una organización —o salir a la vista de plataforma con `null`—
 * como administrador de la plataforma (KAM-26, design D8). La usan el
 * selector del menú lateral y el botón "Entrar" de la vista Organizaciones.
 *
 * Solo acepta organizaciones que existen y no están archivadas; cualquier
 * otra cosa vuelve a la vista de plataforma sin tocar la cookie. Quien no es
 * super admin no tiene nada que hacer aquí y vuelve a su inicio.
 */
export async function enterOrganization(organizationId: string | null): Promise<void> {
  const userAgent = (await headers()).get("user-agent");
  const context = await getPlatformAdminContext();
  if (!context) redirect(defaultLandingPath(userAgent));

  const cookieStore = await cookies();
  if (organizationId === null) {
    cookieStore.delete(ORG_COOKIE);
    redirect(PLATFORM_HOME);
  }

  const organization = await new PlatformService(context.supabase).findActiveOrganization(
    organizationId,
  );
  if (!organization) redirect(PLATFORM_HOME);

  await setActiveOrganizationCookie(organization.id);
  redirect(defaultLandingPath(userAgent));
}

/**
 * Cierra la sesión desde el menú de cuenta (KAM-24). Limpia también la cookie
 * de organización activa: quien vuelva a entrar debe pasar de nuevo por la
 * selección si tiene más de una, en vez de heredar la de la sesión anterior.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ORG_COOKIE);

  redirect("/auth/login");
}
