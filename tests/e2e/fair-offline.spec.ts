import { execSync } from "node:child_process";

import { signedInClient } from "./helpers/fresh-org";
import { noisePng } from "./helpers/png";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Locator, type Page } from "./helpers/test";
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
 *
 * Desde `fair-product-photos-visibility-cart-drawer`, una venta es *Agregar*
 * en la tarjeta, *Ver carrito* y *Registrar pedido* en el panel; y la
 * cuadrícula muestra la foto de cada producto y solo los que tienen «Mostrar
 * en venta rápida» activado.
 */

const PASSWORD = "kamay123";

/**
 * Umbrales de tiempo, holgados y a propósito.
 *
 * Un criterio de tiempo con margen sigue detectando la regresión que importa
 * —la que multiplica el tiempo, no la que le suma 50 ms— y no convierte la
 * suite en una ruleta según lo cargada que esté la máquina de CI.
 */
const VUELTA_MAX_MS = 1_000;
const VENTAS_SIN_RED = 20;
/** Las últimas ventas no pueden costar más de tres veces lo que costaron las primeras. */
const DEGRADACION_MAX = 3;

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

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
    email: geeko().owner,
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

/**
 * Espera a que el catálogo capturado esté **escrito en Dexie**.
 *
 * Capturar la feria escribe dos cosas, y esperar solo el cascarón deja fuera
 * la mitad: sin el snapshot, la navegación sin red sirve la página guardada
 * pero la cuadrícula llega vacía, que es como se veía la intermitencia de
 * `abre sin red desde el catálogo capturado` en CI —cascarón sí, productos
 * no—.
 */
async function esperarCatalogoCapturado(page: Page) {
  await page.waitForFunction(
    async () => {
      const req = indexedDB.open("kamay-outbox");
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!db.objectStoreNames.contains("fairSnapshots")) {
        db.close();
        return false;
      }

      const rows: { products?: unknown[] }[] = await new Promise((resolve) => {
        const all = db.transaction("fairSnapshots").objectStore("fairSnapshots").getAll();
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => resolve([]);
      });
      db.close();

      return rows.some((row) => (row.products?.length ?? 0) > 0);
    },
    undefined,
    { timeout: 30_000 },
  );
}

/**
 * Espera a que el service worker **controle esta página**, no solo a que esté
 * activo.
 *
 * `navigator.serviceWorker.ready` resuelve en cuanto hay un registro activo,
 * pero `clientsClaim` toma el control de forma asíncrona: entre una cosa y la
 * otra hay una ventana en la que `controller` sigue siendo `null`. Cortar la
 * red ahí hace que la navegación a `/fair` se vaya a la red en vez de al
 * cascarón guardado, y la prueba muere sin producto que enseñar. Era la causa
 * de que esta suite saliera intermitente en CI.
 *
 * Si el control no llega —la página se cargó antes de que el worker se
 * registrara—, una recarga lo garantiza: un worker ya activo controla toda
 * navegación nueva.
 */
async function esperarServiceWorkerAlMando(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);

  const controlada = () =>
    page.evaluate(() => navigator.serviceWorker.controller !== null);

  if (await controlada()) return;

  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 30_000,
  });
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

/** Una venta completa: *Agregar* un producto, *Ver carrito*, *Registrar pedido*. */
async function venderUno(page: Page) {
  await page.getByTestId("fair-add").first().click();
  await page.getByTestId("fair-view-cart").click();
  await page.getByTestId("fair-register").click();
  // La vuelta a la cuadrícula con el carrito vacío es el fin de la venta.
  await expect(page.getByTestId("cart-total")).toHaveText("0");
}

