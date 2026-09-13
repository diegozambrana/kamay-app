import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";

import { assertEnv } from "./lib/env";

/**
 * El service worker no se compila aquí: lo construye `serwist.config.mjs` en
 * el paso `postbuild`, porque el plugin de `@serwist/next` es de webpack y
 * este proyecto compila con Turbopack (KAM-11, design.md — Risks).
 */
const nextConfig: NextConfig = {
  // Sin `X-Powered-By: Next.js`: una cabecera que solo informa a quien busca
  // qué atacar (KAM-23, sin cabeceras de desarrollo en producción).
  poweredByHeader: false,
  env: {
    // La versión desplegada que acompaña a cada reporte de error, en servidor
    // y navegador (KAM-23). Vercel expone el commit al compilar.
    KAMAY_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  },
  experimental: {
    serverActions: {
      // Las fotos del catálogo viajan como FormData a una Server Action y el
      // límite de la especificación es 5 MB por archivo; el margen cubre el
      // resto del formulario.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        // Kamay es una herramienta privada de cada taller: ninguna página suya
        // debe aparecer en un buscador (KAM-23). Va en cabecera y no en
        // `robots.txt` a propósito: un `Disallow` impide al rastreador leer la
        // página, y con ello leer que no debe indexarla; un enlace externo al
        // login bastaría para que apareciera en resultados sin contenido.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Cabeceras del service worker, según la guía de PWA de Next. Sin
        // `no-store`, un service worker mal invalidado sirve una versión vieja
        // de la aplicación durante días (KAM-11, design.md — Risks).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

/**
 * Las variables requeridas se validan **al compilar** y al arrancar con
 * `next start` (KAM-23, `lib/env.ts`). Compilar es el primer momento posible:
 * en Vercel, un entorno incompleto hace fallar el despliegue nombrando lo que
 * falta, y la versión anterior sigue sirviendo.
 *
 * No se valida en `instrumentation.ts`: ahí corre también el proxy, que en
 * Vercel no recibe las variables de servidor, y el primer despliegue respondió
 * 500 a todo por eso. Tampoco al arrancar dentro de Vercel, donde las
 * funciones no vuelven a ejecutar este archivo sino la configuración ya
 * compilada.
 */
export default function config(phase: string): NextConfig {
  const onVercel = Boolean(process.env.VERCEL);
  // `next typegen` —dentro de `npm run typecheck`— carga este archivo con la
  // misma fase que una compilación, y en CI corre antes de que existan las
  // variables: generar tipos no despliega nada y no se valida.
  const typegen = process.argv.includes("typegen");
  const building = phase === PHASE_PRODUCTION_BUILD && !typegen;
  if (building || (phase === PHASE_PRODUCTION_SERVER && !onVercel)) {
    assertEnv(process.env, "production");
  }
  return nextConfig;
}
