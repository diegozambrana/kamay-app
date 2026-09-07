import { expect, test, type Page } from "@playwright/test";

/**
 * KAM-13 · Registro rápido y navegación móvil, en un teléfono de verdad.
 *
 * 390 px es el número del criterio, no una aproximación: es donde los rótulos
 * de la barra se cortaban y donde el kanban horizontal deja de servir. Se
 * estrecha el viewport del proyecto móvil en vez de declarar otro dispositivo:
 * hace falta un user-agent de teléfono —la vista por omisión de pedidos y el
 * aterrizaje tras entrar se deciden por él en el servidor (design D4)— y el
 * proyecto ya lo trae, sin arrastrar un motor de navegador que el repositorio
 * no instala. En escritorio la suite entera se salta.
 *
 * Cubre `quick-capture` al completo y, de `user-auth`, "The mobile bottom bar
 * carries exactly four slots", "The 'Más' panel holds every remaining section"
 * y "No app screen scrolls horizontally on a phone"; de `orders`, la parte
 * móvil de "Vistas alternativas y filtros del tablero".
 */

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, "el recorrido entero es el del celular");
});

const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";

const ANCHO = 390;

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** Un monto que no choca con ningún otro egreso: sirve para encontrar la fila. */
function montoUnico(): string {
  return `${100 + Math.floor(Math.random() * 800)}.${
    Math.floor(Math.random() * 90) + 10
  }`;
}

/**
 * ¿La página desborda a lo ancho?
 *
 * Se mide el documento, no un componente: el tablero puede desplazarse dentro
 * de sus propios límites, y eso es correcto. Lo que no puede es empujar la
 * página entera.
 */
async function desbordaHorizontalmente(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

/**
 * Los `uuid` de los pedidos que esta pestaña dejó en la cola.
 *
 * KAM-11 genera el identificador en el cliente y es el que acaba siendo llave
 * primaria, así que sirve para seguir al mismo registro antes y después de
 * sincronizar. Hace falta porque "Registrado hoy" es de la organización y la
 * suite entera comparte la de Geeko: sin él, no hay forma de distinguir el
 * pedido de esta prueba del que acaba de crear otra.
 */
async function pedidosEncolados(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const req = indexedDB.open("kamay-outbox");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const entries: { operation: string; recordId: string }[] = await new Promise(
      (resolve) => {
        const all = db.transaction("outbox").objectStore("outbox").getAll();
        all.onsuccess = () => resolve(all.result);
      },
    );
    return entries
      .filter((entry) => entry.operation === "order.create")
      .map((entry) => entry.recordId);
  });
}

test.describe("V16 · registro rápido", () => {
  test("entrar en el celular aterriza en el registro rápido", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    await expect(page).toHaveURL(/\/quick$/);
    await expect(page.getByTestId("quick-grid")).toBeVisible();
  });

  test("la retícula cabe en 390 px con sus seis destinos", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    expect(page.viewportSize()?.width).toBe(ANCHO);
    await expect(page.getByTestId("quick-grid").locator("> *")).toHaveCount(6);

    for (const key of [
      "direct-sale",
      "order",
      "purchase",
      "cost",
      "consumption",
      "task",
    ]) {
      await expect(page.getByTestId(`quick-destination-${key}`)).toBeVisible();
    }

    expect(await desbordaHorizontalmente(page)).toBe(false);
  });

  test("registrar un gasto y verlo encabezar Registrado hoy", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    // Dos toques desde la pantalla de inicio: el destino y guardar.
    await page.getByTestId("quick-destination-cost").click();
    await page.waitForURL(/\/expenses\/costs\/new$/);

    // En una pantalla de captura no se rinde ni la barra ni el flotante.
    await expect(page.getByTestId("bottom-bar")).toHaveCount(0);
    await expect(page.getByTestId("register-button")).toHaveCount(0);

    const monto = montoUnico();
    await page.getByLabel("Monto").fill(monto);
    await page.getByRole("radio", { name: "Servicios" }).click();
    await page.getByTestId("save-cost").click();
    await page.waitForURL(/\/expenses(\?.*)?$/);

    await page.goto("/quick");
    // Aparece en la lista, no necesariamente primero: "Registrado hoy" es de
    // la organización y la suite entera comparte la de Geeko, así que otra
    // prueba puede haber registrado algo un segundo después. Que el orden sea
    // por hora descendente lo fija `lib/quick-capture/recent.test.ts`, que sí
    // es determinista.
    const fila = page
      .getByTestId("recent-today")
      .locator("li", { hasText: "Gasto" })
      .first();
    await expect(fila).toBeVisible();
    // Ya sincronizado: tiene detalle y no lleva la marca de pendiente.
    await expect(fila.getByTestId("recent-pending")).toHaveCount(0);

    await fila.getByRole("link").click();
    await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]{36}$/);
  });

  test("al ayudante la retícula no le ofrece egresos, ni por dirección", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    await expect(page.getByTestId("quick-destination-purchase")).toHaveCount(0);
    await expect(page.getByTestId("quick-destination-cost")).toHaveCount(0);
    await expect(page.getByTestId("quick-destination-order")).toBeVisible();

    // Ocultar la ranura no basta: la ruta tampoco puede registrar.
    await page.goto("/expenses/costs/new");
    await expect(page.getByTestId("save-cost")).toHaveCount(0);
  });
});

