"use client";

import { useEffect } from "react";

/**
 * Registra el service worker y pide almacenamiento persistente.
 *
 * Lo segundo importa tanto como lo primero: iOS puede desalojar IndexedDB de
 * sitios no instalados tras semanas sin uso, y en ese IndexedDB vive la cola
 * de registros pendientes (design.md — Risks).
 *
 * **Un despliegue nuevo llega a quien ya tenía la aplicación abierta**
 * (KAM-23): el navegador solo busca una versión nueva del service worker al
 * navegar, y una aplicación de una sola página —o el modo feria abierto toda
 * la mañana— casi no navega. Por eso se le pide que la busque cada vez que la
 * pestaña vuelve a primer plano, sin caché HTTP de por medio
 * (`updateViaCache: "none"`, además del `no-store` de `/sw.js`). El resto lo
 * hacen `skipWaiting` y `clientsClaim` en `app/sw.ts`: la versión nueva toma
 * el control en cuanto se instala.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registered) => {
        registration = registered;
      })
      .catch(() => {
        // Que el service worker no se registre degrada la aplicación —no se
        // abrirá sin red—, pero no impide registrar ni sincronizar. No es un
        // error que merezca interrumpir a nadie.
      });

    void navigator.storage?.persist?.().catch(() => undefined);

    function checkForUpdate() {
      if (document.visibilityState !== "visible") return;
      // Sin red la comprobación falla, y no pasa nada: se reintenta al volver.
      void registration?.update().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", checkForUpdate);
    return () => document.removeEventListener("visibilitychange", checkForUpdate);
  }, []);

  return null;
}
