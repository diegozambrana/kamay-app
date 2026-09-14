"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { z } from "zod";

import { getPlatformAdminContext } from "@/lib/auth/session-context";
import { inviteUrlFor } from "@/lib/invitations/invite-url";
import { defaultDisplayName } from "@/lib/platform/users";
import {
  addAccountSchema,
  assignmentSchema,
  membershipNameSchema,
  membershipRoleSchema,
  membershipTargetSchema,
  organizationSchema,
  updateOrganizationSchema,
} from "@/lib/platform/schema";
import { InvitationService } from "@/services/invitation-service";
import {
  type AssignmentOutcome,
  MembershipAdminService,
} from "@/services/platform/membership-admin-service";
import { OrganizationAdminService } from "@/services/platform/organization-admin-service";
import { UserAdminService } from "@/services/platform/user-admin-service";

/**
 * Acciones de la plataforma (KAM-26): crear y editar organizaciones y
 * gestionar el equipo de cualquiera de ellas.
 *
 * Todas pasan por `getPlatformAdminContext()`, que devuelve `null` a quien no
 * es super admin: no se llega a disparar una consulta que la base rechazaría.
 * La autorización de verdad sigue en RLS —con sesión, nunca con el service
 * role—, y cada cambio queda en la bitácora de la organización con la marca
 * del administrador de la plataforma.
 */

export type PlatformActionResult = { error: string } | undefined;

const NOT_PLATFORM_ADMIN = "Solo el administrador de la plataforma puede hacer esto.";

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos.";

function revalidatePlatform(organizationId?: string, userId?: string) {
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/users");
  if (organizationId) revalidatePath(`/admin/organizations/${organizationId}`);
  if (userId) revalidatePath(`/admin/users/${userId}`);
}

/** Crea la organización y devuelve su id, para ir a su detalle. */
export async function createOrganization(
  input: z.input<typeof organizationSchema>,
): Promise<{ error: string } | { organizationId: string }> {
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  try {
    const organizationId = await new OrganizationAdminService(context.supabase).create(
      parsed.data,
    );
    revalidatePlatform(organizationId);
    return { organizationId };
  } catch {
    return { error: "No se pudo crear la organización. Intenta de nuevo." };
  }
}

export async function updateOrganization(
  input: z.input<typeof updateOrganizationSchema>,
): Promise<PlatformActionResult> {
  const parsed = updateOrganizationSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  const { organizationId, ...data } = parsed.data;
  try {
    await new OrganizationAdminService(context.supabase).update(organizationId, data);
  } catch {
    return { error: "No se pudo guardar la organización. Intenta de nuevo." };
  }

  revalidatePlatform(organizationId);
  // El nombre y la zona horaria se ven en el cascarón si está dentro de ella.
  revalidatePath("/", "layout");
}

/**
 * Asigna una cuenta a una o varias organizaciones de una vez. Devuelve el
 * resultado de cada una: que la cuenta ya perteneciera a una no oculta las
 * demás.
 */
export async function assignMemberships(
  input: z.input<typeof assignmentSchema>,
): Promise<{ error: string } | { outcomes: AssignmentOutcome[] }> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  const outcomes = await new MembershipAdminService(context.supabase).assign(
    parsed.data.userId,
    parsed.data.assignments,
  );

  revalidatePlatform(undefined, parsed.data.userId);
  for (const { organizationId } of parsed.data.assignments) {
    revalidatePath(`/admin/organizations/${organizationId}`);
  }
  return { outcomes };
}

/**
 * «Agregar usuario» (KAM-26, design D9): una sola puerta para sumar a alguien
 * a una organización, desde *Usuarios* o desde el detalle de la organización.
 *
 * - Si hay una cuenta con ese correo, se la agrega con el rol elegido —o se
 *   reactiva su membresía archivada; si ya pertenecía, se dice y no se toca—.
 * - Si no la hay, se crea la invitación de un solo uso de siempre y se
 *   devuelve su enlace: la cuenta nace al aceptarla. Crearla aquí
 *   necesitaría el service role en una acción de usuario (convención nº 2).
 *
 * Por correo y no eligiendo de una lista: la lista serían todas las cuentas
 * de la plataforma, y ninguna vista pide una tabla entera.
 */
