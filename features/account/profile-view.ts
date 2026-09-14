import type { ActiveAccess } from "@/lib/auth/access";
import { PLATFORM_ADMIN_LABEL } from "@/lib/platform/labels";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  assistant: "Ayudante",
};

export type ProfileView = {
  organizationName: string | null;
  roleLabel: string;
  /** Solo hay nombre visible que editar si existe la fila de membresía. */
  canRename: boolean;
  displayName: string | null;
};

/**
 * Qué muestra el perfil (KAM-24, KAM-26). El administrador de la plataforma
 * se presenta por su acceso de plataforma, no por un rol de taller; y solo
 * puede renombrarse si tiene membresía en la organización en la que está
 * (spec `platform-administration` → *A platform admin's profile reflects
 * platform access*).
 */
export function profileView(access: ActiveAccess | null, platformAdmin: boolean): ProfileView {
  return {
    organizationName: access?.organization.name ?? null,
    roleLabel: platformAdmin
      ? PLATFORM_ADMIN_LABEL
      : access
        ? (ROLE_LABELS[access.role] ?? access.role)
        : "",
    canRename: Boolean(access?.membership),
    displayName: access?.membership?.displayName ?? null,
  };
}
