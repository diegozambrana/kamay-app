import { expect, test, type Page } from "@playwright/test";

/**
 * KAM-11 · Registrar sin conexión.
 *
 * Escenarios de `offline-capture`: "Todo registro cubierto se guarda
 * localmente…" → «Registrar sin red»; "La cola sobrevive al cierre de la
 * aplicación" → «Recargar la página no vacía la cola»; "Reenviar un registro
 * nunca crea un segundo" → «Dos reintentos, un solo registro»; "La hora del
 * hecho…" → «Venta registrada sin señal y sincronizada horas después»,
 * «Varios registros conservan sus horas distintas»; "Un indicador
 * persistente…" → «La cuenta refleja lo pendiente», «El indicador desaparece
 * al vaciarse la cola»; "Ante ediciones desordenadas…" → «No hay pantalla de
 * conflicto»; "Los reintentos esperan cada vez más" → «Los reintentos no
 * bloquean la interfaz». Y del delta `orders`: «Guardar sin conexión», «El
 * número aparece al sincronizar».
 *
 * La red se desconecta **después** de tener la pantalla cargada: así la
 * prueba mide la captura y no la caché del service worker, que solo se
 * comporta como en producción tras `next build` (design.md — Risks). La parte
 * que sí exige producción está más abajo, marcada para CI.
 */

const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";

/**
 * Cantidades irrepetibles.
 *
 * La base la comparten todas las pruebas y no se reinicia entre ellas: una
 * cantidad fija dejaría pedidos de ejecuciones anteriores con el mismo total,
 * y «existe exactamente uno» fallaría por acumulación en vez de por duplicado.
 * El rango es amplio a propósito —y aleatorio, no derivado del reloj— porque
 * los proyectos de escritorio y móvil corren a la vez y dos relojes leídos en
 * el mismo milisegundo dan el mismo número.
 */
function cantidadUnica(): string {
  return String(1_000 + Math.floor(Math.random() * 8_000_000));
}

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Un pedido mínimo: cliente y una línea del catálogo. Devuelve el total, que
 * es lo que después identifica a ESTE pedido en la lista: la base la comparten
 * todas las pruebas, así que contar filas sin más contaría también las suyas.
 */
async function llenarPedido(page: Page, cantidad: string): Promise<string> {
  await page.getByTestId("line-select").click();
  await page.getByRole("option", { name: "Sublimación", exact: true }).click();

  await page.getByLabel("Cliente").fill("María");
  await page.getByRole("button", { name: "María Céspedes", exact: true }).click();

  const opciones = page.getByTestId("catalog-options");
  await page.getByLabel("Agregar del catálogo").fill("Taza");
  await opciones.getByRole("button", { name: /Taza personalizada/ }).click();
  await opciones.getByRole("button", { name: /15oz/ }).click();
  await page.getByLabel("Cantidad").fill(cantidad);

  const total = page.getByTestId("order-form-total");
  await expect(total).not.toHaveText("0.00");
  return (await total.textContent()) ?? "";
}

/**
 * El indicador vive en la barra superior en escritorio y en la tira de
 * contexto en móvil. Ambas se rinden siempre y una queda oculta por CSS, así
 * que se toma la visible —que es la que la persona tiene delante—.
 */
function indicador(page: Page) {
  return page.getByTestId("sync-indicator").locator("visible=true");
}

function cuenta(page: Page) {
  return indicador(page).getByTestId("sync-count");
}

