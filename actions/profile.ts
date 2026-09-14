"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { verifyCurrentPassword } from "@/lib/supabase/verify-password";
import { MembershipService } from "@/services/membership-service";

export type ProfileActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, "Ingresa un nombre."),
});

/** Cambia el nombre visible de la propia membresía en la organización activa. */
export async function updateDisplayName(
  input: z.infer<typeof displayNameSchema>,
): Promise<ProfileActionResult> {
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new MembershipService(context.supabase).setOwnDisplayName(
      context.organizationId,
      parsed.data.displayName,
    );
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo guardar el nombre.",
    };
  }

  // El nombre nuevo aparece en el shell y en cualquier pantalla que lo
  // muestre (menú de cuenta, equipo, asignados de tareas).
  revalidatePath("/", "layout");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual."),
  newPassword: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

/**
 * Cambia la contraseña tras verificar la actual (KAM-24, design D2).
 *
 * `supabase.auth.updateUser({ password })` no la exige bajo la configuración
 * de este proyecto, así que se verifica aparte, sin tocar la sesión real.
 */
export async function changePassword(
  input: z.infer<typeof changePasswordSchema>,
): Promise<ProfileActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const {
    data: { user },
  } = await context.supabase.auth.getUser();
  if (!user?.email) return { error: NO_SESSION };

  const currentPasswordIsValid = await verifyCurrentPassword(
    user.email,
    parsed.data.currentPassword,
  );
  if (!currentPasswordIsValid) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await context.supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) {
    return { error: "No se pudo actualizar la contraseña. Intenta de nuevo." };
  }

  revalidatePath("/", "layout");
}
