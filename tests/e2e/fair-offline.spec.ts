import { execSync } from "node:child_process";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

/**
 * KAM-12 · `fair-offline.spec.ts` — **la prueba crítica del proyecto**.
 *
 * V6 es la pantalla que decide si Kamay se usa: si vender en una feria sin
 * señal falla o duplica, no hay nada más que discutir. Esta suite recorre
 * exactamente eso, con la red del navegador cortada de verdad
 * (`context.setOffline`) y no con un estado simulado en la aplicación: lo que
 * hay que probar es el comportamiento real, no la rama que el código cree
 * tomar.
 *
 * Cubre los requisitos de `fair-mode`: "El modo feria no ofrece ningún
 * elemento de navegación tocable salvo la salida", "Carrito y cobro en cuatro
 * interacciones o menos", "Vuelta inmediata a la cuadrícula tras cada venta",
 * "Vender sin conexión no falla ni duplica", "Indicador de ventas pendientes
 * de sincronizar", "El modo feria abre sin red desde el catálogo capturado" y
 * "Aislamiento y roles en el modo feria".
 */

const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";

/**
 * Umbrales de tiempo, holgados y a propósito.
 *
 * Un criterio de tiempo con margen sigue detectando la regresión que importa
 * —la que multiplica el tiempo, no la que le suma 50 ms— y no convierte la
 * suite en una ruleta según lo cargada que esté la máquina de CI.
 */
const VUELTA_MAX_MS = 1_000;
const VENTAS_SIN_RED = 20;
/** La vigésima venta no puede costar más de tres veces lo que costó la primera. */
const DEGRADACION_MAX = 3;

/**
 * Cuenta en la base cuántas de ESAS ventas existen, como usuario autenticado.
 *
 * Es el único punto de esta suite que mira la base y no la pantalla, y es
 * imprescindible: el criterio 5 no dice «el indicador llega a cero», dice
 * «existen exactamente veinte registros». Un indicador a cero con diecinueve
 * filas guardadas sería justo el fallo que esta prueba existe para atrapar.
 *
 * Se consulta por identificadores concretos y no por fecha porque la suite
 * corre en paralelo: contar «las ventas directas desde tal hora» sumaría las
 * de las otras pruebas y daría verde o rojo según quién terminara antes.
 */
async function contarVentasDirectas(ids: readonly string[]): Promise<number> {
  const env = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) => env.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];
  const url = get("API_URL");
  const key = get("PUBLISHABLE_KEY") ?? get("ANON_KEY");
  if (!url || !key) throw new Error("No se pudo resolver Supabase local.");

  const db = createClient(url, key, {
    auth: { persistSession: false },
    // Node 20 no trae WebSocket nativo; realtime-js lo exige al construir.
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: authError } = await db.auth.signInWithPassword({
    email: GEEKO_OWNER,
    password: PASSWORD,
  });
  if (authError) throw new Error(`No se pudo entrar: ${authError.message}`);

  const { count, error } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("kind", "direct_sale")
    .in("id", [...ids]);

  if (error) throw new Error(`No se pudo contar: ${error.message}`);
  return count ?? 0;
}

/**
 * Espera a que el cascarón de la feria esté guardado.
 *
 * Capturar la feria escribe dos cosas: el catálogo en Dexie y el cascarón en
 * la caché del navegador. Lo segundo es asíncrono, así que cortar la red sin
 * esperarlo probaría una carrera y no el comportamiento.
 */