test.describe("captura sin conexión", () => {
  test("registrar sin red, recargar, reconectar: un solo pedido con su hora real", async ({
    page,
    context,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders/new");

    const total = await llenarPedido(page, cantidadUnica());

    await context.setOffline(true);

    // ── Registrar sin red ──────────────────────────────────────────────────
    await page.getByTestId("save-order").click();

    await expect(page.getByTestId("order-form-notice")).toContainText(
      /pendiente de sincronizar/i,
    );
    // Sin número: lo asigna la base, y la base todavía no lo ha visto.
    await expect(page.getByTestId("order-form-notice")).not.toContainText(/#\d/);
    await expect(page.getByText("No se pudo guardar")).toHaveCount(0);

    // ── El indicador cuenta lo pendiente ──────────────────────────────────
    await expect(indicador(page)).toBeVisible();
    await expect(cuenta(page)).toHaveText("1");

    // La entrada está en la cola con su identificador generado en el
    // dispositivo y con la hora real del hecho ya fijada.
    const encolado = await leerCola(page);
    expect(encolado).toHaveLength(1);
    expect(encolado[0].operation).toBe("order.create");

    // La interfaz sigue viva mientras hay pendientes: nada bloquea.
    await expect(page.getByTestId("order-form")).toBeVisible();

    // ── Reconectar ────────────────────────────────────────────────────────
    await context.setOffline(false);

    await expect(indicador(page)).toBeHidden({ timeout: 60_000 });

    // ── Exactamente un pedido, no dos ─────────────────────────────────────
    expect(await pedidosCon(page, total)).toBe(1);

    // ── Con su número, que solo existe desde que llegó al servidor ────────
    await page.goto(`/orders/${encolado[0].recordId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("#");
    await expect(page.getByTestId("order-total")).toHaveText(total);

    // ── Y con la hora que fijó el dispositivo, no la de la sincronización ──
    // `.first()`: la misma hora aparece también en la bitácora del pedido,
    // que es justamente lo que se quiere —ambas cuentan el hecho, no la
    // llegada—.
    await expect(
      page.getByText(horaEsperada(encolado[0].occurredAt)).first(),
    ).toBeVisible();

    // Ninguna pantalla de conflicto ni de resolución apareció por el camino.
    await expect(page.getByText(/conflicto/i)).toHaveCount(0);
  });

  test("tres pedidos sin red llegan los tres, y el indicador baja de tres a cero", async ({
    page,
    context,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders/new");
    await context.setOffline(true);

    const totales: string[] = [];

    for (const cantidad of [cantidadUnica(), cantidadUnica(), cantidadUnica()]) {
      totales.push(await llenarPedido(page, cantidad));
      await page.getByTestId("save-order").click();
      await expect(page.getByTestId("order-form-notice")).toContainText(
        /pendiente de sincronizar/i,
      );
    }

    await expect(cuenta(page)).toHaveText("3");

    // Cada venta lleva SU hora, no la del formulario abierto ni la de la
    // sincronización: tres registros, tres instantes distintos.
    const encolados = await leerCola(page);
    expect(encolados).toHaveLength(3);
    expect(new Set(encolados.map((entry) => entry.occurredAt)).size).toBe(3);

    await context.setOffline(false);
    await expect(indicador(page)).toBeHidden({ timeout: 60_000 });

    // Los tres, cada uno una sola vez.
    for (const total of totales) {
      expect(await pedidosCon(page, total)).toBe(1);
    }

    // Y cada uno conserva la hora con que se registró.
    for (const encolado of encolados) {
      await page.goto(`/orders/${encolado.recordId}`);
      await expect(
        page.getByText(horaEsperada(encolado.occurredAt)).first(),
      ).toBeVisible();
    }
  });
});

/**
 * Todo lo que exige **cargar una página sin red** vive aquí: sin service
 * worker, el navegador ni siquiera recibe el HTML, y el service worker solo
 * existe tras `next build` —en local, `npm run test:e2e` levanta `next dev`—.
 * Por eso este bloque corre solo donde la compilación es de producción
 * (design.md — Risks).
 */
test.describe("el cascarón se abre sin red", () => {
  test.skip(!process.env.CI, "necesita la compilación de producción");

  test("abrir la aplicación sin conexión muestra Kamay, no el error del navegador", async ({
    page,
    context,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders");

    // El service worker toma el control antes de servir nada sin red.
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.goto("/orders");

    // El documento es de Kamay —no la página de error del navegador— y trae
    // su navegación: el cascarón salió de la caché del service worker.
    await expect(page).toHaveTitle(/Kamay/);
    await expect(page.locator("body")).toContainText(/Pedidos|Sin conexión/);
  });

  // Escenario: «Recargar la página no vacía la cola».
  test("recargar sin red conserva los registros pendientes", async ({
    page,
    context,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders/new");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await llenarPedido(page, cantidadUnica());

    await context.setOffline(true);
    await page.getByTestId("save-order").click();
    await expect(cuenta(page)).toHaveText("1");

    // Recargar sin red sirve la página de Kamay que explica la situación: el
    // formulario y el tablero necesitan servidor, la promesa de que nada se
    // perdió no.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();

    // Y la cola sigue intacta, que es lo que el escenario garantiza.
    const encolado = await leerCola(page);
    expect(encolado).toHaveLength(1);
    expect(encolado[0].operation).toBe("order.create");

    // Al volver la señal, se envía y el indicador llega a cero.
    await context.setOffline(false);
    await page.goto("/orders");
    await expect(indicador(page)).toBeHidden({ timeout: 60_000 });
  });
});

/** Lo que hay en la cola del navegador, leído de IndexedDB tal cual. */
async function leerCola(
  page: Page,
): Promise<{ operation: string; recordId: string; occurredAt: string }[]> {
  return page.evaluate(async () => {
    const abrir = indexedDB.open("kamay-outbox");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      abrir.onsuccess = () => resolve(abrir.result);
      abrir.onerror = () => reject(abrir.error);
    });

    const entries: {
      operation: string;
      recordId: string;
      payload: { occurredAt: string };
    }[] = await new Promise((resolve, reject) => {
      const request = db.transaction("outbox").objectStore("outbox").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return entries.map((entry) => ({
      operation: entry.operation,
      recordId: entry.recordId,
      occurredAt: entry.payload.occurredAt,
    }));
  });
}

/**
 * La misma hora, escrita como la escribe la aplicación: día/mes/año y 24
 * horas, en la zona del taller (Geeko está en La Paz).
 */
function horaEsperada(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("day")}/${get("month")}/${get("year")} ${hour}:${get("minute")}`;
}

/**
 * Cuántas filas de la lista tienen ese total. La lista —y no el tablero—
 * porque cruza todas las líneas de negocio, y por total —y no en bruto—
 * porque un duplicado se ve exactamente aquí: dos filas donde debe haber una.
 */
async function pedidosCon(page: Page, total: string): Promise<number> {
  await page.goto("/orders?view=list");
  // La lista se agrupa en varias tablas —una por sección—, así que se espera
  // a la primera y se cuentan las filas de todas.
  await page.getByTestId("orders-list").first().waitFor();
  return page.getByTestId("order-row").filter({ hasText: total }).count();
}