test.describe("modo feria", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, geeko().owner);
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
    const agregar = page.getByTestId("fair-add");

    await gestos.clic(agregar.nth(0));
    await gestos.clic(agregar.nth(1));
    await gestos.clic(page.getByTestId("fair-view-cart"));
    await gestos.clic(page.getByTestId("fair-register"));

    await expect(page.getByTestId("cart-total")).toHaveText("0");
    expect(gestos.total).toBeLessThanOrEqual(4);
  });

  test("el precio del catálogo se propone sin escribir nada", async ({ page }) => {
    await abrirFeria(page);

    await page.getByTestId("fair-add").first().click();
    const total = await page.getByTestId("cart-total").textContent();
    await page.getByTestId("fair-view-cart").click();

    await expect(page.getByTestId("fair-amount")).toHaveValue(total ?? "");
  });

  // ── Criterio 3 ──────────────────────────────────────────────────────────
  test("vuelve a la cuadrícula en menos de un segundo, sin pantallas intermedias", async ({
    page,
  }) => {
    await abrirFeria(page);
    await page.getByTestId("fair-add").first().click();
    await page.getByTestId("fair-view-cart").click();

    const inicio = Date.now();
    await page.getByTestId("fair-register").click();
    await expect(page.getByTestId("cart-total")).toHaveText("0");
    const transcurrido = Date.now() - inicio;

    expect(transcurrido).toBeLessThan(VUELTA_MAX_MS);
    // Ni panel abierto ni resumen: la cuadrícula, el aviso breve, y nada más.
    await expect(page.getByTestId("fair-amount")).toHaveCount(0);
    await expect(page.getByTestId("fair-toast")).toBeVisible();
    await expect(page.getByTestId("fair-product").first()).toBeVisible();
  });

  test("la venta siguiente empieza en un carrito nuevo", async ({ page }) => {
    await abrirFeria(page);
    await venderUno(page);

    await page.getByTestId("fair-add").nth(1).click();
    await page.getByTestId("fair-view-cart").click();

    // Solo la línea recién agregada: ni rastro de la venta anterior.
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
  });

  // ── Foto, visibilidad y cantidad (fair-product-photos-visibility-cart-drawer) ──
  test("muestra la foto, oculta lo que no va a la feria y la vende sin red", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const { organizationId, owner } = geeko();
    const db = await signedInClient(owner);

    const { data: items, error } = await db
      .from("items")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("name", ["Taza de barro", "Plato hondo"]);
    if (error) throw new Error(error.message);
    const id = (name: string) => items!.find((item) => item.name === name)!.id as string;

    // «Plato hondo» fuera de la venta rápida; sigue en el catálogo.
    const hidden = await db
      .from("items")
      .update({ show_in_fair: false })
      .eq("id", id("Plato hondo"));
    if (hidden.error) throw new Error(hidden.error.message);

    // Una foto para «Taza de barro», por el mismo camino de almacenamiento.
    const photoId = crypto.randomUUID();
    const storagePath = `${organizationId}/item/${id("Taza de barro")}/${photoId}.png`;
    const png = noisePng(64, 64);
    const upload = await db.storage
      .from("item-photos")
      .upload(storagePath, png, { contentType: "image/png" });
    if (upload.error) throw new Error(upload.error.message);
    const { data: me } = await db.auth.getUser();
    const attached = await db.from("attachments").insert({
      id: photoId,
      organization_id: organizationId,
      entity_type: "item",
      entity_id: id("Taza de barro"),
      bucket: "item-photos",
      storage_path: storagePath,
      file_name: "taza.png",
      mime_type: "image/png",
      size_bytes: png.byteLength,
      uploaded_by: me.user?.id,
    });
    if (attached.error) throw new Error(attached.error.message);

    await abrirFeria(page);

    // Escenario: Producto oculto de la venta rápida
    await expect(page.getByTestId("fair-product").filter({ hasText: "Plato hondo" })).toHaveCount(0);

    // Escenario: Producto con foto
    const taza = page.getByTestId("fair-product").filter({ hasText: "Taza de barro" });
    const foto = taza.getByRole("img", { name: "Foto de Taza de barro" });
    await expect(foto).toBeVisible();

    // La miniatura queda guardada en el dispositivo y la tarjeta pasa a la
    // copia local: es la que sigue viéndose sin señal.
    await expect(foto).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });

    await context.setOffline(true);

    // Escenario: Abrir sin red tras haber entrado con red (sin recargar: el
    // arranque en frío necesita la compilación de producción, abajo).
    await expect(foto).toHaveAttribute("src", /^blob:/);
    expect(await foto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // Escenario: Agregar varias unidades de una vez
    const mas = taza.getByRole("button", { name: "Aumentar cantidad de Taza de barro" });
    await mas.click();
    await mas.click();
    await taza.getByTestId("fair-add").click();
    await expect(page.getByTestId("cart-total")).toHaveText("105");
    await expect(taza.getByTestId("fair-quantity")).toHaveText("1");

    await page.getByTestId("fair-view-cart").click();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("cart-line")).toContainText("35 × 3");
    await page.getByTestId("fair-register").click();

    // Escenario: Mensaje de éxito sin señal
    await expect(page.getByTestId("fair-toast")).toContainText("Se enviará al recuperar la señal");
    await expect(page.getByTestId("cart-total")).toHaveText("0");

    await context.setOffline(false);
    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });
  });

  // Escenario: Sin desplazamiento horizontal
  test("a 390 px no hay desplazamiento horizontal, con el panel abierto o cerrado", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirFeria(page);

    const desborda = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
    expect(await desborda()).toBe(false);

    await page.getByTestId("fair-add").first().click();
    await page.getByTestId("fair-view-cart").click();
    await expect(page.getByTestId("fair-register")).toBeVisible();
    expect(await desborda()).toBe(false);
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

    // Sin degradación perceptible: las últimas no cuestan un múltiplo de las
    // primeras. Se comparan **medianas de cinco**, no una venta contra otra:
    // una sola primera venta de 160 ms convertía cualquier pausa del
    // recolector en «degradación», y la prueba fallaba también sin este
    // cambio (KAM-23, intermitencia corregida en su causa). Una degradación de
    // verdad —una cola que crece, un repintado que empeora— es una tendencia,
    // y la mediana la conserva.
    const primeras = mediana(duraciones.slice(0, 5));
    const ultimas = mediana(duraciones.slice(-5));
    expect(ultimas, `primeras ${duraciones.slice(0, 5)} · últimas ${duraciones.slice(-5)}`).toBeLessThan(
      Math.max(primeras, 1) * DEGRADACION_MAX,
    );

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
    // El vaciado de la cola puede tardar hasta un barrido completo (30 s) más
    // su reintento. La espera de abajo lo contempla con 60 s, pero el límite
    // por omisión de la prueba es 30 s: sin ampliarlo, esa espera no podía
    // agotarse nunca y el caso lento se contaba como fallo.
    test.setTimeout(120_000);
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
    // El vaciado de la cola puede tardar hasta un barrido completo (30 s) más
    // su reintento. La espera de abajo lo contempla con 60 s, pero el límite
    // por omisión de la prueba es 30 s: sin ampliarlo, esa espera no podía
    // agotarse nunca y el caso lento se contaba como fallo.
    test.setTimeout(120_000);
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
 * `fair-all-lines` · Con «Venta rápida con todas las líneas», la feria vende
 * productos de todas las líneas y cada uno se registra en la suya. Escenarios
 * del delta `fair-mode`: «Con la bandera, productos de todas las líneas»,
 * «Un carrito de dos líneas crea dos ventas», «Un carrito de dos líneas
 * cuenta dos ventas» y «Reenvío sin duplicados».
 */
test.describe("modo feria con todas las líneas", () => {
  test("vende productos de dos líneas sin red y quedan dos ventas, cada una en su línea", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await login(page, geeko().owner);

    // La bandera se enciende como lo haría la dueña.
    await page.goto("/settings/general");
    const toggle = page.getByRole("switch", { name: "Venta rápida con todas las líneas" });
    await toggle.click();
    const form = page.locator("form").filter({ has: toggle });
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByRole("status")).toHaveText("Cambios guardados.");

    await abrirFeria(page);

    const taza = page.getByTestId("fair-product").filter({ hasText: "Taza personalizada" });
    const barro = page.getByTestId("fair-product").filter({ hasText: "Taza de barro" });
    await expect(taza.getByTestId("fair-product-line")).toHaveText("Sublimación");
    await expect(barro.getByTestId("fair-product-line")).toHaveText("Alfarería");

    await context.setOffline(true);

    await taza.getByTestId("fair-add").click();
    await barro.getByTestId("fair-add").click();
    await page.getByTestId("fair-view-cart").click();
    await page.getByTestId("fair-register").click();
    await expect(page.getByTestId("cart-total")).toHaveText("0");

    // Dos ventas, aunque sea un solo registro.
    await expect(page.getByTestId("fair-pending-count")).toHaveText("2");

    const ids = await page.evaluate(async () => {
      const req = indexedDB.open("kamay-outbox");
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const entries: { operation: string; payload: { sales?: { id: string }[] } }[] =
        await new Promise((resolve) => {
          const all = db.transaction("outbox").objectStore("outbox").getAll();
          all.onsuccess = () => resolve(all.result);
        });
      return entries
        .filter((entry) => entry.operation === "directSale.createBatch")
        .flatMap((entry) => (entry.payload.sales ?? []).map((sale) => sale.id));
    });
    expect(new Set(ids).size).toBe(2);

    await context.setOffline(false);
    await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });

    expect(await contarVentasDirectas(ids)).toBe(2);

    // Y cada una en su línea.
    const db = await signedInClient(geeko().owner);
    const { data, error } = await db
      .from("orders")
      .select("business_lines(name)")
      .in("id", ids);
    if (error) throw new Error(error.message);
    const lineas = (data ?? [])
      .map((row) => (row.business_lines as unknown as { name: string }).name)
      .sort();
    expect(lineas).toEqual(["Alfarería", "Sublimación"]);
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
    await login(page, geeko().owner);
  });

  test("recargar sin red conserva las ventas pendientes", async ({ page, context }) => {
    // Tras recargar sin red, el vaciado puede tardar hasta un barrido completo
    // de la cola (30 s) en salir. El timeout por omisión de Playwright es ese
    // mismo, así que la prueba moriría justo antes de ver lo que espera.
    test.setTimeout(120_000);

    await abrirFeria(page);
    await esperarServiceWorkerAlMando(page);
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
    // Tomar el control puede costar una recarga, y el arranque en frío sin red
    // tiene su propio margen de 30 s: con el timeout por omisión la prueba
    // moría antes de llegar a comprobar nada.
    test.setTimeout(90_000);

    await abrirFeria(page);
    await esperarServiceWorkerAlMando(page);
    await esperarCascaronGuardado(page);
    await esperarCatalogoCapturado(page);
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
    // El vaciado de la cola puede tardar hasta un barrido completo (30 s) más
    // su reintento. La espera de abajo lo contempla con 60 s, pero el límite
    // por omisión de la prueba es 30 s: sin ampliarlo, esa espera no podía
    // agotarse nunca y el caso lento se contaba como fallo.
    test.setTimeout(120_000);
  await login(page, geeko().assistant);
  await abrirFeria(page);

  await venderUno(page);

  // Se registró y salió: atender la feria es su trabajo.
  await expect(page.getByTestId("fair-pending-sales")).toHaveCount(0, { timeout: 60_000 });
});
