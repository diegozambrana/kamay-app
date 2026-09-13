import { test as base, type Page } from "@playwright/test";

export * from "@playwright/test";

/**
 * El `test` de toda la suite e2e: el de Playwright, con una espera más.
 *
 * Desde KAM-23 cada segmento con datos tiene su `loading.tsx`, y eso hace que
 * la carga completa de una página llegue por *streaming*: primero el
 * esqueleto y después el contenido, dentro de un `div[hidden]` con id `S:n`
 * que React coloca en su sitio al revelar el límite de Suspense. React 19.2
 * agrupa esos revelados y los retrasa unos cientos de milisegundos, así que
 * el evento `load` —donde `page.goto` resuelve— puede llegar con el segmento
 * aún oculto. En esa ventana el contenido existe dos veces en el DOM: la
 * persona no ve la copia oculta, pero un localizador estricto sí, y la prueba
 * falla con «strict mode violation» según cuánto tarde el revelado.
 *
 * La espera se ancla al estado observable —que no quede ningún segmento por
 * revelar—, no a un tiempo fijo. Solo en cargas completas (`goto`,
 * `reload`): la navegación dentro de la aplicación viaja por RSC y no deja
 * segmentos ocultos.
 */
async function settleStreaming(page: Page) {
  try {
    await page.waitForFunction(
      () => !document.querySelector('div[hidden][id^="S:"]'),
      undefined,
      { timeout: 10_000 },
    );
  } catch {
    // Un segmento que no se revela en diez segundos no es asunto de esta
    // espera: o el servidor sigue trabajando —y la aserción de la prueba
    // esperará lo que le toque— o el límite ya se resolvió en el cliente y el
    // segmento quedó huérfano. Se deja constancia y la prueba sigue.
    const left = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div[hidden][id^="S:"]')).map(
        (segment) => `${segment.id} (B:${!!document.getElementById(`B:${segment.id.slice(2)}`)})`,
      ),
    );
    console.warn(`[e2e] segmentos sin revelar en ${page.url()}: ${left.join(", ")}`);
  }
}

export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      // Quien pide `commit` quiere mirar la página a medio llegar.
      if (options?.waitUntil !== "commit") await settleStreaming(page);
      return response;
    };

    const reload = page.reload.bind(page);
    page.reload = async (options) => {
      const response = await reload(options);
      if (options?.waitUntil !== "commit") await settleStreaming(page);
      return response;
    };

    await provide(page);
  },
});