export type AddUserResult =
  | { error: string }
  | { kind: "created" | "restored" | "already_member"; email: string }
  | { kind: "invited"; email: string; inviteUrl: string };

export async function addUserToOrganization(
  input: z.input<typeof addAccountSchema>,
): Promise<AddUserResult> {
  const parsed = addAccountSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  const { organizationId, role } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  const account = await new UserAdminService(context.supabase).findByEmail(email);

  if (account) {
    const [outcome] = await new MembershipAdminService(context.supabase).assign(account.id, [
      {
        organizationId,
        role,
        displayName: parsed.data.displayName || defaultDisplayName(account),
      },
    ]);
    if (outcome.status === "failed") {
      return { error: "No se pudo agregar la cuenta. Intenta de nuevo." };
    }
    revalidatePlatform(organizationId, account.id);
    return { kind: outcome.status, email: account.email };
  }

  const host = (await headers()).get("host") ?? "";
  try {
    const { token } = await new InvitationService(context.supabase).create(organizationId, {
      email,
      role,
      invitedBy: context.userId,
    });
    revalidatePlatform(organizationId);
    return { kind: "invited", email, inviteUrl: inviteUrlFor(host, token) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key")) {
      return { error: "Ese correo ya tiene una invitación pendiente en esta organización." };
    }
    return { error: "No se pudo crear la invitación. Intenta de nuevo." };
  }
}

export async function setMembershipRole(
  input: z.input<typeof membershipRoleSchema>,
): Promise<PlatformActionResult> {
  const parsed = membershipRoleSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la membresía." };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  try {
    await new InvitationService(context.supabase).changeRole(
      parsed.data.organizationId,
      parsed.data.membershipId,
      parsed.data.role,
    );
  } catch {
    return { error: "No se pudo cambiar el rol. Intenta de nuevo." };
  }

  revalidatePlatform(parsed.data.organizationId);
}

export async function setMembershipDisplayName(
  input: z.input<typeof membershipNameSchema>,
): Promise<PlatformActionResult> {
  const parsed = membershipNameSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  try {
    await new MembershipAdminService(context.supabase).setDisplayName(
      parsed.data.organizationId,
      parsed.data.membershipId,
      parsed.data.displayName,
    );
  } catch {
    return { error: "No se pudo cambiar el nombre. Intenta de nuevo." };
  }

  revalidatePlatform(parsed.data.organizationId);
}

/** Quitar el acceso. El último dueño activo lo protege la base. */
export async function archiveMembership(
  input: z.input<typeof membershipTargetSchema>,
): Promise<PlatformActionResult> {
  const parsed = membershipTargetSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la membresía." };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  try {
    await new InvitationService(context.supabase).archiveMembership(
      parsed.data.organizationId,
      parsed.data.membershipId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("al menos un dueño")) {
      return { error: "La organización debe conservar al menos un dueño activo." };
    }
    return { error: "No se pudo quitar el acceso. Intenta de nuevo." };
  }

  revalidatePlatform(parsed.data.organizationId);
}

export async function restoreMembership(
  input: z.input<typeof membershipTargetSchema>,
): Promise<PlatformActionResult> {
  const parsed = membershipTargetSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la membresía." };

  const context = await getPlatformAdminContext();
  if (!context) return { error: NOT_PLATFORM_ADMIN };

  try {
    await new MembershipAdminService(context.supabase).restore(
      parsed.data.organizationId,
      parsed.data.membershipId,
    );
  } catch {
    return { error: "No se pudo restaurar el acceso. Intenta de nuevo." };
  }

  revalidatePlatform(parsed.data.organizationId);
}