async function esperarCascaronGuardado(page: Page) {
  await page.waitForFunction(
    async () => {
      const cache = await caches.open("kamay-fair-shell");
      return Boolean(await cache.match("/fair"));
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Los identificadores que esta pestaña dejó en la cola, sin haber salido aún. */
async function ventasEncoladas(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const req = indexedDB.open("kamay-outbox");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const entries: { operation: string; recordId: string }[] = await new Promise((resolve) => {
      const all = db.transaction("outbox").objectStore("outbox").getAll();
      all.onsuccess = () => resolve(all.result);
    });
    return entries
      .filter((entry) => entry.operation === "directSale.create")
      .map((entry) => entry.recordId);
  });
}

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** Cuenta gestos, para el criterio 2: una venta en cuatro interacciones. */
function medidor() {
  let total = 0;
  return {
    get total() {
      return total;
    },
    async clic(locator: Locator) {
      total += 1;
      await locator.click();
    },
  };
}

/** Entra al modo feria y deja la cuadrícula de Alfarería lista para vender. */
async function abrirFeria(page: Page) {
  await page.goto("/fair");

  // El paso de inicio solo aparece la primera vez de cada feria.
  const inicio = page.getByTestId("fair-start");
  if (await inicio.isVisible().catch(() => false)) {
    const selectorLinea = page.getByTestId("fair-line");
    if (await selectorLinea.isVisible().catch(() => false)) {
      await selectorLinea.click();
      await page.getByRole("option", { name: "Alfarería", exact: true }).click();
    }
    await inicio.click();
  }

  await expect(page.getByTestId("fair-product").first()).toBeVisible();
}

/** Una venta completa: un producto, Cobrar, Confirmar. */
async function venderUno(page: Page) {
  await page.getByTestId("fair-product").first().click();
  await page.getByTestId("fair-checkout").click();
  await page.getByTestId("fair-confirm").click();
  // La vuelta a la cuadrícula con el carrito vacío es el fin de la venta.
  await expect(page.getByTestId("cart-total")).toHaveText("0");
}

test.describe("modo feria", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, GEEKO_OWNER);
  });

  // ── Criterio 1 ──────────────────────────────────────────────────────────
  test("no ofrece ningún elemento de navegación salvo la salida", async ({ page }) => {
    await abrirFeria(page);

    // En el DOM, no solo visibles: una barra escondida con CSS reaparece con
    // un cambio de estilo o con un foco de teclado.
    await expect(page.locator("nav")).toHaveCount(0);
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.locator("[role=navigation]")).toHaveCount(0);

    const enlaces = page.locator("a");
    await expect(enlaces).toHaveCount(1);
    await expect(enlaces).toHaveAttribute("href", "/quick");

    // Y no se llega aquí sin pedirlo.
    await page.goto("/dashboard");
    await expect(page.locator("header")).toHaveCount(1);
  });

  test("la salida devuelve al registro rápido", async ({ page }) => {
    await abrirFeria(page);

    await page.getByTestId("fair-exit").click();

    await page.waitForURL(/\/quick$/);
    // El cascarón vuelve: la feria era un modo, no una sección.
    await expect(page.locator("header")).toHaveCount(1);
  });

  // ── Criterio 2 ──────────────────────────────────────────────────────────
  test("una venta de dos productos se completa en cuatro interacciones", async ({ page }) => {
    await abrirFeria(page);

    const gestos = medidor();
    const productos = page.getByTestId("fair-product");

    await gestos.clic(productos.nth(0));
    await gestos.clic(productos.nth(1));
    await gestos.clic(page.getByTestId("fair-checkout"));
    await gestos.clic(page.getByTestId("fair-confirm"));

    await expect(page.getByTestId("cart-total")).toHaveText("0");
    expect(gestos.total).toBeLessThanOrEqual(4);
  });

  test("el precio del catálogo se propone sin escribir nada", async ({ page }) => {
    await abrirFeria(page);

    await page.getByTestId("fair-product").first().click();
    const total = await page.getByTestId("cart-total").textContent();
    await page.getByTestId("fair-checkout").click();

    await expect(page.getByTestId("fair-amount")).toHaveValue(total ?? "");
  });

  // ── Criterio 3 ──────────────────────────────────────────────────────────
  test("vuelve a la cuadrícula en menos de un segundo, sin pantallas intermedias", async ({
    page,
  }) => {
    await abrirFeria(page);
    await page.getByTestId("fair-product").first().click();
    await page.getByTestId("fair-checkout").click();

    const inicio = Date.now();
    await page.getByTestId("fair-confirm").click();
    await expect(page.getByTestId("cart-total")).toHaveText("0");
    const transcurrido = Date.now() - inicio;

    expect(transcurrido).toBeLessThan(VUELTA_MAX_MS);
    // Ni hoja de cobro abierta ni resumen: la cuadrícula, y nada más.
    await expect(page.getByTestId("fair-amount")).toHaveCount(0);
    await expect(page.getByTestId("fair-product").first()).toBeVisible();
  });

  test("la venta siguiente empieza en un carrito nuevo", async ({ page }) => {
    await abrirFeria(page);
    await venderUno(page);

    await page.getByTestId("fair-product").nth(1).click();

    // Solo la línea recién tocada: ni rastro de la venta anterior.
    await expect(page.getByRole("button", { name: /^Quitar / })).toHaveCount(1);
  });

  // ── Criterios 4 y 5: el corazón de la prueba ────────────────────────────
  test("veinte ventas sin red se registran una sola vez al reconectar", async ({
    page,
    context,
  }) => {
    // La prueba más pesada del repositorio: veinte ventas seguidas más el
    // vaciado de la cola al reconectar. Con la suite completa compitiendo por
    // el mismo servidor, los 30 s por omisión de Playwright se agotan antes de
    // que termine algo que sí funciona.
    test.setTimeout(180_000);

    // Se abre con red para capturar el catálogo (decisión 12).
    await abrirFeria(page);

    await context.setOffline(true);

    const duraciones: number[] = [];
    for (let i = 0; i < VENTAS_SIN_RED; i += 1) {
      const inicio = Date.now();
      await venderUno(page);
      duraciones.push(Date.now() - inicio);
    }

    // Sin degradación perceptible: la última no cuesta un múltiplo de la
    // primera. Umbral holgado, ver arriba.
    const primera = Math.max(duraciones[0], 1);
    const ultima = duraciones[duraciones.length - 1];
    expect(ultima).toBeLessThan(primera * DEGRADACION_MAX);

    // El indicador dice exactamente cuántas faltan: nada se perdió en silencio.
    await expect(page.getByTestId("fair-pending-count")).toHaveText(String(VENTAS_SIN_RED));

    // Los identificadores se leen ANTES de reconectar: al vaciarse la cola
    // desaparecen, y son lo que permite comprobar que llegaron esas veinte y
    // no otras (la suite corre en paralelo).
    const ids = await ventasEncoladas(page);
    expect(new Set(ids).size).toBe(VENTAS_SIN_RED);

    await context.setOffline(false);

    // Al reconectar salen solas: no hay que tocar nada.
    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, {
      timeout: 60_000,
    });

    // Y en la base hay veinte, no diecinueve ni veintiuna. Sin duplicados,
    // aunque la cola haya reintentado.
    expect(await contarVentasDirectas(ids)).toBe(VENTAS_SIN_RED);
  });

  // Sin recargar la página: la cola sobrevive en IndexedDB aunque el
  // cascarón no se sirva de caché. Es la mitad del escenario que se puede
  // comprobar sin la compilación de producción.
  test("las ventas encoladas siguen en la cola hasta que se envían", async ({
    page,
    context,
  }) => {
    await abrirFeria(page);
    await context.setOffline(true);

    await venderUno(page);
    await venderUno(page);
    await expect(page.getByTestId("fair-pending-count")).toHaveText("2");

    const encoladas = await page.evaluate(async () => {
      const req = indexedDB.open("kamay-outbox");
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return new Promise<number>((resolve) => {
        const count = db.transaction("outbox").objectStore("outbox").count();
        count.onsuccess = () => resolve(count.result);
      });
    });

    expect(encoladas).toBeGreaterThanOrEqual(2);

    await context.setOffline(false);
    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });
  });

  test("el indicador desaparece cuando no queda ninguna venta pendiente", async ({
    page,
    context,
  }) => {
    await abrirFeria(page);

    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0);

    await context.setOffline(true);
    await venderUno(page);
    await expect(page.getByTestId("fair-pending-count")).toHaveText("1");

    await context.setOffline(false);
    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });
  });
});

