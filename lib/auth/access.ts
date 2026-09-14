import type { MembershipWithOrganization, Organization, Role } from "@/types";

/**
 * Con qué organización y con qué rol actúa una persona en esta petición
 * (KAM-26, design D6).
 *
 * Antes la respuesta era "su membresía": el rol salía de `membership.role`.
 * Un administrador de la plataforma puede actuar en una organización a la que
 * no pertenece —sin membresía— y siempre como dueño, así que el rol deja de
 * ser una propiedad de la membresía y pasa a ser del acceso. Toda comprobación
 * de rol lee `role`; `membership` solo está cuando de verdad existe una fila
 * (renombrarse, líneas asignadas).
 */
export type ActiveAccess = {
  organizationId: string;
  organization: Organization;
  /** El rol efectivo: `owner` siempre que `platformAdmin`. */
  role: Role;
  /** `null` cuando un super admin actúa en una organización ajena. */
  membership: MembershipWithOrganization | null;
  platformAdmin: boolean;
};

export type AccessResolution =
  /** Hay organización activa: se puede mostrar el cascarón. */
  | { kind: "active"; access: ActiveAccess }
  /** Cuenta sin ninguna membresía (y sin ser super admin): el aviso de KAM-25. */
  | { kind: "no-organization" }
  /** Varias membresías y ninguna elegida: `/auth/select-org`. */
  | { kind: "choose-organization" }
  /** Super admin sin organización válida: la vista de plataforma. */
  | { kind: "platform" };

export type AccessInput = {
  memberships: MembershipWithOrganization[];
  platformAdmin: boolean;
  cookieOrgId: string | undefined;
  /**
   * La organización que nombra la cookie cuando el super admin no pertenece a
   * ella, tal como la leyó (existente y no archivada), o `null`. Para quien no
   * es super admin no se consulta: no podría actuar ahí de todos modos.
   */
  cookieOrganization: Organization | null;
};

/**
 * La regla, sin E/S, para que se pruebe sin montar cookies ni Supabase.
 *
 * 1. La membresía que coincide con la cookie manda, para todos.
 * 2. Un super admin sin esa membresía entra a la organización de la cookie si
 *    existe; si no, va a la vista de plataforma. **Nunca** cae en la selección
 *    de organización ni en el aviso "sin organización".
 * 3. Para el resto, la regla de siempre: una membresía se toma sin preguntar;
 *    varias piden elegir; ninguna muestra el aviso.
 */
export function resolveAccess({
  memberships,
  platformAdmin,
  cookieOrgId,
  cookieOrganization,
}: AccessInput): AccessResolution {
  const fromMembership = (membership: MembershipWithOrganization): AccessResolution => ({
    kind: "active",
    access: {
      organizationId: membership.organizationId,
      organization: membership.organization,
      role: platformAdmin ? "owner" : membership.role,
      membership,
      platformAdmin,
    },
  });

  const chosen = memberships.find((m) => m.organizationId === cookieOrgId);
  if (chosen) return fromMembership(chosen);

  if (platformAdmin) {
    if (cookieOrganization && cookieOrganization.id === cookieOrgId) {
      return {
        kind: "active",
        access: {
          organizationId: cookieOrganization.id,
          organization: cookieOrganization,
          role: "owner",
          membership: null,
          platformAdmin: true,
        },
      };
    }
    return { kind: "platform" };
  }

  if (memberships.length === 0) return { kind: "no-organization" };
  if (memberships.length === 1) return fromMembership(memberships[0]);
  return { kind: "choose-organization" };
}

/** A dónde manda cada resolución sin organización activa. */
export const PLATFORM_HOME = "/admin/organizations";
export const SELECT_ORG_PATH = "/auth/select-org";
