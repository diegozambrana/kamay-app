"use client";

import { useHydrateStore } from "@/components/providers/use-hydrate-store";
import { useUserStore } from "@/stores/user-store";
import type { CurrentUser, Membership, Role } from "@/types";

/** Hidrata `UserStore` con los datos cargados en el servidor por AuthCheck. */
export function UserProvider({
  user,
  membership,
  role,
  platformAdmin = false,
  children,
}: {
  user: CurrentUser;
  membership: Membership | null;
  /** Rol efectivo (KAM-26); por omisión, el de la membresía. */
  role?: Role | null;
  platformAdmin?: boolean;
  children: React.ReactNode;
}) {
  const effectiveRole = role === undefined ? (membership?.role ?? null) : role;

  useHydrateStore(
    () => useUserStore.setState({ user, membership, role: effectiveRole, platformAdmin }),
    [user, membership, effectiveRole, platformAdmin],
  );

  return children;
}
