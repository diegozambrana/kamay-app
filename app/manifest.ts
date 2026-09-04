import type { MetadataRoute } from "next";

/**
 * KAM-11 · La aplicación es instalable.
 *
 * No es cosmético: una aplicación instalada en la pantalla de inicio tiene
 * almacenamiento persistente, y la cola de registros pendientes vive en ese
 * almacenamiento. Sin instalar, iOS puede desalojar IndexedDB tras semanas sin
 * uso (design.md — Risks).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kamay",
    short_name: "Kamay",
    description: "Gestión operativa para emprendimientos de producción propia",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
