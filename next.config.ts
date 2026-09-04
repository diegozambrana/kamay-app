import type { NextConfig } from "next";

/**
 * El service worker no se compila aquí: lo construye `serwist.config.mjs` en
 * el paso `postbuild`, porque el plugin de `@serwist/next` es de webpack y
 * este proyecto compila con Turbopack (KAM-11, design.md — Risks).
 */
const nextConfig: NextConfig = {
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

export default nextConfig;
