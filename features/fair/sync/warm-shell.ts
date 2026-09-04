/**
 * Guardar el cascarón de `/fair` junto con el catálogo (design.md, decisión 12).
 *
 * La regla `NetworkFirst` de `app/sw.ts` guarda el documento cuando una
 * navegación pasa por el service worker. El problema es la **primera** vez:
 * quien abre la feria recién instalada la carga antes de que el service worker
 * controle la página, así que esa navegación no pasa por él y la caché queda
 * vacía. Al llegar al puesto sin señal, el cascarón no está.
 *
 * Depender de que la persona entre dos veces no es una garantía, es una
 * casualidad. Esto lo hace explícito: capturar la feria captura el catálogo
 * **y** su cascarón, en el mismo gesto y con la misma red.
 *
 * Falla en silencio a propósito: sin `caches` —o con la cuota llena— la feria
 * sigue funcionando mientras la pestaña esté abierta, que es lo que hacía
 * antes de esto. No es motivo para interrumpir a nadie.
 */
export const FAIR_SHELL_CACHE = "kamay-fair-shell";

export async function warmFairShell(): Promise<void> {
  if (typeof caches === "undefined") return;

  try {
    const cache = await caches.open(FAIR_SHELL_CACHE);
    await cache.add("/fair");
  } catch {
    // Ver arriba: degrada, no rompe.
  }
}