test.describe("modo feria: la ida y la vuelta", () => {
  test("se entra desde V16 y se vuelve a V16", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    await page.getByTestId("quick-destination-direct-sale").click();
    await page.waitForURL(/\/fair$/);

    // El modo feria suprime la navegación a propósito: cada elemento visible
    // en un puesto es un toque accidental esperando ocurrir.
    await expect(page.getByTestId("bottom-bar")).toHaveCount(0);
    await expect(page.getByTestId("register-button")).toHaveCount(0);

    await page.getByTestId("fair-exit").click();
    await page.waitForURL(/\/quick$/);
    await expect(page.getByTestId("quick-grid")).toBeVisible();
  });

  test("no hay otra puerta al modo feria", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    for (const ruta of ["/dashboard", "/orders", "/catalog", "/contacts", "/expenses"]) {
      await page.goto(ruta);
      await expect(page.locator('a[href="/fair"]')).toHaveCount(0);
    }

    await page.goto("/quick");
    await expect(page.locator('a[href="/fair"]')).toHaveCount(1);
  });
});

test.describe("barra inferior y panel Más", () => {
  test("cuatro ranuras, con Tareas hacia Mis pendientes", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders");

    const ranuras = page.getByTestId("bottom-bar").locator("> *");
    await expect(ranuras).toHaveCount(4);
    await expect(ranuras).toContainText(["Inicio", "Pedidos", "Tareas", "Más"]);

    await page.getByTestId("bottom-bar").getByRole("link", { name: "Tareas" }).click();
    await page.waitForURL(/\/my-tasks$/);
  });

  test("Más abre el resto de secciones y se cierra al elegir", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders");

    await page.getByTestId("bottom-bar-more").click();
    const panel = page.getByTestId("more-panel");
    await expect(panel.getByRole("link", { name: "Egresos" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Configuración" })).toBeVisible();

    await panel.getByRole("link", { name: "Catálogo" }).click();
    await page.waitForURL(/\/catalog$/);
    await expect(page.getByTestId("more-panel")).toHaveCount(0);
  });

  test("la tira de contexto sobrevive a la barra de cuatro ranuras", async ({
    page,
  }) => {
    // El indicador de sincronización de KAM-11 vive arriba; la barra y el
    // flotante, abajo. Reestructurar la barra no puede desalojarlo.
    await login(page, GEEKO_OWNER);
    await page.goto("/orders");

    await expect(page.getByTestId("mobile-context-bar")).toBeVisible();
    await expect(page.getByTestId("line-selector-mobile")).toBeVisible();
    await expect(page.getByTestId("bottom-bar")).toBeVisible();
  });
});

test.describe("+ Registrar desde cualquier pantalla", () => {
  test("un gasto desde el catálogo son dos toques", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/catalog");

    await page.getByTestId("register-button").click();
    await page.getByTestId("register-destination-cost").click();

    await page.waitForURL(/\/expenses\/costs\/new$/);
  });

  test("un pedido desde los egresos son dos toques", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/expenses");

    await page.getByTestId("register-button").click();
    await page.getByTestId("register-destination-order").click();

    await page.waitForURL(/\/orders\/new$/);
  });
});

test.describe("pedidos en el celular", () => {
  test("la lista es la vista por omisión y el tablero sigue disponible", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders");

    // La lista rinde una tabla por grupo de estado y todas comparten el
    // `data-testid`; basta con que la primera esté.
    await expect(page.getByTestId("orders-list").first()).toBeVisible();
    await expect(page.getByTestId("orders-board")).toHaveCount(0);
    expect(await desbordaHorizontalmente(page)).toBe(false);

    // El tablero se elige explícitamente y se desplaza dentro de sí mismo.
    // Necesita una línea concreta: con "Todas" activa no hay un juego único
    // de columnas y la pantalla pide elegir (KAM-07).
    const selector = page.getByTestId("line-selector-mobile");
    await selector.click();
    await page.getByRole("menuitem", { name: "Sublimación" }).click();
    // La cookie es `httpOnly`: la escribe el servidor y revalida. Sin esperar
    // a que el selector lo confirme, el `goto` llegaría con "Todas" todavía.
    await expect(selector).toContainText("Sublimación");
    await expect(selector).toBeEnabled();

    await page.goto("/orders?view=board");
    const tablero = page.getByTestId("orders-board");
    await expect(tablero).toBeVisible();
    await expect(page.getByTestId("orders-list")).toHaveCount(0);
    expect(await desbordaHorizontalmente(page)).toBe(false);
    expect(
      await tablero.evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true);
  });
});

