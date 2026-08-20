export type Role = "owner" | "assistant";

export type Organization = {
  id: string;
  name: string;
  logoPath: string | null;
  currency: string;
  timezone: string;
};

export type Membership = {
  id: string;
  organizationId: string;
  role: Role;
  displayName: string | null;
};

export type MembershipWithOrganization = Membership & {
  organization: Organization;
};

export type CurrentUser = {
  id: string;
  email: string;
};

/** Color de línea: token, no clase de Tailwind (ver `lib/business-lines/colors.ts`). */
export const LINE_COLORS = [
  "zinc",
  "blue",
  "violet",
  "orange",
  "green",
  "rose",
  "amber",
  "cyan",
] as const;

export type LineColor = (typeof LINE_COLORS)[number];

export type BusinessLine = {
  id: string;
  organizationId: string;
  name: string;
  color: LineColor;
  icon: string | null;
  isShared: boolean;
  position: number;
  archivedAt: string | null;
};

export type SalesChannel = {
  id: string;
  organizationId: string;
  name: string;
  position: number;
  archivedAt: string | null;
};

export type ExpenseCategory = {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: string | null;
};

export type Unit = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  archivedAt: string | null;
};

export type Invitation = {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  expiresAt: string;
  acceptedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

/**
 * Membresía tal como la lista la sección Usuarios y roles. No lleva el correo:
 * `auth.users` no es legible por el rol `authenticated`, así que la persona se
 * identifica por su `displayName`.
 */
export type MemberRow = Membership & {
  userId: string;
  archivedAt: string | null;
};

/** "Todas" no es una línea: es la ausencia deliberada de filtro. */
export const ALL_LINES = "all" as const;

export type ActiveLine = typeof ALL_LINES | string;
