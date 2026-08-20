"use client";

import { useEffect, useRef } from "react";

import { useUserStore } from "@/stores/user-store";
import type { CurrentUser, Membership } from "@/types";

/** Hidrata `UserStore` con los datos cargados en el servidor por AuthCheck. */
export function UserProvider({
  user,
  membership,
  children,
}: {
  user: CurrentUser;
  membership: Membership | null;
  children: React.ReactNode;
}) {
  // Hidratación síncrona una sola vez, antes del primer render de los hijos.
  const hydrated = useRef<true | null>(null);
  if (hydrated.current == null) {
    hydrated.current = true;
    useUserStore.setState({ user, membership });
  }

  useEffect(() => {
    useUserStore.setState({ user, membership });
  }, [user, membership]);

  return children;
}
