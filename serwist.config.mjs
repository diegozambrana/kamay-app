import { serwist } from "@serwist/next/config";

/**
 * KAM-11 · Compilación del service worker.
 *
 * En **modo configurador**, no como plugin de `next.config.ts`: el plugin de
 * `@serwist/next` es un plugin de webpack y este proyecto compila con
 * Turbopack, el bundler por omisión de esta versión de Next. El service worker
 * se construye en un paso propio, después de `next build`, con el manifiesto de
 * precarga que esa compilación acaba de producir (`npm run build` lo encadena
 * con `postbuild`).
 */
export default await serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});
