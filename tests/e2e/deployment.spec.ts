import { readFileSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "./helpers/test";

const SERVICE_WORKER = "public/sw.js";

/** Marca el service worker que controla la página, para reconocerlo después. */
function markController(page: Page) {
  return page.evaluate(() => {
    const marker = String(Math.random());
    (navigator.serviceWorker.controller as unknown as { marker: string }).marker = marker;
    return marker;
  });
}

function controllerMarker(page: Page) {
  return page.evaluate(
    () => (navigator.serviceWorker.controller as unknown as { marker?: string } | null)?.marker,
  );
}

/**
 * KAM-23 · Un despliegue nuevo llega a quien ya tenía la aplicación abierta
 * (spec `production-operations` → «A new deployment reaches returning
 * users»).
 *
 * Se simula el despliegue cambiando los bytes de `public/sw.js` —lo único
 * que cambia de una compilación a otra para el navegador— sobre el servidor
 * de producción, que lo sirve desde disco. Por eso corre en su propio
 * proyecto de Playwright (`deployment`) y en su propio paso de CI, **después**
 * de toda la suite y solo con `E2E_DEPLOYMENT=1`: ninguna otra prueba ve
 * cambiar su service worker a mitad de camino.
 */
test("la versión nueva toma el control de una pestaña abierta al volver a ella", async ({
  page,
}) => {
  test.skip(!process.env.CI, "necesita la compilación de producción");
  test.skip(!process.env.E2E_DEPLOYMENT, "corre sola, en su propio paso, con E2E_DEPLOYMENT=1");

  await page.goto("/auth/login");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // `clientsClaim` toma el control de forma asíncrona; si la página se cargó
  // antes del registro, una recarga lo garantiza (como en `fair-offline`).
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload();
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Se registra sin caché HTTP de por medio para la comprobación.
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())?.updateViaCache,
    ),
  ).toBe("none");

  const before = await markController(page);
  const original = readFileSync(SERVICE_WORKER);

  try {
    writeFileSync(SERVICE_WORKER, Buffer.concat([original, Buffer.from("\n// despliegue nuevo\n")]));

    // Sin navegar: la persona vuelve a la pestaña. La única comprobación que
    // puede dispararse aquí es la de `ServiceWorkerProvider`, y la versión
    // nueva toma el control sin esperar a que se cierre ninguna pestaña
    // (`skipWaiting`, `clientsClaim`).
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    await expect.poll(() => controllerMarker(page), { timeout: 15_000 }).not.toBe(before);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  } finally {
    writeFileSync(SERVICE_WORKER, original);
  }
});
