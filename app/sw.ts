/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

/**
 * KAM-11 · El cascarón se abre sin red.
 *
 * Tres cosas que este service worker **no** hace, y las tres son decisiones:
 *
 * 1. **No reenvía ni reintenta ninguna escritura.** Nada de Background Sync:
 *    no existe en Safari de iOS —el navegador del puesto de feria— y tener dos
 *    mecanismos de reenvío con dos políticas de reintento sobre las mismas
 *    entradas es la forma más fiable de duplicar un registro justo cuando la
 *    respuesta se pierde (design.md, decisión 2). El reenvío vive en un único
 *    lugar: `lib/offline/drain.ts`.
 *
 * 2. **No cachea datos de negocio.** Este cambio garantiza la *captura*, no la
 *    lectura sin conexión (proposal.md — fuera de alcance): un tablero servido
 *    desde caché mostraría un estado que ya no existe, y quien lo mira no tiene
 *    forma de saber que está viendo el de hace una hora. Por eso no se usa
 *    `defaultCache`: su política para documentos y cargas RSC es justo la que
 *    aquí no se quiere.
 *
 * 3. **No toca ninguna petición que no necesite tocar.** Sin ruta que la
 *    empareje, la petición ni siquiera pasa por aquí: la resuelve el navegador
 *    como si no hubiera service worker. Esto no es una optimización — una ruta
 *    comodín que reenvía todo con `fetch(request)` rompe las subidas
 *    `multipart` de las Server Actions, que viajan como flujo.
 *
 * Lo que sí se guarda son los recursos de compilación —llevan su huella en el
 * nombre, así que una copia nunca queda obsoleta— y la página `/offline`, que
 * es lo que se sirve cuando una navegación no puede completarse.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Sin esto, un service worker viejo sigue sirviendo código viejo durante
  // días — y código viejo escribiendo en una cola cuyo formato cambió es el
  // fallo que más caro sale aquí (design.md — Risks). La otra mitad de esa
  // defensa es `OUTBOX_SCHEMA_VERSION`, que retiene lo que no entiende.
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      // Recursos de compilación: el nombre lleva la huella del contenido, así
      // que una respuesta guardada nunca puede estar desactualizada.
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "kamay-build-assets" }),
    },
    {
      // Las navegaciones van siempre a la red —los datos nunca se sirven de
      // una copia— y solo existen aquí para poder responder con `/offline`
      // cuando la red no está. Todo lo demás queda fuera del service worker.
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        // Cuando una navegación no se puede completar, Kamay dice qué pasa.
        // No el dinosaurio del navegador.
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
