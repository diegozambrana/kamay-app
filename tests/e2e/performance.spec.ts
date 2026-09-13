import { E2E_PASSWORD } from "./helpers/fresh-org";
import { rendimiento } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

// «Kamay Rendimiento»: un año de trabajo de un taller real
// (supabase/seeds/performance.sql).

/** El presupuesto del criterio 7 del backlog de KAM-23. */
const BUDGET_MS = 2000;

/**
 * El perfil de un móvil de gama media, el mismo que usa Lighthouse para su
 * medición móvil: CPU cuatro veces más lenta y red «4G lenta» —150 ms de
 * latencia, 1,6 Mbps de bajada, 750 kbps de subida—.
 */
const MID_RANGE = {
  cpuSlowdown: 4,
  latencyMs: 150,
  downloadBytesPerSecond: (1.6 * 1024 * 1024) / 8,
  uploadBytesPerSecond: (750 * 1024) / 8,
};

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * KAM-23 · Presupuesto de carga del panel (spec `performance-budget`).
 *
 * Escenarios: *The dashboard loads within its budget on a mid-range phone* →
 * «Dashboard meets the budget with a year of data», «A regression fails the
 * measurement».
 *
 * Etiquetada `@performance`: corre en el trabajo de estabilidad y no en cada
 * pull request (design D12), porque el tiempo de un runner compartido varía
 * lo bastante para convertir un presupuesto ajustado en ruido.
 */
test.describe("presupuesto de carga", { tag: "@performance" }, () => {
  test.skip(({ isMobile }) => !isMobile, "el presupuesto es el de un teléfono de gama media");

  // Sin service worker. Las navegaciones pasan por él (`NetworkOnly`) y es él
  // quien pide la página: la limitación de red de CDP se aplica a las
  // peticiones de la página, no a las suyas, y con él activo la «red lenta»
  // no frenaba nada —la primera medición dio 240 ms—. Los recursos estáticos
  // siguen en la caché HTTP del navegador desde la visita previa, así que la
  // medición sigue siendo la de volver al panel.
  test.use({ serviceWorkers: "block" });

  test("el panel queda utilizable en menos de 2 s con un año de datos", async ({ page }) => {
    await login(page, rendimiento().owner);

    // Una visita previa: es una aplicación de uso diario, con sus recursos
    // estáticos ya en caché. Lo que se mide es volver al panel, no descargar
    // la aplicación por primera vez.
    await page.goto("/dashboard");
    await expect(page.getByTestId("owner-dashboard")).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    // Sin el dominio de red habilitado, Chrome acepta la emulación y no la
    // aplica: la primera versión de esta prueba medía a toda velocidad.
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: MID_RANGE.cpuSlowdown });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: MID_RANGE.latencyMs,
      downloadThroughput: MID_RANGE.downloadBytesPerSecond,
      uploadThroughput: MID_RANGE.uploadBytesPerSecond,
    });

    // Utilizable es compuesto, no pintado a medias: la última pieza del panel
    // rendida, con sus cifras. Se mide desde que la navegación arranca, así
    // que el contenido puede existir aún en el segmento oculto que React
    // revela al terminar el *streaming*: se busca la copia visible.
    const visible = (testId: string) => page.locator(`[data-testid="${testId}"]:visible`);
    const started = Date.now();
    await page.goto("/dashboard", { waitUntil: "commit" });
    await expect(visible("owner-dashboard")).toBeVisible({ timeout: 15_000 });
    await expect(visible("recent-activity")).toBeVisible({ timeout: 15_000 });
    await expect(visible("indicator-income-amount")).toHaveText(/\d+\.\d{2}/, {
      timeout: 15_000,
    });
    const composed = Date.now() - started;

    // Y utilizable de verdad: con el HTML del servidor el panel se ve antes
    // de responder al tacto. `load` llega cuando los scripts ya se
    // descargaron y ejecutaron con la CPU limitada; el presupuesto se aplica a
    // lo que tarde más de las dos cosas.
    await page.waitForLoadState("load");
    const elapsed = Math.max(composed, Date.now() - started);

    test.info().annotations.push({ type: "panel-ms", description: String(elapsed) });
    console.log(
      `[rendimiento] panel compuesto en ${composed} ms, utilizable en ${elapsed} ms (presupuesto ${BUDGET_MS} ms)`,
    );

    expect(elapsed, `el panel tardó ${elapsed} ms en un móvil de gama media`).toBeLessThan(
      BUDGET_MS,
    );
  });
});
