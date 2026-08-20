"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { resolvePostAuthPath, setActiveOrganizationCookie } from "@/lib/auth/post-auth";
import { defaultLandingPath, sanitizeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";
import { headers } from "next/headers";

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
  // Solo una organización a la que el usuario pertenece activamente.
  if (!membership) redirect("/auth/select-org");

  await setActiveOrganizationCookie(membership.organizationId);

  const userAgent = (await headers()).get("user-agent");
  redirect(next ?? defaultLandingPath(userAgent));
}
