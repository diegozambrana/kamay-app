"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";

import { drainOutbox, listEntries, outboxDatabase } from "@/lib/offline";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOrganizationStore } from "@/stores/organization-store";
import { useSyncStore } from "@/stores/sync-store";
import { useUserStore } from "@/stores/user-store";

import { registerOfflineOperations } from "./operations";

/**
 * Une las tres piezas: la cola en Dexie, el store que la refleja y el motor de
 * vaciado.
 *
 * El vaciado se dispara al recuperar la conexión, al arrancar la aplicación y
 * de forma periódica mientras haya pendientes. No hay reenvío en segundo plano
 * con la aplicación cerrada: no existe Background Sync en Safari de iOS
 * (design.md, decisión 2), y el criterio 5 del backlog describe exactamente
 * ese comportamiento.
 */

/** Cada cuánto se revisa la cola si hay algo esperando su turno. */
const SWEEP_INTERVAL_MS = 30_000;

// Al cargar el módulo, no dentro del componente: el vaciado puede empezar
// antes de que React monte nada.
registerOfflineOperations();

export function SyncProvider() {
  const organizationId = useOrganizationStore((state) => state.organization?.id);
  const userId = useUserStore((state) => state.user?.id);
  const setEntries = useSyncStore((state) => state.setEntries);
  const setSession = useSyncStore((state) => state.setSession);
  const { browserOnline } = useOnlineStatus();

  // La única fuente del indicador es la tabla (design.md, decisión 11).
  const entries = useLiveQuery(() => listEntries(outboxDatabase()), [], []);

  useEffect(() => {
    setSession(
      organizationId && userId ? { organizationId, userId } : null,
    );
  }, [organizationId, userId, setSession]);

  useEffect(() => {
    setEntries(entries);
  }, [entries, setEntries]);

  useEffect(() => {
    if (!organizationId || !userId) return;
    if (!browserOnline) return;

    const session = { organizationId, userId };
    const sweep = () => void drainOutbox({ session }).catch(() => undefined);

    sweep();
    const timer = window.setInterval(sweep, SWEEP_INTERVAL_MS);

    return () => window.clearInterval(timer);
    // `browserOnline` en las dependencias es lo que convierte la reconexión en
    // un disparo: al pasar de falso a verdadero, el efecto se vuelve a montar.
  }, [organizationId, userId, browserOnline]);

  return null;
}