test.describe("ninguna pantalla se desplaza a lo ancho en 390 px", () => {
  const RUTAS = [
    "/quick",
    "/orders",
    "/orders/new",
    "/expenses",
    "/expenses/costs/new",
    "/expenses/purchases/new",
    "/catalog",
    "/contacts",
    "/my-tasks",
  ];

  test("recorrido completo", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    for (const ruta of RUTAS) {
      await page.goto(ruta);
      expect(
        await desbordaHorizontalmente(page),
        `${ruta} desborda a lo ancho en ${ANCHO} px`,
      ).toBe(false);
    }
  });
});

test.describe("Registrado hoy cuenta lo que no se ha enviado", () => {
  test("un pedido sin enviar aparece marcado y no se duplica al drenar", async ({
    page,
  }) => {
    // Reintentar espera cada vez más (KAM-11): cuando se restablece el envío,
    // la entrada puede llevar acumulados varios intentos y su siguiente turno
    // caer decenas de segundos después. El límite por omisión de 30 s dejaba
    // la espera de abajo sin poder agotarse nunca.
    test.setTimeout(150_000);

    // Los egresos no están entre las operaciones que la cola cubre: el
    // recorrido se hace con un pedido, que sí lo está.
    //
    // Se corta la Server Action en vez de la red entera. `capture` encola
    // siempre y luego intenta vaciar, así que el camino recorrido es el
    // mismo; y con la red viva se puede navegar a `/quick`, que es donde
    // vive la lista. Con el navegador desconectado, en desarrollo no hay
    // service worker que sirva el cascarón y la propia navegación falla.
    await login(page, GEEKO_OWNER);

    await page.goto("/orders/new");
    await page.getByTestId("line-select").click();
    await page.getByRole("option", { name: "Sublimación", exact: true }).click();
    await page.getByLabel("Cliente").fill("María");
    await page.getByRole("button", { name: "María Céspedes", exact: true }).click();

    const opciones = page.getByTestId("catalog-options");
    await page.getByLabel("Agregar del catálogo").fill("Taza");
    await opciones.getByRole("button", { name: /Taza personalizada/ }).click();
    await opciones.getByRole("button", { name: /15oz/ }).click();
    await page.getByLabel("Cantidad").fill("2");

    await page.route("**/orders/new", async (route) => {
      if (route.request().method() === "POST") return route.abort();
      return route.fallback();
    });

    await page.getByTestId("save-order").click();
    await expect(page.getByTestId("order-form-notice")).toContainText(
      /pendiente de sincronizar/i,
      { timeout: 15_000 },
    );

    await page.goto("/quick");

    // Aparece igual, marcado, y sin detalle que abrir: todavía no existe.
    await expect(page.getByTestId("recent-pending")).toHaveCount(1);
    const fila = page.getByTestId("recent-row-inert").first();
    await expect(fila.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("recent-today-empty")).toHaveCount(0);

    const [pedidoId] = await pedidosEncolados(page);
    expect(pedidoId, "el pedido tiene que estar en la cola").toBeTruthy();

    // Se restablece el envío. Reintentar espera cada vez más, así que en vez
    // de esperar de brazos cruzados se reabre la pantalla hasta que la cola
    // esté vacía: cada montaje dispara un barrido, que es justamente lo que
    // haría quien vuelve a mirar.
    //
    // Se comprueba con la lista ya rendida y no con el indicador: `toBeHidden`
    // justo después de recargar pasa sin más, porque en ese instante el
    // elemento todavía no existe, y la cola seguía llena.
    await page.unroute("**/orders/new");

    const enlace = page.locator(`a[href="/orders/${pedidoId}"]`);

    await expect(async () => {
      await page.reload();
      await expect(page.getByTestId("recent-today")).toBeVisible();
      // El mismo `uuid` que estaba en la cola, ahora con detalle que abrir.
      await expect(enlace).toHaveCount(1);
    }).toPass({ timeout: 120_000 });

    // Una sola vez, y ya sin la marca: la entrada de la cola y la fila del
    // servidor comparten identificador, así que la mezcla las funde.
    const sincronizada = page
      .getByTestId("recent-today")
      .locator("li")
      .filter({ has: enlace });
    await expect(sincronizada).toHaveCount(1);
    await expect(sincronizada.getByTestId("recent-pending")).toHaveCount(0);
  });
});
