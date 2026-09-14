"use client";

import { useState, useTransition } from "react";

import { signOut } from "@/actions/auth";
import { useSyncStore } from "@/stores/sync-store";

/**
 * Cerrar sesión desde el menú de cuenta o el panel "Más" (KAM-24).
 *
 * Con registros pendientes de sincronizar pide confirmación antes de seguir:
 * sin ella se perderían de vista en silencio (no del dispositivo, pero de la
 * persona, que dejaría de ver el indicador). La comprobación vive aquí y no
 * en la acción de servidor, que no tiene acceso al store de Zustand
 * (design D3).
 */
export function useSignOut() {
  const pendingCount = useSyncStore((state) => state.counts.total);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function requestSignOut() {
    if (pendingCount > 0) {
      setConfirming(true);
      return;
    }
    startTransition(() => {
      void signOut();
    });
  }

  function confirmSignOut() {
    setConfirming(false);
    startTransition(() => {
      void signOut();
    });
  }

  return {
    requestSignOut,
    confirmSignOut,
    confirming,
    setConfirming,
    pending,
    pendingCount,
  };
}
