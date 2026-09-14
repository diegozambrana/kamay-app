import type { Role } from "@/types";

/** Una membresía de la cuenta, tal como la ve el super admin. */
export type PlatformMembership = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  displayName: string | null;
  archivedAt: string | null;
};

/** Una cuenta de la plataforma (vista *Usuarios*). */
export type PlatformUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  platformAdmin: boolean;
  memberships: PlatformMembership[];
};

export function activeMemberships(user: PlatformUser): PlatformMembership[] {
  return user.memberships.filter((m) => m.archivedAt === null);
}

/**
 * El nombre con que se presenta una cuenta: el primero que tenga en alguna
 * membresía, activa antes que archivada. Una cuenta nunca invitada no tiene
 * ninguno, y entonces se la conoce por su correo.
 */
export function displayNameOf(user: PlatformUser): string | null {
  const ordered = [...activeMemberships(user), ...user.memberships];
  return ordered.find((m) => m.displayName?.trim())?.displayName?.trim() ?? null;
}

/**
 * El nombre visible que se propone al asignar una cuenta a una organización
 * (design D9): el que ya usa en otra, o la parte local de su correo.
 */
export function defaultDisplayName(user: PlatformUser): string {
  return displayNameOf(user) ?? user.email.split("@")[0];
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * ¿El nombre contiene lo buscado? Sin tildes ni mayúsculas: el filtro del
 * selector de organización y de la asignación, sobre listas ya acotadas.
 */
export function matchesName(name: string, query: string): boolean {
  const needle = normalize(query);
  return !needle || normalize(name).includes(needle);
}
