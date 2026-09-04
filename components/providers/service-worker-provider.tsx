"use client";

import { useEffect } from "react";

/**
 * Registra el service worker y pide almacenamiento persistente.
 *
 * Lo segundo importa tanto como lo primero: iOS puede desalojar IndexedDB de
 * sitios no instalados tras semanas sin uso, y en ese IndexedDB vive la cola
 * de registros pendientes (design.md — Risks).
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Que el service worker no se registre degrada la aplicación —no se
      // abrirá sin red—, pero no impide registrar ni sincronizar. No es un
      // error que merezca interrumpir a nadie.
    });

    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  return null;
}
