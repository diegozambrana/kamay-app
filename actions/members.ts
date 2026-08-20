"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { setActiveOrganizationCookie } from "@/lib/auth/post-auth";
import { getOwnerContext } from "@/lib/auth/session-context";
import { createClient } from "@/lib/supabase/server";
import { InvitationService } from "@/services/invitation-service";

export type MemberActionResult = { error: string } | undefined;

/** La invitación devuelve su enlace una sola vez: en la base solo queda el hash. */
export type InviteResult = { error: string } | { inviteUrl: string };

const NOT_OWNER = "Solo la persona dueña puede gestionar el equipo.";

/** Un solo mensaje para todos los fallos, igual que la función de la base. */
const INVALID_INVITATION = "La invitación no es válida o ya fue utilizada.";

const inviteSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  role: z.enum(["owner", "assistant"]),
});

const membershipSchema = z.object({ membershipId: z.uuid() });

export async function inviteMember(
  input: z.infer<typeof inviteSchema>,
): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  // El origen se toma de la petición, no del cliente: el enlace que se le
  // muestra al dueño para copiar debe apuntar siempre a esta aplicación.
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  try {
    const { token } = await new InvitationService(context.supabase).create(
      context.organizationId,
      {
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        invitedBy: context.userId,
      },
    );

    revalidatePath("/settings/members");
    return { inviteUrl: `${origin}/auth/invite/${token}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key")) {
      return { error: "Ese correo ya tiene una invitación pendiente." };
    }
    return { error: "No se pudo crear la invitación. Intenta de nuevo." };
  }
}

export async function revokeInvitation(input: {
  invitationId: string;
}): Promise<MemberActionResult> {
  const parsed = z.object({ invitationId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la invitación." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new InvitationService(context.supabase).revoke(
      context.organizationId,
      parsed.data.invitationId,
    );
  } catch {
    return { error: "No se pudo revocar la invitación. Intenta de nuevo." };
  }

  revalidatePath("/settings/members");
}

export async function changeMemberRole(
  input: z.infer<typeof membershipSchema> & { role: "owner" | "assistant" },
): Promise<MemberActionResult> {
  const parsed = membershipSchema
    .extend({ role: z.enum(["owner", "assistant"]) })
    .safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la membresía." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new InvitationService(context.supabase).changeRole(
      context.organizationId,
      parsed.data.membershipId,
      parsed.data.role,
    );
  } catch {
    return { error: "No se pudo cambiar el rol. Intenta de nuevo." };
  }

  revalidatePath("/", "layout");
}

export async function archiveMembership(
  input: z.infer<typeof membershipSchema>,
): Promise<MemberActionResult> {
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la membresía." };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    await new InvitationService(context.supabase).archiveMembership(
      context.organizationId,
      parsed.data.membershipId,
    );
  } catch (error) {
    // La guardia del último dueño vive en la base; su mensaje ya es claro.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("dueño activo")) {
      return {
        error: "La organización debe conservar al menos una persona dueña.",
      };
    }
    return { error: "No se pudo archivar la membresía. Intenta de nuevo." };
  }

  revalidatePath("/", "layout");
}

/**
 * Canjea el token de invitación. No es una acción de dueño: la ejecuta quien
 * fue invitado, que aún no pertenece a ninguna organización.
 */
export async function acceptInvitation(
  token: string,
): Promise<{ error: string } | { organizationId: string }> {
  // No se usa `getSessionContext`: quien acepta todavía no tiene ninguna
  // membresía, y es justamente esta llamada la que le crea la primera.
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión para aceptar la invitación." };

  try {
    const organizationId = await new InvitationService(supabase).accept(token);
    // Entrar directo a la organización recién aceptada, sin pasar por la
    // pantalla de selección.
    await setActiveOrganizationCookie(organizationId);
    revalidatePath("/", "layout");
    return { organizationId };
  } catch {
    return { error: INVALID_INVITATION };
  }
}

const signUpSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  token: z.string().min(1),
});

/**
 * Alta de cuenta desde un enlace de invitación: es la única puerta de entrada,
 * porque en Kamay no hay registro público. Si el alta funciona pero la
 * invitación no es válida, la cuenta queda creada y sin organización — el
 * layout de `(app)` ya sabe mostrar ese estado.
 */
export async function signUpAndAccept(
  input: z.infer<typeof signUpSchema>,
): Promise<{ error: string } | { organizationId: string }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "No se pudo crear la cuenta con ese correo." };
  }

  if (!data.session) {
    return {
      error:
        "Revisa tu correo para confirmar la cuenta y vuelve a abrir el enlace.",
    };
  }

  return acceptInvitation(parsed.data.token);
}
