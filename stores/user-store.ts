import { create } from "zustand";

import type { CurrentUser, Membership } from "@/types";

type UserState = {
  user: CurrentUser | null;
  membership: Membership | null;
  setUser: (user: CurrentUser | null, membership: Membership | null) => void;
};

/** Estado global del usuario autenticado y su membresía activa. */
export const useUserStore = create<UserState>()((set) => ({
  user: null,
  membership: null,
  setUser: (user, membership) => set({ user, membership }),
}));
