import { create } from "zustand";

import type { CurrentUser, Membership, Role } from "@/types";

type UserState = {
  user: CurrentUser | null;
  /** La fila de membresía, si existe: un super admin puede no tenerla. */
  membership: Membership | null;
  /**
   * El rol con que se actúa en la organización activa (KAM-26). Toda
   * decisión de rol lee este campo y no `membership.role`: un super admin es
   * dueño aunque no tenga membresía. `null` sin organización activa.
   */
  role: Role | null;
  /** Administrador de la plataforma (KAM-26). */
  platformAdmin: boolean;
  setUser: (user: CurrentUser | null, membership: Membership | null) => void;
};

/** Estado global del usuario autenticado y su membresía activa. */
export const useUserStore = create<UserState>()((set) => ({
  user: null,
  membership: null,
  role: null,
  platformAdmin: false,
  setUser: (user, membership) =>
    set({ user, membership, role: membership?.role ?? null }),
}));