/**
 * Lo que exige el cascarón servido desde caché.
 *
 * `next dev` no sirve un service worker utilizable —lo construye `postbuild`
 * sobre el manifiesto de `next build`—, así que estas dos se saltan fuera de
 * CI, exactamente como hace `offline-capture.spec.ts` de KAM-11. No es una
 * excepción nueva: es la misma, y por el mismo motivo.
 */
test.describe("el modo feria se abre sin red", () => {
  test.skip(!process.env.CI, "necesita la compilación de producción");

  test.beforeEach(async ({ page }) => {
    await login(page, GEEKO_OWNER);
  });

  test("recargar sin red conserva las ventas pendientes", async ({ page, context }) => {
    // Tras recargar sin red, el vaciado puede tardar hasta un barrido completo
    // de la cola (30 s) en salir. El timeout por omisión de Playwright es ese
    // mismo, así que la prueba moriría justo antes de ver lo que espera.
    test.setTimeout(120_000);

    await abrirFeria(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await esperarCascaronGuardado(page);

    await context.setOffline(true);
    await venderUno(page);
    await venderUno(page);
    await expect(page.getByTestId("fair-pending-count")).toHaveText("2");

    // Recargar es lo más parecido a cerrar y reabrir la aplicación instalada.
    await page.reload();

    await expect(page.getByTestId("fair-pending-count")).toHaveText("2");

    await context.setOffline(false);
    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });
  });

  // El arranque en frío: decisión 12. Es lo que separa «vender sin señal» de
  // «vender sin señal si dejaste la pestaña abierta».
  test("abre sin red desde el catálogo capturado", async ({ page, context }) => {
    await abrirFeria(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await esperarCascaronGuardado(page);
    const productos = await page.getByTestId("fair-product").count();
    expect(productos).toBeGreaterThan(0);

    await context.setOffline(true);
    await page.goto("/fair");

    await expect(page.getByTestId("fair-product").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("fair-product")).toHaveCount(productos);
    // Y dice de cuándo es lo que enseña: la diferencia con cachear a secas.
    await expect(page.getByTestId("snapshot-age")).toBeVisible();

    await context.setOffline(false);
  });
});

// ── Roles ─────────────────────────────────────────────────────────────────
test("el ayudante puede atender el puesto", async ({ page }) => {
  await login(page, GEEKO_ASSISTANT);
  await abrirFeria(page);

  await venderUno(page);

  // Se registró y salió: atender la feria es su trabajo.
  await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });
});
